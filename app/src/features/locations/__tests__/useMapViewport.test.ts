/**
 * Unit tests for useMapViewport — the debounced viewport→bbox + zoom-out cutoff
 * hook that drives MapScreen's bbox refetch. Pure logic (no Mapbox render), so it
 * carries the 100% coverage gate under src/features/**.
 *
 * D-01: coalesce rapid region changes into ONE bbox commit 400ms after motion stops.
 * D-04/D-32: expose belowPinThreshold when zoomed out past the pin cutoff.
 * D-03: viewport persists for the hook's lifetime; resets only on remount.
 */
import { act, renderHook } from '@testing-library/react-native';
import {
  useMapViewport,
  PIN_ZOOM_CUTOFF,
  VIEWPORT_DEBOUNCE_MS,
  type MapRegionFeature,
} from '../useMapViewport';

/**
 * Builds an rnmapbox region-change payload. `visibleBounds` is
 * [[maxLng, maxLat] /* NE *\/, [minLng, minLat] /* SW *\/] per the SDK.
 */
function region(
  maxLng: number,
  maxLat: number,
  minLng: number,
  minLat: number,
  zoomLevel: number,
): MapRegionFeature {
  return { properties: { visibleBounds: [[maxLng, maxLat], [minLng, minLat]], zoomLevel } };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('useMapViewport', () => {
  it('starts with a null viewport and no threshold flag', () => {
    const { result } = renderHook(() => useMapViewport());
    expect(result.current.viewport).toBeNull();
    expect(result.current.zoom).toBeNull();
    expect(result.current.belowPinThreshold).toBe(false);
  });

  it('commits the region bbox only after the 400ms debounce elapses', () => {
    const { result } = renderHook(() => useMapViewport());

    act(() => {
      result.current.onRegionChange(region(-123.08, 44.06, -123.1, 44.04, 14));
    });

    // Before the debounce fires, nothing is committed.
    act(() => {
      jest.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS - 1);
    });
    expect(result.current.viewport).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.viewport).toEqual({
      minLng: -123.1,
      minLat: 44.04,
      maxLng: -123.08,
      maxLat: 44.06,
    });
    expect(result.current.zoom).toBe(14);
    expect(result.current.belowPinThreshold).toBe(false);
  });

  it('coalesces rapid region changes into a single bbox commit (last one wins)', () => {
    const { result } = renderHook(() => useMapViewport());

    act(() => {
      result.current.onRegionChange(region(-1, 1, -2, 0, 14));
      jest.advanceTimersByTime(100);
      result.current.onRegionChange(region(-10, 10, -20, 0, 14));
      jest.advanceTimersByTime(100);
      result.current.onRegionChange(region(-100, 50, -200, 40, 14));
    });

    // Only 100ms since the last change — still no commit.
    act(() => {
      jest.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS - 1);
    });
    expect(result.current.viewport).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    // The last region is the only one applied.
    expect(result.current.viewport).toEqual({
      minLng: -200,
      minLat: 40,
      maxLng: -100,
      maxLat: 50,
    });
  });

  it('flips belowPinThreshold true when the committed zoom is below the cutoff', () => {
    const { result } = renderHook(() => useMapViewport());

    act(() => {
      result.current.onRegionChange(region(-123.0, 44.2, -123.4, 43.9, PIN_ZOOM_CUTOFF - 1));
      jest.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    });

    expect(result.current.belowPinThreshold).toBe(true);
    expect(result.current.zoom).toBe(PIN_ZOOM_CUTOFF - 1);
  });

  it('clears a pending debounce timer on unmount (no late commit)', () => {
    const { result, unmount } = renderHook(() => useMapViewport());

    act(() => {
      result.current.onRegionChange(region(-1, 1, -2, 0, 14));
    });
    // Unmount while the timer is still pending.
    unmount();

    // Advancing past the debounce must NOT throw or apply a late update.
    act(() => {
      jest.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    });
    expect(result.current.viewport).toBeNull();
  });

  it('unmounts cleanly after the timer has already fired', () => {
    const { result, unmount } = renderHook(() => useMapViewport());

    act(() => {
      result.current.onRegionChange(region(-1, 1, -2, 0, 14));
      jest.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    });
    expect(result.current.viewport).not.toBeNull();

    // Cleanup with no pending timer — exercises the null-timer cleanup branch.
    expect(() => unmount()).not.toThrow();
  });
});
