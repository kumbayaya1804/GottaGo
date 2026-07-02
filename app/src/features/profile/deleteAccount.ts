import { supabase } from '../../lib/supabase';

/**
 * Deletes the signed-in user's account via the `delete_account` SECURITY DEFINER RPC.
 *
 * This module does NOT navigate on success — the `SIGNED_OUT` auth event fired once the
 * RPC revokes the session is already handled by SessionProvider (02-01), which drives the
 * redirect to Welcome.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
}
