// Mock the supabase singleton so rpc() calls can be intercepted
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

import { fetchMyPendingSubmissions } from '../useMyPendingSubmissions';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    name: 'Alton Baker Park restroom',
    lat: 44.05,
    lng: -123.08,
    policy_tag: 'public_facility',
    confirmation_count: 1,
    expires_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('fetchMyPendingSubmissions', () => {
  it('calls the get_my_pending_submissions RPC with no argument', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await fetchMyPendingSubmissions();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_my_pending_submissions');
    // No second argument object — the RPC takes no params (authed-only, server-scoped).
    expect(mockSupabase.rpc.mock.calls[0]).toHaveLength(1);
  });

  it('maps each row to a GeoJSON Point feature with [lng, lat] coordinates', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [pendingRow()], error: null });

    const result = await fetchMyPendingSubmissions();

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    const feature = result.features[0];
    expect(feature.type).toBe('Feature');
    expect(feature.geometry).toEqual({ type: 'Point', coordinates: [-123.08, 44.05] });
  });

  it('carries id, name, policyTag, confirmationCount and expiresAt in feature properties (D-27, no refetch)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [pendingRow()], error: null });

    const result = await fetchMyPendingSubmissions();

    expect(result.features[0].properties).toEqual({
      id: 'sub-1',
      name: 'Alton Baker Park restroom',
      policyTag: 'public_facility',
      confirmationCount: 1,
      expiresAt: '2026-08-01T00:00:00.000Z',
    });
  });

  it('returns an empty FeatureCollection when data is an empty array', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const result = await fetchMyPendingSubmissions();

    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('returns an empty FeatureCollection when data is null (no crash)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const result = await fetchMyPendingSubmissions();

    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('throws when the RPC returns an error', async () => {
    const rpcError = new Error('rpc failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(fetchMyPendingSubmissions()).rejects.toBe(rpcError);
  });
});
