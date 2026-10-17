/**
 * Service-layer tests for the creator's "your submission published" fallback
 * (plan 05-03 Task 3, D-68).
 *
 * `get_my_pending_submissions` stops returning a submission the moment it publishes,
 * so the Published! state is driven by a separate owner-scoped RPC pair. Contracts:
 *  - the unseen-publication list and the acknowledge call are owner-scoped on the
 *    server; the client passes no user id;
 *  - the query key carries the signed-in user id and the query is disabled without
 *    one, so one account's publications are never shown to the next (T-05-26).
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the supabase singleton so rpc() calls can be intercepted
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

// Controllable signed-in user for the user-scoped query.
let mockUserId: string | undefined;
jest.mock('../../auth/useSession', () => ({
  useSession: () => ({
    session: mockUserId ? { user: { id: mockUserId } } : null,
    loading: false,
  }),
}));

import {
  PUBLICATIONS_POLL_MS,
  acknowledgePublication,
  fetchMyUnseenPublications,
  unseenPublicationsKey,
  useMySubmissionPublications,
} from '../useMySubmissionPublications';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = undefined;
});

function publicationRow(overrides: Record<string, unknown> = {}) {
  return {
    submission_id: 'sub-1',
    location_id: 'loc-1',
    name: 'Alton Baker Park restroom',
    published_at: '2026-10-11T12:00:00.000Z',
    ...overrides,
  };
}

describe('fetchMyUnseenPublications', () => {
  it('calls get_my_unseen_submission_publications with no argument and maps rows to camelCase', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [publicationRow()], error: null });

    const result = await fetchMyUnseenPublications();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_my_unseen_submission_publications');
    // No second argument: the RPC is owner-scoped by auth.uid() on the server.
    expect(mockSupabase.rpc.mock.calls[0]).toHaveLength(1);
    expect(result).toEqual([
      {
        submissionId: 'sub-1',
        locationId: 'loc-1',
        name: 'Alton Baker Park restroom',
        publishedAt: '2026-10-11T12:00:00.000Z',
      },
    ]);
  });

  it('returns an empty list when the RPC returns no data', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(fetchMyUnseenPublications()).resolves.toEqual([]);
  });

  it('throws when the RPC returns an error', async () => {
    const rpcError = new Error('rpc failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(fetchMyUnseenPublications()).rejects.toBe(rpcError);
  });
});

describe('acknowledgePublication', () => {
  it('calls acknowledge_submission_publication with only the submission id', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await acknowledgePublication('sub-1');

    // The owner is auth.uid() on the server; a non-owner's call matches no row.
    expect(mockSupabase.rpc).toHaveBeenCalledWith('acknowledge_submission_publication', {
      p_submission_id: 'sub-1',
    });
  });

  it('throws when the RPC returns an error, so a failed acknowledge is not mistaken for success', async () => {
    const rpcError = new Error('rpc failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(acknowledgePublication('sub-1')).rejects.toBe(rpcError);
  });
});

describe('useMySubmissionPublications', () => {
  // gcTime Infinity: no garbage-collection timer outlives the test, and a previous
  // account's cache entry stays inspectable.
  function makeClient() {
    return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  }

  function wrapperFor(client: QueryClient) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client }, children);
    };
  }

  it('re-asks on an interval while polling, so a publication made by someone else reaches an open Map', async () => {
    // Another user's verification publishes the creator's submission; nothing in this
    // app session invalidates the query, so only a refresh can find it (D-68 fallback).
    jest.useFakeTimers();
    try {
      mockUserId = 'user-a';
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValue({ data: [publicationRow()], error: null });
      const client = makeClient();
      const { result } = renderHook(() => useMySubmissionPublications({ pollMs: PUBLICATIONS_POLL_MS }), {
        wrapper: wrapperFor(client),
      });
      await waitFor(() => expect(result.current.data).toEqual([]));

      await act(async () => {
        jest.advanceTimersByTime(PUBLICATIONS_POLL_MS);
      });
      await waitFor(() => expect(result.current.data).toEqual([expect.objectContaining({ submissionId: 'sub-1' })]));
      client.clear();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not poll when polling is off (guard)', async () => {
    jest.useFakeTimers();
    try {
      mockUserId = 'user-a';
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
      const client = makeClient();
      const { result } = renderHook(() => useMySubmissionPublications(), { wrapper: wrapperFor(client) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      await act(async () => {
        jest.advanceTimersByTime(PUBLICATIONS_POLL_MS * 3);
      });
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      client.clear();
    } finally {
      jest.useRealTimers();
    }
  });

  it('namespaces the query key by the signed-in user id', () => {
    expect(unseenPublicationsKey('user-a')).toEqual(['unseenPublications', 'user-a']);
    expect(unseenPublicationsKey('user-a')).not.toEqual(unseenPublicationsKey('user-b'));
  });

  it('does not fetch without a signed-in user', () => {
    const client = makeClient();

    const { result } = renderHook(() => useMySubmissionPublications(), { wrapper: wrapperFor(client) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    client.clear();
  });

  it('never shows one account its predecessor\u2019s publications after an account switch', async () => {
    const client = makeClient();
    mockUserId = 'user-a';
    mockSupabase.rpc.mockResolvedValueOnce({ data: [publicationRow({ submission_id: 'of-a' })], error: null });

    const { result, rerender } = renderHook(() => useMySubmissionPublications(), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.data?.[0].submissionId).toBe('of-a'));

    let releaseB!: (value: { data: unknown; error: null }) => void;
    mockSupabase.rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseB = resolve;
      }),
    );
    mockUserId = 'user-b';
    rerender({});

    // While B's own fetch is in flight, B must see nothing rather than A's publication.
    expect(result.current.data).toBeUndefined();

    releaseB({ data: [], error: null });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(client.getQueryData(unseenPublicationsKey('user-a'))).toEqual([
      expect.objectContaining({ submissionId: 'of-a' }),
    ]);
    client.clear();
  });
});
