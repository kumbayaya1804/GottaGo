/**
 * Phase 3 location data-layer types.
 *
 * Two parallel families of shapes:
 *   - `*RpcRow` — snake_case rows exactly as the Supabase RPCs return them
 *     (mirrors `search_locations_bbox`, `search_locations_nearby`,
 *     `get_location_detail`). These are the wire shapes the hooks map FROM.
 *   - camelCase public shapes (`MapLocation`, `NearbyLocation`, `LocationDetail`)
 *     — what the client renders. These deliberately OMIT any door-code field
 *     (D-24 / T-03-10): Phase 3 RPCs never return one, and the client must
 *     never carry one.
 *
 * `LocationDetail.distanceM` is sourced from the RPC's server-computed
 * `distance_m` (ST_Distance, meters). It is `null` unless the caller forwarded
 * their own coordinates to `get_location_detail`.
 */

// ---------------------------------------------------------------------------
// snake_case RPC row shapes (wire format)
// ---------------------------------------------------------------------------

/** A single row from `search_locations_bbox`. */
export interface BboxRpcRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  policy_tag: string | null;
  confidence_tier: string | null;
  verification_count: number | null;
  last_verified_at: string | null;
  is_open_now: boolean | null;
  chill_spot: boolean | null;
}

/** A single row from `search_locations_nearby` (bbox row + server distance). */
export interface NearbyRpcRow extends BboxRpcRow {
  distance_m: number;
}

/**
 * The single row `get_location_detail` returns (RPC returns a one-element set).
 * `distance_m` is null unless user coords were supplied. NO access-code field.
 */
export interface LocationDetailRpcRow extends BboxRpcRow {
  address: string | null;
  hours: unknown;
  distance_m: number | null;
}

// ---------------------------------------------------------------------------
// camelCase public shapes (render format)
// ---------------------------------------------------------------------------

/** Public-safe map pin shape. Never contains a door code. */
export interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  policyTag: string | null;
  confidenceTier: string | null;
  verificationCount: number;
  lastVerifiedAt: string | null;
  isOpenNow: boolean;
  chillSpot: boolean;
}

/** A nearby-list entry: a map location plus a non-null server distance. */
export interface NearbyLocation extends MapLocation {
  distanceM: number;
}

/**
 * Full detail shape for the LocationDetail bottom sheet. `distanceM` is null
 * when the caller did not forward coordinates. NO access-code field (D-24).
 */
export interface LocationDetail extends MapLocation {
  address: string | null;
  hours: unknown;
  distanceM: number | null;
}

// ---------------------------------------------------------------------------
// GeoJSON transform target (bbox → Mapbox ShapeSource)
// ---------------------------------------------------------------------------

/** Properties carried on each GeoJSON pin feature (drives the Mapbox `match`). */
export interface LocationFeatureProperties {
  id: string;
  name: string;
  policyTag: string | null;
  confidenceTier: string | null;
  verificationCount: number;
  lastVerifiedAt: string | null;
  isOpenNow: boolean;
  chillSpot: boolean;
}

/** A single GeoJSON Point feature for one location. Coordinates are [lng, lat]. */
export interface LocationFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: LocationFeatureProperties;
}

/** The FeatureCollection fed to the Mapbox `ShapeSource`. */
export interface LocationFeatureCollection {
  type: 'FeatureCollection';
  features: LocationFeature[];
}

// ---------------------------------------------------------------------------
// Shared live-coordinate type
// ---------------------------------------------------------------------------

/**
 * The caller's live coordinates, or `null` when unknown (permission
 * denied/undetermined or before the first GPS fix). Produced by
 * `useCurrentPosition` and forwarded into `useLocationDetail` / `useNearby`.
 */
export type CurrentPosition = { userLat: number; userLng: number } | null;
