// expo-location is mocked in jest.setup.ts (getCurrentPositionAsync +
// requestForegroundPermissionsAsync are jest.fn()). This hook is the single
// live-coordinate source 03-03 (Map) and 03-04 (Nearby) consume.
import * as Location from 'expo-location';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useCurrentPosition } from '../useCurrentPosition';

const mockPerm = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPos = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCurrentPosition', () => {
  it('returns live coords + granted status for a fresh fix', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 44.05, longitude: -123.09 },
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => useCurrentPosition());

    await waitFor(() => expect(result.current.status).toBe('granted'));
    expect(result.current.coords).toEqual({ userLat: 44.05, userLng: -123.09 });
    expect(result.current.isStale).toBe(false);
  });

  it('flags a fix older than the freshness threshold as stale', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 44.05, longitude: -123.09 },
      timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes old
    });

    const { result } = renderHook(() => useCurrentPosition());

    await waitFor(() => expect(result.current.coords).not.toBeNull());
    expect(result.current.isStale).toBe(true);
  });

  it('returns null coords + denied status when permission is denied (never throws)', async () => {
    mockPerm.mockResolvedValue({ status: 'denied' });

    const { result } = renderHook(() => useCurrentPosition());

    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.coords).toBeNull();
    expect(result.current.isStale).toBe(false);
    expect(mockPos).not.toHaveBeenCalled();
  });

  it('returns null coords + undetermined status when permission is undetermined', async () => {
    mockPerm.mockResolvedValue({ status: 'undetermined' });

    const { result } = renderHook(() => useCurrentPosition());

    await waitFor(() => expect(result.current.status).toBe('undetermined'));
    expect(result.current.coords).toBeNull();
    expect(mockPos).not.toHaveBeenCalled();
  });
});
