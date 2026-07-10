import { supabase } from '../../lib/supabase';
import { toMapLocation } from './useLocationsBbox';
import type { NearbyLocation, NearbyRpcRow } from './types';

/** snake_case filter params for the nearby RPC (see BboxRpcFilters). */
export interface NearbyRpcFilters {
  result_limit?: number;
  filter_open_now?: boolean;
  filter_chill_spot?: boolean;
  filter_wheelchair?: boolean;
  filter_changing?: boolean;
  filter_high_conf?: boolean;
}

/**
 * Fetches the nearest locations to `userLat`/`userLng` via
 * `search_locations_nearby`. The RPC returns rows already ordered ascending by
 * `<->` KNN distance; this maps them to camelCase `NearbyLocation` (carrying
 * `distanceM`) preserving that order. Throws when the RPC errors.
 */
export async function fetchNearby(
  userLat: number,
  userLng: number,
  filters: NearbyRpcFilters = {},
): Promise<NearbyLocation[]> {
  const { data, error } = await supabase.rpc('search_locations_nearby', {
    user_lat: userLat,
    user_lng: userLng,
    ...filters,
  });
  if (error) throw error;

  const rows = (data ?? []) as unknown as NearbyRpcRow[];
  return rows.map((row) => ({
    ...toMapLocation(row),
    distanceM: row.distance_m,
  }));
}
