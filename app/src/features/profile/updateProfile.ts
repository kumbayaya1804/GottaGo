import { supabase } from '../../lib/supabase';
import { isDisplayNameTakenError } from '../auth/displayName';

/** Friendly copy shown when a display name collides with the unique index (UI-SPEC §15). */
export const DISPLAY_NAME_TAKEN_MESSAGE = 'That display name is already taken.';

/**
 * Persists `displayName` to `public.users` via the `update_profile` SECURITY DEFINER RPC.
 *
 * Maps a Postgres unique-violation (23505 on the display_name lower-case index) to a
 * friendly error message; any other RPC error is rethrown as-is.
 */
export async function updateProfile(displayName: string): Promise<void> {
  const { error } = await supabase.rpc('update_profile', { new_display_name: displayName });
  if (error) {
    if (isDisplayNameTakenError(error)) {
      throw new Error(DISPLAY_NAME_TAKEN_MESSAGE);
    }
    throw error;
  }
}
