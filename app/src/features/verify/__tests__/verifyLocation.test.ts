/**
 * Service-layer tests for the Phase 5 verify feature (plan 05-03 Task 1):
 * verifyLocation, fetchVerifyCandidates / useVerifyCandidates, getVerifyGpsSample.
 *
 * Contracts under test:
 *  - verifyLocation returns only { accepted } and rethrows transport errors raw; it
 *    never passes a rejection reason through (SC7).
 *  - Candidate discovery is user-scoped: the query key carries the signed-in user id
 *    and the query is disabled without one, so one account's candidates are never
 *    served to the next on the app-lifetime QueryClient (Phase 2 standing rule, T-05-26).
 *  - GPS permission denial is a sentinel, never a throw.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Location from 'expo-location';

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

import { verifyLocation } from '../verifyLocation';
import { fetchVerifyCandidates, useVerifyCandidates, verifyCandidatesKey } from '../useVerifyCandidates';
import { getVerifyGpsSample } from '../useVerifyGpsSample';
import { distanceMeters } from '../distance';
import type { VerifyInput } from '../types';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};
// expo-location is mocked in jest.setup.ts.
const mockPerm = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPos = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = undefined;
});

function baseInput(overrides: Partial<VerifyInput> = {}): VerifyInput {
  return {
    submissionId: 'sub-1',
    lat: 44.05,
    lng: -123.08,
    accuracy: 12,
    mocked: false,
    timestamp: 1_799_999_999_000,
    ...overrides,
  };
}

describe('verifyLocation', () => {
  it('calls the verify_location RPC with the submission id, the GPS triple, and the mock flag', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { accepted: true }, error: null });

    await verifyLocation(baseInput());

    expect(mockSupabase.rpc).toHaveBeenCalledWith('verify_location', {
      p_submission_id: 'sub-1',
      p_lat: 44.05,
      p_lng: -123.08,
      p_accuracy_m: 12,
      p_mocked: false,
      p_captured_at: new Date(1_799_999_999_000).toISOString(),
    });
  });

  it('returns { accepted: true } for an accepted verification', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { accepted: true }, error: null });

    await expect(verifyLocation(baseInput())).resolves.toEqual({ accepted: true });
  });

  it('returns only { accepted } for a domain rejection, never a reason', async () => {
    // Even if a payload ever carried extra fields, only `accepted` may reach the UI (SC7).
    mockSupabase.rpc.mockResolvedValue({
      data: { accepted: false, reason: 'too far', distance_m: 950 },
      error: null,
    });

    const result = await verifyLocation(baseInput());

    expect(result).toEqual({ accepted: false });
    expect(Object.keys(result)).toEqual(['accepted']);
  });

  it('rethrows a transport or system error unchanged', async () => {
    const rpcError = new Error('fetch failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(verifyLocation(baseInput())).rejects.toBe(rpcError);
  });
});

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    name: 'Alton Baker Park restroom',
    lat: 44.05,
    lng: -123.08,
    policy_tag: 'public_facility',
    distance_m: 42.5,
    ...overrides,
  };
}

describe('fetchVerifyCandidates', () => {
  it('calls search_pending_submissions_nearby with the user position', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await fetchVerifyCandidates(44.051, -123.092);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_pending_submissions_nearby', {
      user_lat: 44.051,
      user_lng: -123.092,
    });
  });

  it('maps snake_case rows to camelCase and preserves the returned (nearest-first) order', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        candidateRow({ id: 'near', distance_m: 12 }),
        candidateRow({ id: 'mid', distance_m: 140 }),
        candidateRow({ id: 'far', distance_m: 480 }),
      ],
      error: null,
    });

    const result = await fetchVerifyCandidates(44.051, -123.092);

    expect(result.map((c) => c.id)).toEqual(['near', 'mid', 'far']);
    expect(result[0]).toEqual({
      id: 'near',
      name: 'Alton Baker Park restroom',
      lat: 44.05,
      lng: -123.08,
      policyTag: 'public_facility',
      distanceM: 12,
    });
  });

  it('returns an empty list when the RPC returns no data', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(fetchVerifyCandidates(1, 2)).resolves.toEqual([]);
  });

  it('throws when the RPC returns an error', async () => {
    const rpcError = new Error('rpc failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(fetchVerifyCandidates(1, 2)).rejects.toBe(rpcError);
  });
});

describe('useVerifyCandidates', () => {
  const COORDS = { userLat: 44.051, userLng: -123.092 };

  // gcTime Infinity: no garbage-collection timer is scheduled, so nothing outlives the
  // test, and a previous account's cache entry stays inspectable. Retry is left at the
  // library default on purpose; the hook has to set its own.
  function makeClient() {
    return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  }

  function wrapperFor(client: QueryClient) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client }, children);
    };
  }

  it('namespaces the query key by the signed-in user id', () => {
    expect(verifyCandidatesKey('user-a', COORDS)).toEqual(['verifyCandidates', 'user-a', 44.051, -123.092]);
    expect(verifyCandidatesKey('user-a', COORDS)).not.toEqual(verifyCandidatesKey('user-b', COORDS));
  });

  it('does not fetch without a signed-in user', () => {
    const client = makeClient();

    const { result } = renderHook(() => useVerifyCandidates(COORDS), { wrapper: wrapperFor(client) });

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    client.clear();
  });

  it('does not fetch without a position', () => {
    const client = makeClient();
    mockUserId = 'user-a';

    const { result } = renderHook(() => useVerifyCandidates(null), { wrapper: wrapperFor(client) });

    // Idle, not errored: the query must not even be attempted without a position.
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isError).toBe(false);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    client.clear();
  });

  it('never serves one account its predecessor\u2019s cached candidates after an account switch', async () => {
    const client = makeClient();
    mockUserId = 'user-a';
    mockSupabase.rpc.mockResolvedValueOnce({ data: [candidateRow({ id: 'for-a' })], error: null });

    const { result, rerender } = renderHook(() => useVerifyCandidates(COORDS), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.data?.[0].id).toBe('for-a'));

    // Same QueryClient, same position, different signed-in user.
    let releaseB!: (value: { data: unknown; error: null }) => void;
    mockSupabase.rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseB = resolve;
      }),
    );
    mockUserId = 'user-b';
    rerender({});

    // While B's own fetch is in flight, B must see nothing rather than A's rows.
    expect(result.current.data).toBeUndefined();

    releaseB({ data: [candidateRow({ id: 'for-b' })], error: null });
    await waitFor(() => expect(result.current.data?.[0].id).toBe('for-b'));

    expect(client.getQueryData(verifyCandidatesKey('user-a', COORDS))).toEqual([
      expect.objectContaining({ id: 'for-a' }),
    ]);
    expect(client.getQueryData(verifyCandidatesKey('user-b', COORDS))).toEqual([
      expect.objectContaining({ id: 'for-b' }),
    ]);
    client.clear();
  });

  it('does not retry a failed discovery call, because every call consumes the server cooldown', async () => {
    const client = makeClient();
    mockUserId = 'user-a';
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('rpc failed') });

    const { result } = renderHook(() => useVerifyCandidates(COORDS), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 500 });
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('reuses a fresh list when the screen is reopened, instead of calling again inside the cooldown', async () => {
    const client = makeClient();
    mockUserId = 'user-a';
    mockSupabase.rpc.mockResolvedValue({ data: [candidateRow({ id: 'for-a' })], error: null });

    const first = renderHook(() => useVerifyCandidates(COORDS), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(first.result.current.data?.[0].id).toBe('for-a'));
    first.unmount();

    // A second call this soon would be answered with zero rows by the server.
    const second = renderHook(() => useVerifyCandidates(COORDS), { wrapper: wrapperFor(client) });

    expect(second.result.current.data?.[0].id).toBe('for-a');
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    client.clear();
  });
});

describe('getVerifyGpsSample', () => {
  it('returns the {denied:true} sentinel without throwing when permission is not granted', async () => {
    for (const status of ['denied', 'undetermined']) {
      mockPerm.mockResolvedValue({ status });

      await expect(getVerifyGpsSample()).resolves.toEqual({ denied: true });
    }
    expect(mockPos).not.toHaveBeenCalled();
  });

  it('returns lat/lng, accuracy, the mock flag and the timestamp from a high-accuracy fix', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 44.05, longitude: -123.09, accuracy: 8 },
      mocked: true,
      timestamp: 1_700_000_000_000,
    });

    await expect(getVerifyGpsSample()).resolves.toEqual({
      coord: { lat: 44.05, lng: -123.09 },
      accuracy: 8,
      mocked: true,
      timestamp: 1_700_000_000_000,
    });
    expect(mockPos).toHaveBeenCalledWith({ accuracy: Location.Accuracy.BestForNavigation });
  });

  it('defaults the mock flag to false when the OS does not report one (iOS)', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: 5 },
      mocked: undefined,
      timestamp: 1,
    });

    await expect(getVerifyGpsSample()).resolves.toEqual(expect.objectContaining({ mocked: false }));
  });
});

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters({ lat: 44.05, lng: -123.09 }, { lat: 44.05, lng: -123.09 })).toBe(0);
  });

  it('matches known great-circle distances', () => {
    // One degree of latitude is about 111.19 km on a 6,371 km sphere.
    expect(distanceMeters({ lat: 44, lng: -123 }, { lat: 45, lng: -123 })).toBeCloseTo(111_194.9, 0);
    // About 100 m north: 0.0009 degrees of latitude.
    expect(distanceMeters({ lat: 44.05, lng: -123.09 }, { lat: 44.0509, lng: -123.09 })).toBeCloseTo(100.1, 0);
    // East-west distance shrinks with latitude: 0.001 degrees of longitude at 44 N is about 80 m.
    expect(distanceMeters({ lat: 44, lng: -123 }, { lat: 44, lng: -122.999 })).toBeCloseTo(80.0, 0);
  });

  it('is symmetric', () => {
    const a = { lat: 44.05, lng: -123.09 };
    const b = { lat: 44.0512, lng: -123.0931 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });
});
