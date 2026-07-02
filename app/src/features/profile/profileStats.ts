import { supabase } from '../../lib/supabase';

export interface ProfileStats {
  gpsVerifications: number;
  locationsSubmitted: number;
  ratingsGiven: number;
}

interface GetProfileStatsRpcResult {
  gps_verifications: number | null;
  locations_submitted: number | null;
  ratings_given: number | null;
}

/**
 * Fetches profile stats for the signed-in user via the `get_profile_stats`
 * SECURITY DEFINER RPC.
 *
 * The RPC derives the user from `auth.uid()` server-side rather than accepting a
 * caller-supplied id — this also sidesteps the fact that `ratings` base-table SELECT
 * is revoked from `authenticated`/`anon` (20260624000002_ratings_privacy_fix.sql), so
 * a direct client-side query against `ratings` would 42501 at runtime.
 */
export async function profileStats(): Promise<ProfileStats> {
  const { data, error } = await supabase.rpc('get_profile_stats');
  if (error) throw error;

  const stats = data as unknown as GetProfileStatsRpcResult;

  return {
    gpsVerifications: stats.gps_verifications ?? 0,
    locationsSubmitted: stats.locations_submitted ?? 0,
    ratingsGiven: stats.ratings_given ?? 0,
  };
}
