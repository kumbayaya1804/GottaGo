import { supabase } from '../../lib/supabase';
import type {
  BboxRpcRow,
  LocationFeatureCollection,
  MapLocation,
} from './types';

/** Map viewport bounds passed to the bbox RPC. */
export interface BboxViewport {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * snake_case RPC filter params, as produced by the filters store's
 * `activeRpcFilters()`. All optional — an omitted filter means "not active"
 * and the RPC applies its D-08 null-inclusive default.
 */
export interface BboxRpcFilters {
  filter_open_now?: boolean;
  filter_chill_spot?: boolean;
  filter_wheelchair?: boolean;
  filter_changing?: boolean;
  filter_high_conf?: boolean;
  max_pins?: number;
}

/**
 * Maps a snake_case location row (shared by bbox / nearby / detail RPCs) to the
 * public camelCase `MapLocation`, applying null-safe display defaults. Exported
 * so `fetchNearby` and `fetchLocationDetail` reuse the identical mapping.
 */
export function toMapLocation(row: BboxRpcRow): MapLocation {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    policyTag: row.policy_tag,
    confidenceTier: row.confidence_tier,
    verificationCount: row.verification_count ?? 0,
    lastVerifiedAt: row.last_verified_at,
    isOpenNow: row.is_open_now ?? false,
    chillSpot: row.chill_spot ?? false,
  };
}

/**
 * Fetches the locations inside `viewport` (with the active filters) via the
 * `search_locations_bbox` RPC and transforms the rows into a GeoJSON
 * FeatureCollection ready for a Mapbox `ShapeSource`. Point coordinates are
 * `[lng, lat]` (GeoJSON order). Throws when the RPC errors.
 */
export async function fetchLocationsBbox(
  viewport: BboxViewport,
  filters: BboxRpcFilters = {},
): Promise<LocationFeatureCollection> {
  const { data, error } = await supabase.rpc('search_locations_bbox', {
    min_lng: viewport.minLng,
    min_lat: viewport.minLat,
    max_lng: viewport.maxLng,
    max_lat: viewport.maxLat,
    ...filters,
  });
  if (error) throw error;

  const rows = (data ?? []) as unknown as BboxRpcRow[];

  return {
    type: 'FeatureCollection',
    features: rows.map((row) => {
      const loc = toMapLocation(row);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [loc.lng, loc.lat],
        },
        properties: {
          id: loc.id,
          name: loc.name,
          policyTag: loc.policyTag,
          confidenceTier: loc.confidenceTier,
          verificationCount: loc.verificationCount,
          lastVerifiedAt: loc.lastVerifiedAt,
          isOpenNow: loc.isOpenNow,
          chillSpot: loc.chillSpot,
        },
      };
    }),
  };
}
