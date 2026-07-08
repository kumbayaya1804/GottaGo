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
  hours?: string | null;
  accessCode?: string | null;
  timingTip?: string | null;
}

// ---------------------------------------------------------------------------
// Pending-submission GeoJSON transform (get_my_pending_submissions → map)
// ---------------------------------------------------------------------------

/**
 * A single row from `get_my_pending_submissions` (authed-only; the server scopes
 * to `submitter_id = auth.uid() and status = 'pending'`, D-27 / T-04-14 — there is
 * NO client-side "my submissions" filter). `lat`/`lng` are the st_y/st_x extraction,
 * identical to the published-path readers.
 */
export interface PendingSubmissionRpcRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  policy_tag: string | null;
  confirmation_count: number;
  expires_at: string;
}

/**
 * Properties carried on each pending-pin GeoJSON feature. Unlike the published
 * `LocationFeatureProperties`, these carry verification progress
 * (`confirmationCount` / `expiresAt`) so the pending-status sheet (D-27) reads
 * them without a second fetch.
 */
export interface PendingSubmissionProperties {
  id: string;
  name: string;
  policyTag: string | null;
  confirmationCount: number;
  expiresAt: string;
}

/** A single GeoJSON Point feature for one pending submission. Coordinates are [lng, lat]. */
export interface PendingSubmissionFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: PendingSubmissionProperties;
}

/**
 * The FeatureCollection fed to the map's separate pending `ShapeSource`. Mirrors
 * `LocationFeatureCollection`'s shape but with pending-specific properties.
 */
export interface PendingSubmissionFeatureCollection {
  type: 'FeatureCollection';
  features: PendingSubmissionFeature[];
}
