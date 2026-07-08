/**
 * Phase 4 submission service-layer types.
 *
 * These shapes back the client-side SubmitFlow building blocks:
 *   - `GpsSample` — the high-accuracy GPS reading produced by `getGpsSample`
 *     (canonical coordinate source per D-05; the server re-validates it).
 *   - `SubmitInput` — the flattened wizard payload `submitLocation` maps into the
 *     `submit_location` RPC's `p_*` arguments.
 *
 * The coordinate is carried as a plain `{lat, lng}` here; the RPC converts it to a
 * PostGIS `geography(Point,4326)` server-side (schema-contract Coordinate Handling).
 */

/**
 * A single high-accuracy GPS sample. `accuracy` is the OS-reported radius in meters
 * (may be `null`). `mocked` is the Android mock-provider flag normalized to `false`
 * on iOS (where `LocationObject.mocked` is `undefined`). `timestamp` is ms since epoch.
 */
export interface GpsSample {
  coord: { lat: number; lng: number };
  accuracy: number | null;
  mocked: boolean;
  timestamp: number;
}

/** Returned by `getGpsSample` when foreground-location permission is not granted. */
export interface GpsDenied {
  denied: true;
}

/**
 * The flattened SubmitFlow payload consumed by `submitLocation`.
 *
 * `sensitive` maps to `p_access_sensitivity` = `'sensitive' | null` (D-09).
 * `accessCode` is forwarded only when `policyTag === 'code_required'` (D-17).
 * `timestamp` (ms since epoch, from the GPS sample) is serialized to an ISO string
 * for the RPC's `p_captured_at` freshness check.
 */
export interface SubmitInput {
  name: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  mocked: boolean;
  timestamp: number;
  policyTag: string;
  address?: string | null;
  sensitive: boolean;
  hours?: Record<string, string> | null;
  accessCode?: string | null;
  timingTip?: string | null;
}
