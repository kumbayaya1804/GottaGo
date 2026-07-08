import { supabase } from '../../lib/supabase';
import type { SubmitInput } from './types';

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
  const { data, error } = await supabase.rpc('submit_location', {
    p_name: input.name,
    p_lat: input.lat,
    p_lng: input.lng,
    p_accuracy_m: input.accuracy,
    p_mocked: input.mocked,
    p_captured_at: new Date(input.timestamp).toISOString(),
    p_policy_tag: input.policyTag,
    p_address: input.address ?? null,
    p_access_sensitivity: input.sensitive ? 'sensitive' : null,
    p_hours: input.hours ?? null,
    p_access_code: input.policyTag === 'code_required' ? (input.accessCode ?? null) : null,
    p_timing_tip: input.timingTip ?? null,
  });
  if (error) throw error;
  return data as string;
}
