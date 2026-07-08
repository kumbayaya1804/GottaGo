import { supabase } from '../../lib/supabase';

/**
 * Withdraws one of the signed-in user's pending submissions via the
 * `withdraw_submission` SECURITY DEFINER RPC (D-28 / D-29). The server DELETEs the
 * row only when it is the caller's own pending submission (`submitter_id = auth.uid()`,
 * 04-01) — this wrapper cannot bypass that scoping.
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
