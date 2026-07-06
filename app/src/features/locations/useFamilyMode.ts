import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';

/**
 * User-scoped TanStack Query key for the family_mode read. Scoping by user id
 * prevents one signed-in user's cached family_mode from leaking to the next user
 * in the same app-lifetime QueryClient (Codex WU-02-T5 / T-03-08).
 */
export function familyModeQueryKey(userId: string | undefined) {
  return ['familyMode', userId] as const;
}

/**
 * Reads the given user's `family_mode` flag from `public.users`. The
 * `users_select_own` RLS policy restricts the row server-side to auth.uid()=id,
 * so the passed userId only tells Postgres which row to look at. Defaults to
 * false when the value is null/missing. Throws on error.
 */
export async function getFamilyMode(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('family_mode')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data?.family_mode ?? false;
}

/**
 * Writes ONLY `new_family_mode` via the `update_profile` SECURITY DEFINER RPC.
 * Because 03-01's `update_profile` coalesces both columns and defaults
 * `new_display_name` to null, omitting it here leaves the display name untouched
 * (T-03-09). Throws on error.
 */
export async function setFamilyMode(value: boolean): Promise<void> {
  const { error } = await supabase.rpc('update_profile', { new_family_mode: value });
  if (error) throw error;
}

export interface UseFamilyModeResult {
  /** Current family_mode value (false until loaded / when signed out). */
  familyMode: boolean;
  isLoading: boolean;
  isError: boolean;
  /** Persists a new family_mode value and refreshes the cached read. */
  setFamilyMode: (value: boolean) => Promise<void>;
  isSaving: boolean;
}

/**
 * Reads + writes the signed-in user's family_mode with a user-id-scoped query
 * key (`enabled` only when signed in). The write posts just `new_family_mode`.
 */
export function useFamilyMode(): UseFamilyModeResult {
  const sessionCtx = useSession();
  const session = sessionCtx?.session ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: familyModeQueryKey(session?.user.id),
    queryFn: () => getFamilyMode(session!.user.id),
    enabled: session !== null,
  });

  const mutation = useMutation({
    mutationFn: setFamilyMode,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: familyModeQueryKey(session?.user.id),
      });
    },
  });

  return {
    familyMode: query.data ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    setFamilyMode: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
