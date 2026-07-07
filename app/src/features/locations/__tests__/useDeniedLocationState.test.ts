// expo-location is mocked in jest.setup.ts (requestForegroundPermissionsAsync is
// a jest.fn()). useDeniedLocationState is the complementary PERMISSION-STATE hook
// to useCurrentPosition (the live-coordinate source, 03-02); both follow the
// Phase 2 gpsConsent.ts foreground-permission convention. This hook drives the
// denied-GPS ERR-01 no-dead-end fallback (D-34, approved 2026-07-05).
import * as Location from 'expo-location';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useDeniedLocationState } from '../useDeniedLocationState';

const mockPerm = Location.requestForegroundPermissionsAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDeniedLocationState', () => {
  it('granted → permission granted, showManualSearch false', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });

    const { result } = renderHook(() => useDeniedLocationState());

    await waitFor(() => expect(result.current.permission).toBe('granted'));
    expect(result.current.showManualSearch).toBe(false);
  });

  it('denied → permission denied, showManualSearch true (ERR-01, no dead end)', async () => {
    mockPerm.mockResolvedValue({ status: 'denied' });

    const { result } = renderHook(() => useDeniedLocationState());

    await waitFor(() => expect(result.current.permission).toBe('denied'));
    expect(result.current.showManualSearch).toBe(true);
  });

  it('undetermined → permission undetermined, showManualSearch false', async () => {
    mockPerm.mockResolvedValue({ status: 'undetermined' });

    const { result } = renderHook(() => useDeniedLocationState());

    await waitFor(() => expect(mockPerm).toHaveBeenCalled());
    expect(result.current.permission).toBe('undetermined');
    expect(result.current.showManualSearch).toBe(false);
  });
});
