import { supabase } from '../../lib/supabase';
import { toMapLocation } from './useLocationsBbox';
import type { LocationDetail, LocationDetailRpcRow } from './types';

/**
 * Fetches a single location via `get_location_detail`. When the caller knows
 * the user's position it forwards `user_lat`/`user_lng`, and the RPC returns a
 * server-computed `distance_m` mapped here to `distanceM` (null when coords are
 * omitted). The result NEVER carries a door-code / access-code field (D-24):
 * the Phase 3 RPC does not return one, and this mapper only copies public
 * fields. Throws on RPC error or when no row is found.
 */
export async function useLocationDetail(
  id: string,
  userLat?: number,
  userLng?: number,
): Promise<LocationDetail> {
  const coordsProvided = [userLat, userLng].every((c) => c !== undefined);
  const args = coordsProvided
    ? { location_id: id, user_lat: userLat, user_lng: userLng }
    : { location_id: id };

  const { data, error } = await supabase.rpc('get_location_detail', args);
  if (error) throw error;

  const rows = (data ?? []) as unknown as LocationDetailRpcRow[];
  const row = rows[0];
  if (!row) throw new Error('Location not found');

  return {
    ...toMapLocation(row),
    address: row.address,
    hours: row.hours,
    distanceM: row.distance_m ?? null,
  };
}
