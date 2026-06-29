import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

// jest.mock is hoisted. We define the mock fns inside the factory using jest.fn()
// then retrieve them via jest.requireMock() after the import section.
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

import { SessionProvider, SessionContext } from '../SessionProvider';

// Retrieve mock handles after the jest.mock factory has run
const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  auth: {
    getSession: jest.Mock;
    onAuthStateChange: jest.Mock;
    signOut: jest.Mock;
  };
};

const mockUnsubscribe = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  mockSupabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  });
  mockSupabase.auth.signOut.mockResolvedValue({});
});

// Helper consumer component that reads the context
function TestConsumer() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) return <Text testID="no-ctx">no context</Text>;
  return (
    <>
      <Text testID="loading">{String(ctx.loading)}</Text>
      <Text testID="session">{ctx.session ? 'has-session' : 'no-session'}</Text>
    </>
  );
}

describe('SessionProvider', () => {
  it('starts with loading=true before getSession resolves', async () => {
    let resolveGetSession!: (val: { data: { session: null } }) => void;
    mockSupabase.auth.getSession.mockReturnValue(
      new Promise<{ data: { session: null } }>((resolve) => {
        resolveGetSession = resolve;
      })
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    expect(getByTestId('loading').props.children).toBe('true');

    // Resolve to avoid async leaks
    await act(async () => {
      resolveGetSession({ data: { session: null } });
    });
  });

  it('sets loading=false after getSession resolves with no session', async () => {
    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });
    expect(getByTestId('session').props.children).toBe('no-session');
  });

  it('subscribes to onAuthStateChange on mount', async () => {
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });
  });

  it('updates session on SIGNED_IN event', async () => {
    const fakeSession = { user: { id: 'abc', email: 'user@example.com' } };
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('SIGNED_IN', fakeSession);
    });

    expect(getByTestId('session').props.children).toBe('has-session');
    expect(getByTestId('loading').props.children).toBe('false');
  });

  it('clears session on SIGNED_OUT event', async () => {
    const fakeSession = { user: { id: 'abc', email: 'user@example.com' } };
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('SIGNED_IN', fakeSession);
    });

    expect(getByTestId('session').props.children).toBe('has-session');

    await act(async () => {
      authChangeCallback('SIGNED_OUT', null);
    });

    expect(getByTestId('session').props.children).toBe('no-session');
  });

  it('handles PASSWORD_RECOVERY event without crashing', async () => {
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('PASSWORD_RECOVERY', null);
    });

    expect(getByTestId('loading').props.children).toBe('false');
  });

  it('handles TOKEN_REFRESHED event and updates session', async () => {
    const refreshedSession = { user: { id: 'abc', email: 'user@example.com' } };
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('TOKEN_REFRESHED', refreshedSession);
    });

    expect(getByTestId('session').props.children).toBe('has-session');
  });

  it('handles USER_UPDATED event and updates session', async () => {
    const updatedSession = { user: { id: 'abc', email: 'new@example.com' } };
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('USER_UPDATED', updatedSession);
    });

    expect(getByTestId('session').props.children).toBe('has-session');
  });

  it('unsubscribes from auth state changes on unmount', async () => {
    const { unmount } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('calls supabase.auth.signOut when signOut is invoked', async () => {
    function SignOutConsumer() {
      const ctx = React.useContext(SessionContext);
      return (
        <Text
          testID="sign-out-btn"
          onPress={() => ctx?.signOut()}
        >
          sign out
        </Text>
      );
    }

    const { getByTestId } = render(
      <SessionProvider>
        <SignOutConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      getByTestId('sign-out-btn').props.onPress();
    });

    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
