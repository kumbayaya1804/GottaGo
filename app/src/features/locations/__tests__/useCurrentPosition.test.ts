// expo-location is mocked in jest.setup.ts (getCurrentPositionAsync +
// requestForegroundPermissionsAsync are jest.fn()). This hook is the single
// live-coordinate source 03-03 (Map) and 03-04 (Nearby) consume.
import * as Location from 'expo-location';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCurrentPosition } from '../useCurrentPosition';

const mockPerm = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPos = Location.getCurrentPositionAsync as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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

  it('returns an explicit unavailable state when permission lookup rejects, then retries', async () => {
    mockPerm.mockRejectedValueOnce(new Error('permission provider unavailable'));
    mockPerm.mockResolvedValueOnce({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 44.05, longitude: -123.09 },
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => useCurrentPosition());

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.coords).toBeNull();

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('granted'));
    expect(result.current.coords).toEqual({ userLat: 44.05, userLng: -123.09 });
  });

  it('returns an explicit unavailable state when GPS acquisition rejects', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockRejectedValue(new Error('position timeout'));

    const { result } = renderHook(() => useCurrentPosition());

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.coords).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it('ignores a permission result that arrives after unmount', async () => {
    const permission = deferred<{ status: string }>();
    mockPerm.mockReturnValue(permission.promise);

    const { unmount } = renderHook(() => useCurrentPosition());
    unmount();

    await act(async () => {
      permission.resolve({ status: 'granted' });
      await permission.promise;
    });

    expect(mockPos).not.toHaveBeenCalled();
  });

  it('ignores a GPS fix that arrives after unmount', async () => {
    const position = deferred<{
      coords: { latitude: number; longitude: number };
      timestamp: number;
    }>();
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockReturnValue(position.promise);

    const { unmount } = renderHook(() => useCurrentPosition());
    await waitFor(() => expect(mockPos).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      position.resolve({
        coords: { latitude: 44.05, longitude: -123.09 },
        timestamp: Date.now(),
      });
      await position.promise;
    });
  });

  it('ignores a provider rejection that arrives after unmount', async () => {
    const permission = deferred<{ status: string }>();
    mockPerm.mockReturnValue(permission.promise);

    const { unmount } = renderHook(() => useCurrentPosition());
    unmount();

    await act(async () => {
      permission.reject(new Error('provider stopped'));
      await expect(permission.promise).rejects.toThrow('provider stopped');
    });
  });
});
