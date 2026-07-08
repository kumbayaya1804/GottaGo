import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import type { SubmitInput } from './types';

type SubmitLocationArgs = Database['public']['Functions']['submit_location']['Args'];

/**
 * Submits a new bathroom location via the `submit_location` SECURITY DEFINER RPC.
 *
 * Maps `sensitive` to `p_access_sensitivity` ('sensitive' | null, D-09) and forwards
 * `accessCode` only when `policyTag === 'code_required'` (D-17). The server independently
 * re-validates GPS accuracy/freshness/mock-detection (Pitfall 1) — any rejection error
 * (including the generic 'gps rejected') is rethrown unchanged; the wizard maps it to
 * locked friendly copy (SC7), not this layer.
 */
export async function submitLocation(input: SubmitInput): Promise<string> {
  // p_accuracy_m has no SQL DEFAULT (required arg) but the column/param IS nullable at
  // the Postgres level — the RPC explicitly checks `p_accuracy_m is null` (SC2/SC7).
  // The generated Args type omits `| null` for required args, so a targeted cast is
  // needed here; every other field below is truly optional (has a SQL DEFAULT NULL)
  // and uses `?? undefined` so omitting the key triggers that same default.
  const args: SubmitLocationArgs = {
    p_name: input.name,
    p_lat: input.lat,
    p_lng: input.lng,
    p_accuracy_m: input.accuracy as SubmitLocationArgs['p_accuracy_m'],
    p_mocked: input.mocked,
    p_captured_at: new Date(input.timestamp).toISOString(),
    p_policy_tag: input.policyTag,
    p_address: input.address ?? undefined,
    p_access_sensitivity: input.sensitive ? 'sensitive' : undefined,
    p_hours: input.hours ?? undefined,
    p_access_code: input.policyTag === 'code_required' ? (input.accessCode ?? undefined) : undefined,
    p_timing_tip: input.timingTip ?? undefined,
  };
  const { data, error } = await supabase.rpc('submit_location', args);
  if (error) throw error;
  return data as string;
}
