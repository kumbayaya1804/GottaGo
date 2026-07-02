// Mock the supabase singleton so rpc() calls can be intercepted.
// Reviewer fix (Antigravity + Codex, 2026-07-01): profileStats must call the
// get_profile_stats SECURITY DEFINER RPC rather than querying `ratings` directly —
// base-table SELECT on `ratings` is revoked from authenticated/anon (privacy fix in
// 20260624000002_ratings_privacy_fix.sql), so a direct client query 42501s at runtime.
// The RPC derives the user via auth.uid() server-side, so the client passes no arguments.
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

import { profileStats } from '../profileStats';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profileStats', () => {
  it('calls the get_profile_stats RPC with no arguments', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: { gps_verifications: 3, locations_submitted: 5, ratings_given: 7 },
      error: null,
    });

    await profileStats();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_profile_stats');
  });

  it('maps the RPC result to camelCase stat fields', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: { gps_verifications: 3, locations_submitted: 5, ratings_given: 7 },
      error: null,
    });

    const result = await profileStats();

    expect(result).toEqual({ gpsVerifications: 3, locationsSubmitted: 5, ratingsGiven: 7 });
  });

  it('falls back to 0 for any stat field that resolves to null', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: { gps_verifications: null, locations_submitted: null, ratings_given: null },
      error: null,
    });

    const result = await profileStats();

    expect(result).toEqual({ gpsVerifications: 0, locationsSubmitted: 0, ratingsGiven: 0 });
  });

  it('throws when the RPC returns an error', async () => {
    const rpcError = new Error('permission denied for function get_profile_stats');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(profileStats()).rejects.toThrow('permission denied for function get_profile_stats');
  });
});
