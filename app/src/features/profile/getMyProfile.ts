import { supabase } from '../../lib/supabase';

export interface MyProfile {
  displayName: string | null;
}

/**
 * Fetches the signed-in user's own `display_name` from `public.users`.
 *
 * Safe as a direct table query (unlike profileStats' `ratings` case): the
 * `users_select_own` RLS policy restricts returned rows to `auth.uid() = id`
 * server-side regardless of the `userId` passed here — the client is not
 * trusted as the enforcement boundary.
 */
export async function getMyProfile(userId: string): Promise<MyProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single();
  if (error) throw error;

  return { displayName: data?.display_name ?? null };
}
