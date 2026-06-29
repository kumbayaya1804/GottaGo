import { supabase } from '../../lib/supabase';

/** Constraint name for the case-insensitive display name unique index (Pattern 5). */
const DISPLAY_NAME_UNIQUE_CONSTRAINT = 'users_display_name_lower_uniq';

/** Postgres unique-violation error code. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Checks whether a display name is available for use.
 *
 * Calls the `check_display_name_available` SECURITY DEFINER RPC (accessible
 * by anon + authenticated) which returns true if the name is free, false if taken.
 * The DB unique index is the hard race-safe backstop; this provides UX feedback.
 *
 * @param name - the display name to check (case-insensitive comparison done server-side)
 * @returns Promise<boolean> — true if available, false if taken
 * @throws if the RPC returns an error
 */
export async function checkDisplayNameAvailable(name: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_display_name_available', { name });
  if (error) throw error;
  return Boolean(data);
}

/**
 * Returns true if the given error is a Postgres unique-violation (code 23505)
 * specifically on the display_name lower-case unique index.
 *
 * Used at sign-up to map the DB constraint error to the friendly copy
 * "That display name is already taken." (UI-SPEC §15).
 *
 * @param error - any caught value from a Supabase/DB call
 */
export function isDisplayNameTakenError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  return (
    e['code'] === PG_UNIQUE_VIOLATION &&
    typeof e['message'] === 'string' &&
    e['message'].includes(DISPLAY_NAME_UNIQUE_CONSTRAINT)
  );
}
