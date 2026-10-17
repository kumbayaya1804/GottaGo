import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import type { VerifyInput, VerifyResult } from './types';

type VerifyLocationArgs = Database['public']['Functions']['verify_location']['Args'];

/**
 * Submits a GPS verification of a pending submission via the `verify_location`
 * SECURITY DEFINER RPC.
 *
 * The server re-validates the GPS reading (accuracy, freshness, mock flag, distance)
 * and answers every expected rejection with a reason-free `{ accepted: false }`. It
 * returns instead of raising so its per-user cooldown write commits. This wrapper keeps
 * that contract: it returns only `{ accepted }` and rethrows transport or system errors
 * unchanged. The wizard maps both to the one generic rejection copy (SC7); no rejection
 * reason exists at this layer or above it.
 */
export async function verifyLocation(input: VerifyInput): Promise<VerifyResult> {
  // p_accuracy_m is a required arg but nullable at the Postgres level (the RPC checks
  // `p_accuracy_m is null`); the generated Args type omits `| null`, hence the cast.
  const args: VerifyLocationArgs = {
    p_submission_id: input.submissionId,
    p_lat: input.lat,
    p_lng: input.lng,
    p_accuracy_m: input.accuracy as VerifyLocationArgs['p_accuracy_m'],
    p_mocked: input.mocked,
    p_captured_at: new Date(input.timestamp).toISOString(),
  };
  const { data, error } = await supabase.rpc('verify_location', args);
  // Rethrown raw: the wizard, not this layer, maps every failure to the one generic copy.
  if (error) throw error;
  // Only `accepted` crosses this boundary. Building a fresh object means nothing else
  // in the payload can ever reach the UI as a rejection reason (SC7).
  return { accepted: (data as { accepted?: unknown } | null)?.accepted === true };
}
