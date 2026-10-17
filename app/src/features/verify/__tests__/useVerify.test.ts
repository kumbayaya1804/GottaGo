/**
 * Tests for useVerify (plan 05-03 Task 2): the mutation that submits a verification
 * and refreshes the caches an accepted verification changes.
 *
 * Every cache it touches is scoped by the signed-in user id, the same namespaces the
 * queries are registered under, so one account's action never disturbs another's
 * entries on the app-lifetime QueryClient (Phase 2 standing rule).
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

let mockUserId: string | undefined;
jest.mock('../../auth/useSession', () => ({
  useSession: () => ({
    session: mockUserId ? { user: { id: mockUserId } } : null,
    loading: false,
  }),
}));

import { useVerify } from '../useVerify';
import { useVerifyCandidates, verifyCandidatesKey } from '../useVerifyCandidates';
import { unseenPublicationsKey } from '../../submit/useMySubmissionPublications';
import type { VerifyCandidate, VerifyInput } from '../types';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

const COORDS = { userLat: 40.7128, userLng: -74.006 };

const INPUT: VerifyInput = {
  submissionId: 'sub-1',
  lat: 40.7128,
  lng: -74.006,
  accuracy: 12,
  mocked: false,
  timestamp: 1_760_000_000_000,
};

function candidate(id: string): VerifyCandidate {
  return { id, name: `Bathroom ${id}`, lat: 40.7129, lng: -74.0061, policyTag: 'public', distanceM: 14 };
}

function makeClient() {
  // gcTime Infinity: no garbage-collection timer is left running to keep jest alive.
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

/** The four user-scoped caches an accepted verification makes out of date. */
function keysFor(userId: string) {
  return {
    candidates: verifyCandidatesKey(userId, COORDS),
    pending: ['pendingSubmissions', userId] as const,
    unseen: unseenPublicationsKey(userId),
    stats: ['profileStats', userId] as const,
  };
}

function seed(client: QueryClient, userId: string) {
  const keys = keysFor(userId);
  client.setQueryData(keys.candidates, [candidate('sub-1'), candidate('sub-2')]);
  client.setQueryData(keys.pending, []);
  client.setQueryData(keys.unseen, []);
  client.setQueryData(keys.stats, { verifications: 0 });
  return keys;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'user-a';
});

describe('useVerify', () => {
  it('marks the pending, unseen-publication and profile-stat caches out of date after an accepted verification, but not the candidate list', async () => {
    const client = makeClient();
    const keys = seed(client, 'user-a');
    mockSupabase.rpc.mockResolvedValue({ data: { accepted: true }, error: null });

    const { result } = renderHook(() => useVerify(), { wrapper: wrapperFor(client) });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync(INPUT);
    });

    expect(outcome).toEqual({ accepted: true });
    // The candidate list is filtered in place, not invalidated: an invalidated list
    // refetches on remount, and a refetch inside the server's discovery cooldown returns
    // zero rows — a false "Nothing to verify nearby".
    expect(client.getQueryState(keys.candidates)?.isInvalidated).toBe(false);
    expect(client.getQueryState(keys.pending)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.unseen)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.stats)?.isInvalidated).toBe(true);
  });

  it('leaves every cache alone when the server does not accept the verification', async () => {
    const client = makeClient();
    const keys = seed(client, 'user-a');
    mockSupabase.rpc.mockResolvedValue({ data: { accepted: false }, error: null });

    const { result } = renderHook(() => useVerify(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    expect(client.getQueryState(keys.candidates)?.isInvalidated).toBe(false);
    expect(client.getQueryState(keys.pending)?.isInvalidated).toBe(false);
    expect(client.getQueryState(keys.unseen)?.isInvalidated).toBe(false);
    expect(client.getQueryState(keys.stats)?.isInvalidated).toBe(false);
  });

  it('drops the verified bathroom from the open list without calling discovery again', async () => {
    // Every discovery call restarts a short server cooldown, and a call made inside it
    // returns no rows. An automatic refetch right after verifying could therefore blank
    // the list the user is looking at.
    const client = makeClient();
    const keys = seed(client, 'user-a');
    mockSupabase.rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'verify_location' ? { data: { accepted: true }, error: null } : { data: [], error: null },
      ),
    );

    const { result } = renderHook(() => ({ list: useVerifyCandidates(COORDS), verify: useVerify() }), {
      wrapper: wrapperFor(client),
    });
    await act(async () => {
      await result.current.verify.mutateAsync(INPUT);
    });

    expect(mockSupabase.rpc).not.toHaveBeenCalledWith('search_pending_submissions_nearby', expect.anything());
    expect(client.getQueryData<VerifyCandidate[]>(keys.candidates)?.map((c) => c.id)).toEqual(['sub-2']);
  });

  it('does not touch another account\u2019s caches (guard)', async () => {
    const client = makeClient();
    seed(client, 'user-a');
    const other = seed(client, 'user-b');
    mockSupabase.rpc.mockResolvedValue({ data: { accepted: true }, error: null });

    const { result } = renderHook(() => useVerify(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    expect(client.getQueryData<VerifyCandidate[]>(other.candidates)?.map((c) => c.id)).toEqual(['sub-1', 'sub-2']);
    expect(client.getQueryState(other.candidates)?.isInvalidated).toBe(false);
    expect(client.getQueryState(other.pending)?.isInvalidated).toBe(false);
    expect(client.getQueryState(other.unseen)?.isInvalidated).toBe(false);
    expect(client.getQueryState(other.stats)?.isInvalidated).toBe(false);
  });
});
