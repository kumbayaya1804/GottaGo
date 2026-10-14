// Mock the supabase singleton so rpc() and Location can be intercepted
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

// expo-location is mocked globally in jest.setup.ts
import * as Location from 'expo-location';

import { requestGpsConsent } from '../gpsConsent';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
});

describe('requestGpsConsent', () => {
  it('calls Location.requestForegroundPermissionsAsync', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });

    await requestGpsConsent();

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('returns "granted" when OS permission is granted', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });

    const result = await requestGpsConsent();

    expect(result).toBe('granted');
  });

  it('calls set_gps_consent RPC when permission is granted', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });

    await requestGpsConsent();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('set_gps_consent');
  });

  it('returns "denied" when OS permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    const result = await requestGpsConsent();

    expect(result).toBe('denied');
  });

  // T-02-04 security requirement: set_gps_consent MUST NOT be called on denial
  it('does NOT call set_gps_consent RPC when permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    await requestGpsConsent();

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('returns "denied" for any non-granted status (e.g. undetermined)', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });

    const result = await requestGpsConsent();

    expect(result).toBe('denied');
  });

  it('does NOT call set_gps_consent RPC for undetermined status', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });

    await requestGpsConsent();

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  // A granted OS permission whose consent record failed to save must not be
  // reported as 'granted': the database row is the authoritative consent record.
  it('returns "error" when the set_gps_consent RPC resolves with an error', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'network down' } });

    const result = await requestGpsConsent();

    expect(result).toBe('error');
  });

  // A thrown network failure (rejected promise) is the same failure as a resolved
  // error: the consent record was not saved.
  it('returns "error" when the set_gps_consent RPC rejects', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    mockSupabase.rpc.mockRejectedValue(new Error('fetch failed'));

    const result = await requestGpsConsent();

    expect(result).toBe('error');
  });

  it('returns "error" without calling the RPC when the permission request rejects', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
      new Error('permission request failed'),
    );

    const result = await requestGpsConsent();

    expect(result).toBe('error');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
