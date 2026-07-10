// Mocks the supabase fluent builder (read) + rpc (write), and useSession so the
// user-scoped query key / enabled gating can be asserted. Guards the Codex
// WU-02-T5 cross-user cache leak: the query key must include the user id.
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockRpc = jest.fn();

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('../../auth/useSession', () => ({
  useSession: jest.fn(),
}));

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  getFamilyMode,
  setFamilyMode,
  familyModeQueryKey,
  useFamilyMode,
} from '../useFamilyMode';
import { useSession } from '../../auth/useSession';

const mockUseSession = useSession as jest.Mock;

function makeWrapper() {
  // gcTime: 0 on both queries and mutations — otherwise each test's query/mutation
  // schedules a default 5-minute gc timer that outlives the test (the QueryClient
  // here is never cleared/unmounted), leaving Jest unable to exit.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getFamilyMode', () => {
  it('reads family_mode for a user id and returns a boolean', async () => {
    mockSingle.mockResolvedValue({ data: { family_mode: true }, error: null });

    const result = await getFamilyMode('user-1');

    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockSelect).toHaveBeenCalledWith('family_mode');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    expect(result).toBe(true);
  });

  it('defaults to false when the row value is null or missing', async () => {
    mockSingle.mockResolvedValue({ data: { family_mode: null }, error: null });
    expect(await getFamilyMode('user-1')).toBe(false);

    mockSingle.mockResolvedValue({ data: null, error: null });
    expect(await getFamilyMode('user-1')).toBe(false);
  });

  it('throws when the read errors', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('read failed') });
    await expect(getFamilyMode('user-1')).rejects.toThrow('read failed');
  });
});

describe('setFamilyMode', () => {
  it('writes ONLY new_family_mode (never nulls the display name)', async () => {
    mockRpc.mockResolvedValue({ error: null });

    await setFamilyMode(true);

    expect(mockRpc).toHaveBeenCalledWith('update_profile', { new_family_mode: true });
    const [, args] = mockRpc.mock.calls[0];
    expect(args).not.toHaveProperty('new_display_name');
  });

  it('throws when the write errors', async () => {
    mockRpc.mockResolvedValue({ error: new Error('write failed') });
    await expect(setFamilyMode(false)).rejects.toThrow('write failed');
  });
});

describe('familyModeQueryKey', () => {
  it('is scoped by user id to prevent cross-user cache leaks', () => {
    expect(familyModeQueryKey('user-1')).toEqual(['familyMode', 'user-1']);
    expect(familyModeQueryKey(undefined)).toEqual(['familyMode', undefined]);
  });
});

describe('useFamilyMode', () => {
  it('reads the signed-in user\'s family_mode and exposes a write', async () => {
    mockUseSession.mockReturnValue({ session: { user: { id: 'user-1' } } });
    mockSingle.mockResolvedValue({ data: { family_mode: true }, error: null });
    mockRpc.mockResolvedValue({ error: null });

    const { client, wrapper } = makeWrapper();
    const { result } = renderHook(() => useFamilyMode(), { wrapper });

    await waitFor(() => expect(result.current.familyMode).toBe(true));

    // The query is cached under a user-scoped key.
    const keys = client.getQueryCache().findAll().map((q) => q.queryKey);
    expect(keys).toContainEqual(['familyMode', 'user-1']);

    await act(async () => {
      await result.current.setFamilyMode(false);
    });
    expect(mockRpc).toHaveBeenCalledWith('update_profile', { new_family_mode: false });
  });

  it('is disabled and defaults to false when there is no session', async () => {
    mockUseSession.mockReturnValue({ session: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFamilyMode(), { wrapper });

    expect(result.current.familyMode).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('treats a missing session context as signed-out', () => {
    mockUseSession.mockReturnValue(undefined);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFamilyMode(), { wrapper });

    expect(result.current.familyMode).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
