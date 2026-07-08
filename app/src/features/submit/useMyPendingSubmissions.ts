import { supabase } from '../../lib/supabase';
import type {
  PendingSubmissionFeatureCollection,
  PendingSubmissionRpcRow,
} from './types';

/**
 * Fetches the signed-in user's pending submissions via the authed-only
 * `get_my_pending_submissions` RPC and transforms the rows into a GeoJSON
 * FeatureCollection for the map's separate pending `ShapeSource`.
 *
 * Scoping is entirely server-side (`submitter_id = auth.uid()`, 04-01 / T-04-14):
 * this call takes NO arguments and applies no client-side "my submissions" filter,
 * which would leak. Point coordinates are `[lng, lat]` (GeoJSON order), matching the
 * published bbox layer. Each feature carries `confirmationCount` + `expiresAt` in its
 * properties so the pending-status sheet (D-27) needs no second fetch. Throws when the
 * RPC errors.
 */
export async function useMyPendingSubmissions(): Promise<PendingSubmissionFeatureCollection> {
  const { data, error } = await supabase.rpc('get_my_pending_submissions');
  if (error) throw error;

  const rows = (data ?? []) as unknown as PendingSubmissionRpcRow[];

  return {
    type: 'FeatureCollection',
    features: rows.map((row) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [row.lng, row.lat],
      },
      properties: {
        id: row.id,
        name: row.name,
        policyTag: row.policy_tag,
        confirmationCount: row.confirmation_count,
        expiresAt: row.expires_at,
      },
    })),
  };
}
