import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../auth/useSession';
import { unseenPublicationsKey } from '../submit/useMySubmissionPublications';
import type { VerifyCandidate } from './types';
import { verifyLocation } from './verifyLocation';

/**
 * Submits a verification and, when the server accepts it, marks the caches it changes
 * as out of date: nearby candidates, the user's pending submissions, their unseen
 * publications, and their profile stats.
 *
 * Each key is prefixed with the signed-in user id, the namespace the queries register
 * under, so only this account's entries are touched (Phase 2 standing rule).
 */
export function useVerify() {
  const userId = useSession()?.session?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyLocation,
    onSuccess: async (result, input) => {
      // A rejection changes nothing on the server, so there is nothing to refresh.
      if (!result.accepted) return;

      // Candidates: remove the verified bathroom locally and do NOT invalidate. Every
      // discovery call restarts a short server cooldown and a call inside it returns no
      // rows, so any refetch soon after — including the one an invalidated query makes
      // when the list remounts — could show a false "Nothing to verify nearby". Writing
      // the filtered list also restamps it as fresh, so it is reused for the normal
      // freshness window (CANDIDATES_FRESH_MS) and only then fetched again.
      queryClient.setQueriesData<VerifyCandidate[]>({ queryKey: ['verifyCandidates', userId] }, (list) =>
        list?.filter((candidate) => candidate.id !== input.submissionId),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pendingSubmissions', userId] }),
        queryClient.invalidateQueries({ queryKey: unseenPublicationsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['profileStats', userId] }),
      ]);
    },
  });
}
