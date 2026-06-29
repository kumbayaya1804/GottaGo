import { useSession } from '../useSession';
import { SessionContext } from '../SessionProvider';
import React from 'react';
import { renderHook } from '@testing-library/react-native';

// Mock lib/supabase so SessionProvider can be imported without errors
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signOut: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('useSession', () => {
  it('returns the context value from SessionContext', () => {
    const mockSignOut = jest.fn();
    const contextValue = {
      session: null,
      loading: false,
      signOut: mockSignOut,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SessionContext.Provider value={contextValue}>
        {children}
      </SessionContext.Provider>
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current).toBe(contextValue);
    expect(result.current?.session).toBeNull();
    expect(result.current?.loading).toBe(false);
    expect(result.current?.signOut).toBe(mockSignOut);
  });

  it('returns a session when the context has one', () => {
    const fakeSession = { user: { id: 'abc', email: 'user@example.com' } };
    const contextValue = {
      session: fakeSession as never,
      loading: false,
      signOut: jest.fn(),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SessionContext.Provider value={contextValue}>
        {children}
      </SessionContext.Provider>
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current?.session).toBe(fakeSession);
  });

  it('returns loading=true when the context says loading', () => {
    const contextValue = {
      session: null,
      loading: true,
      signOut: jest.fn(),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SessionContext.Provider value={contextValue}>
        {children}
      </SessionContext.Provider>
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current?.loading).toBe(true);
  });
});
