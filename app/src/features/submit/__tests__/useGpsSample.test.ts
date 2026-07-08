// expo-location is mocked in jest.setup.ts (getCurrentPositionAsync +
// requestForegroundPermissionsAsync are jest.fn(); Accuracy is a value map).
// getGpsSample is the high-accuracy submission GPS reader the SubmitFlow Step 3
// consumes — it returns the full {coord, accuracy, mocked, timestamp} sample or a
// {denied:true} sentinel (never throws) so the wizard maps denial to friendly copy.
import * as Location from 'expo-location';
import { getGpsSample } from '../useGpsSample';

const mockPerm = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPos = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getGpsSample', () => {
  it('returns the full sample in high-accuracy mode for a granted permission + fix', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 44.05, longitude: -123.09, accuracy: 8 },
      mocked: false,
      timestamp: 1_700_000_000_000,
    });

    const result = await getGpsSample();

    expect(result).toEqual({
      coord: { lat: 44.05, lng: -123.09 },
      accuracy: 8,
      mocked: false,
      timestamp: 1_700_000_000_000,
    });
    // High-accuracy mode (SC1): must request BestForNavigation, not Balanced.
    expect(mockPos).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.BestForNavigation,
    });
  });

  it('surfaces mocked:true when the OS reports a mock provider (Android)', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: 5 },
      mocked: true,
      timestamp: 1,
    });

    const result = await getGpsSample();

    expect(result).toEqual(expect.objectContaining({ mocked: true }));
  });

  it('normalizes an undefined mocked flag (iOS) to mocked:false', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: 5 },
      mocked: undefined, // iOS: LocationObject.mocked is Android-only
      timestamp: 1,
    });

    const result = await getGpsSample();

    expect(result).toEqual(expect.objectContaining({ mocked: false }));
  });

  it('surfaces a low-accuracy fix as-is (the hook is advisory; the server rejects)', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: 200 },
      mocked: false,
      timestamp: 1,
    });

    const result = await getGpsSample();

    expect(result).toEqual(expect.objectContaining({ accuracy: 200 }));
  });

  it('surfaces a null accuracy when the OS provides none', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: null },
      mocked: false,
      timestamp: 1,
    });

    const result = await getGpsSample();

    expect(result).toEqual(expect.objectContaining({ accuracy: null }));
  });

  it('returns the {denied:true} sentinel without throwing when permission is denied', async () => {
    mockPerm.mockResolvedValue({ status: 'denied' });

    const result = await getGpsSample();

    expect(result).toEqual({ denied: true });
    expect(mockPos).not.toHaveBeenCalled();
  });

  it('returns {denied:true} for an undetermined permission (any non-granted status)', async () => {
    mockPerm.mockResolvedValue({ status: 'undetermined' });

    const result = await getGpsSample();

    expect(result).toEqual({ denied: true });
    expect(mockPos).not.toHaveBeenCalled();
  });
});
