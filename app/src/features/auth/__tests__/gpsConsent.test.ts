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
});
