import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import type { UnseenPublication, UnseenPublicationRpcRow } from './types';

/**
 * Fetches the signed-in user's published-but-not-yet-seen submissions via the
 * authed-only `get_my_unseen_submission_publications` RPC (D-68).
 *
 * Scoping is entirely server-side (`submitter_id = auth.uid()`): the call takes no
 * arguments, so there is no user id for a client to get wrong.
 */
export async function fetchMyUnseenPublications(): Promise<UnseenPublication[]> {
  const { data, error } = await supabase.rpc('get_my_unseen_submission_publications');
  if (error) throw error;

  const rows = (data ?? []) as unknown as UnseenPublicationRpcRow[];
  return rows.map((row) => ({
    submissionId: row.submission_id,
    locationId: row.location_id,
    name: row.name,
    publishedAt: row.published_at,
  }));
}

/**
 * Marks one of the signed-in user's publications as seen via the authed-only
 * `acknowledge_submission_publication` RPC, so it is not shown again.
 *
 * The server matches on `submitter_id = auth.uid()`: acknowledging a submission the
 * caller does not own updates no row and reveals nothing about it.
 */
export async function acknowledgePublication(submissionId: string): Promise<void> {
  const { error } = await supabase.rpc('acknowledge_submission_publication', {
    p_submission_id: submissionId,
  });
  if (error) throw error;
}

/**
 * Query key for a user's unseen publications. The user id scopes every entry to one
 * account: the QueryClient lives for the whole app session, and an unscoped key would
 * show one account's publications to the next (Phase 2 standing rule).
 */
export function unseenPublicationsKey(userId: string | undefined) {
  return ['unseenPublications', userId] as const;
}

/** How often to re-ask while the user has (or may have) pending submissions. */
export const PUBLICATIONS_POLL_MS = 60_000;

/**
 * How often to re-ask when the user's pending list loaded empty. Empty now is not empty
 * forever (they can submit from another device while this screen stays open), so the
 * check slows down rather than stopping.
 */
export const PUBLICATIONS_IDLE_POLL_MS = 5 * 60_000;

/**
 * The signed-in user's unseen publications. Disabled without a signed-in user.
 *
 * `pollMs`: re-ask on this interval. A submission is published by someone else's
 * verification, which nothing in this app session observes, so without a refresh a
 * creator who keeps the Map open would never see "Published!" when push does not
 * arrive (D-68).
 */
export function useMySubmissionPublications(options: { pollMs?: number } = {}) {
  const userId = useSession()?.session?.user.id;

  return useQuery({
    queryKey: unseenPublicationsKey(userId),
    queryFn: fetchMyUnseenPublications,
    enabled: !!userId,
    refetchInterval: options.pollMs ?? false,
  });
}
