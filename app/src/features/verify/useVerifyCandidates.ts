import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import type { VerifyCandidate, VerifyCandidateRpcRow } from './types';

/**
 * How long a fetched candidate list is treated as fresh. Longer than the server's
 * discovery cooldown (`verify_cooldown_s`, seeded at 3 seconds), so reopening the list
 * never spends a call that the server would answer with zero rows.
 */
export const CANDIDATES_FRESH_MS = 10_000;

/**
 * How long to wait after a discovery call before making another one. Longer than the
 * server's discovery cooldown (`verify_cooldown_s`, seeded at 3 seconds), which every
 * call claims before it answers, even a call whose response never arrives.
 */
export const DISCOVERY_COOLDOWN_MS = 4_000;

/** The position a candidate search is made from. */
export interface VerifyCoords {
  userLat: number;
  userLng: number;
}

/**
 * Fetches the pending submissions near `userLat`/`userLng` that the signed-in user
 * may verify, via the authed-only `search_pending_submissions_nearby` RPC.
 *
 * The RPC returns rows already ordered nearest-first (`<->` KNN) and already excludes
 * the caller's own submissions and ones the caller has verified; this maps them to
 * camelCase `VerifyCandidate` preserving that order.
 */
export async function fetchVerifyCandidates(userLat: number, userLng: number): Promise<VerifyCandidate[]> {
  const { data, error } = await supabase.rpc('search_pending_submissions_nearby', {
    user_lat: userLat,
    user_lng: userLng,
  });
  if (error) throw error;

  const rows = (data ?? []) as unknown as VerifyCandidateRpcRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    policyTag: row.policy_tag,
    distanceM: row.distance_m,
  }));
}

/**
 * Query key for a user's candidate list. The user id comes first so every entry is
 * scoped to one account: the QueryClient lives for the whole app session, and an
 * unscoped key would serve one account's candidates to the next (Phase 2 standing rule).
 */
export function verifyCandidatesKey(userId: string | undefined, coords: VerifyCoords | null) {
  return ['verifyCandidates', userId, coords?.userLat, coords?.userLng] as const;
}

/**
 * Candidate list for the signed-in user at `coords`. Disabled until there is both a
 * signed-in user and a position.
 */
export function useVerifyCandidates(coords: VerifyCoords | null) {
  const userId = useSession()?.session?.user.id;

  return useQuery({
    queryKey: verifyCandidatesKey(userId, coords),
    queryFn: () => fetchVerifyCandidates(coords!.userLat, coords!.userLng),
    enabled: !!userId && coords !== null,
    // The server rate-limits discovery per user: every call, allowed or not, restarts a
    // short cooldown, and a call made inside it returns zero rows. An automatic retry
    // would land inside that window and turn a failure into a false "nothing nearby".
    retry: false,
    // Nor may reopening the screen retry a failed load by itself: that call would skip
    // the screen's cooldown-aware Retry and could land inside the cooldown the failed
    // call already claimed. A failed list stays failed until the user presses Retry.
    retryOnMount: false,
    // For the same reason a list this recent is reused when the screen is reopened.
    staleTime: CANDIDATES_FRESH_MS,
  });
}
