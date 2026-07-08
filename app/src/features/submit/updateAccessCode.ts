import { supabase } from '../../lib/supabase';

/**
 * Access-code (PIN) client wrappers for the D-21 / D-24 stage-then-confirm flow.
 *
 * These are thin `supabase.rpc` wrappers — they carry NO business logic. In particular
 * `updateAccessCode` only STAGES a new code; it does NOT make it live. The
 * different-user promotion gate (D-24) is enforced server-side (04-02) and cannot be
 * bypassed from the client (T-04-15). No code value is ever logged (T-04-16).
 */

/**
 * Stages a new access code for `locationId` via `update_access_code`. The code is not
 * live until `confirmAccessCode` promotes it (subject to the server-side gate). Any RPC
 * error is rethrown raw.
 */
export async function updateAccessCode(locationId: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('update_access_code', {
    p_location_id: locationId,
    p_code: code,
  });
  if (error) throw error;
}

/**
 * Promotes the staged access code for `locationId` via `confirm_access_code`. The
 * different-user gate is server-side. Any RPC error is rethrown raw.
 */
export async function confirmAccessCode(locationId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_access_code', {
    p_location_id: locationId,
  });
  if (error) throw error;
}

/**
 * Reads the current access code for `locationId` via the authed-only `get_access_code`
 * RPC, returning it as a string for the signed-in UI only (never logged, T-04-16). Any
 * RPC error is rethrown raw.
 */
export async function getAccessCode(locationId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_access_code', {
    p_location_id: locationId,
  });
  if (error) throw error;
  return data as string;
}
