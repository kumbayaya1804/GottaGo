import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounced map-viewport → bbox state for MapScreen (D-01/D-03/D-04).
 *
 * MapScreen wires `onRegionChange` to the Mapbox `MapView`'s region-change event.
 * Rapid pan/zoom events are coalesced: the committed `viewport` (and `zoom` /
 * `belowPinThreshold`) only update once, VIEWPORT_DEBOUNCE_MS after motion stops
 * (D-01). The committed viewport lives for the hook's lifetime and resets only on
 * remount / cold start (D-03) — the hook holds no persistence itself.
 *
 * `belowPinThreshold` is derived from the committed zoom vs the pin cutoff
 * (D-04/D-32): when true, MapScreen shows "Zoom in to see individual locations"
 * and skips fetching pins instead of rendering a misleadingly sparse subset.
 */

/** The bbox MapScreen forwards into `useLocationsBbox`. */
export interface MapBbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * The subset of the rnmapbox region-change payload this hook consumes.
 * `visibleBounds` is `[[maxLng, maxLat] (NE), [minLng, minLat] (SW)]` per the SDK.
 */
export interface MapRegionFeature {
  properties: {
    visibleBounds: [[number, number], [number, number]];
    zoomLevel: number;
  };
}

/** Milliseconds of stillness before a region change is committed (D-01). */
export const VIEWPORT_DEBOUNCE_MS = 400;

/**
 * Zoom levels below this show the "Zoom in to see individual locations" card
 * instead of pins (D-04). Derived from the max-pins-per-viewport cap (D-32): at
 * far zoom-outs the viewport would exceed the pin cap, so pins are suppressed
 * rather than shown as a sparse, misleading subset. Tunable alongside app_config.
 */
export const PIN_ZOOM_CUTOFF = 11;

export interface MapViewportState {
  /** Committed viewport bbox, or null before the first settled region change. */
  viewport: MapBbox | null;
  /** Committed zoom level, or null before the first settled region change. */
  zoom: number | null;
  /** True when the committed zoom is below PIN_ZOOM_CUTOFF (suppress pins). */
  belowPinThreshold: boolean;
  /** Feed each Mapbox region-change event here; commits are debounced. */
  onRegionChange: (region: MapRegionFeature) => void;
}

export function useMapViewport(): MapViewportState {
  const [viewport, setViewport] = useState<MapBbox | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [belowPinThreshold, setBelowPinThreshold] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRegionChange = useCallback((next: MapRegionFeature) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      const [[maxLng, maxLat], [minLng, minLat]] = next.properties.visibleBounds;
      const z = next.properties.zoomLevel;
      setViewport({ minLng, minLat, maxLng, maxLat });
      setZoom(z);
      setBelowPinThreshold(z < PIN_ZOOM_CUTOFF);
      timerRef.current = null;
    }, VIEWPORT_DEBOUNCE_MS);
  }, []);

  // Cancel any pending debounce on unmount so a late timer never updates state
  // on an unmounted screen.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { viewport, zoom, belowPinThreshold, onRegionChange };
}
