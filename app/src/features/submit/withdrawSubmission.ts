import { supabase } from '../../lib/supabase';

/**
 * Withdraws one of the signed-in user's pending submissions via the
 * `withdraw_submission` SECURITY DEFINER RPC (D-28 / D-29), scoped server-side to the
 * caller's own pending submission (`submitter_id = auth.uid()`, 04-01) — this wrapper
 * cannot bypass that scoping. As of Phase 5 (D-58) the server only hard-deletes the row
 * when it has no verification event; a row with an existing verification event is moved
 * to `cancelled` instead (row + events retained) so the verifier's event still counts
 * toward their own trust ramp.
 *
 * This module does NOT navigate or refetch on success — the caller invalidates the
 * `['pendingSubmissions', uid]` query (04-06). Any RPC error is rethrown raw.
 */
export async function withdrawSubmission(submissionId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_submission', {
    p_submission_id: submissionId,
  });
  if (error) throw error;
}
