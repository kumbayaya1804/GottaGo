/**
 * Thin render tests for app/src/app/_layout.tsx (Root Layout).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * Probity compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';

// Mock SessionProvider so we control the context value
jest.mock('../../features/auth/SessionProvider', () => {
  const React = require('react');
  const mockContext = React.createContext(null);
  return {
    SessionProvider: ({ children }: { children: React.ReactNode }) => {
      const value = (global as Record<string, unknown>).__sessionContextValue ?? {
        session: null,
        loading: false,
        signOut: jest.fn(),
      };
      return React.createElement(mockContext.Provider, { value }, children);
    },
    SessionContext: mockContext,
  };
});

jest.mock('../../features/auth/useSession', () => ({
  useSession: () =>
    (global as Record<string, unknown>).__sessionContextValue ?? {
      session: null,
      loading: false,
      signOut: jest.fn(),
    },
}));

const mockNextRoute = jest.fn(() => null as string | null);
const mockTakePostAuthReturn = jest.fn(() => null as string | null);
const mockForgetPostAuthReturn = jest.fn();
jest.mock('../../features/auth/redirect', () => ({
  nextRoute: (...args: unknown[]) => mockNextRoute(...args),
  takePostAuthReturn: () => mockTakePostAuthReturn(),
  forgetPostAuthReturn: () => mockForgetPostAuthReturn(),
  isInAuthFlow: (segments: string[]) => segments[0] === '(auth)' || segments[0] === 'auth',
}));

const mockOnAuthStateChange = jest.fn();
const mockUnsubscribe = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
  };
});

// Screens the layout registers on the root Stack, as { name, options }.
const mockStackScreens: { name?: string; options?: Record<string, unknown> }[] = [];
jest.mock('expo-router', () => {
  const Stack = ({ children }: { children?: unknown }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'stack' }, children);
  };
  Stack.Screen = function Screen(props: { name?: string; options?: Record<string, unknown> }) {
    mockStackScreens.push(props);
    return null;
  };
  return {
    Stack,
    useSegments: jest.fn(() => []),
    useRouter: jest.fn(() => ({ replace: jest.fn() })),
  };
});

import RootLayout from '../_layout';

const g = global as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockNextRoute.mockReturnValue(null);
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  });
  delete g.__sessionContextValue;
});

describe('RootLayout', () => {
  it('presents the verify route as a modal', () => {
    mockStackScreens.length = 0;
    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    render(<RootLayout />);

    // The file is app/(modals)/verify.tsx; the group has no layout of its own, so the
    // root Stack owns the screen under its path-style name.
    expect(mockStackScreens).toContainEqual({
      name: '(modals)/verify',
      options: expect.objectContaining({ presentation: 'modal' }),
    });
  });

  it('renders null (blank splash) when loading is true', () => {
    g.__sessionContextValue = { session: null, loading: true, signOut: jest.fn() };

    const { queryByTestId } = render(<RootLayout />);

    // When loading, the Guard renders null — the Stack must not be present
    expect(queryByTestId('stack')).toBeNull();
  });

  it('does NOT call router.replace when loading is true', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    g.__sessionContextValue = { session: null, loading: true, signOut: jest.fn() };

    render(<RootLayout />);

    await act(async () => {});

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('calls router.replace with the route returned by nextRoute when not loading', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    mockNextRoute.mockReturnValue('/(auth)/sign-in');
    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    render(<RootLayout />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
    });
  });

  it('returns to a remembered screen with dismissTo after sign-in, instead of replacing to the tabs', async () => {
    // Verify is a modal still on the stack beneath sign-in: dismissing back to it resumes
    // the action, where a replace would stack a second Verify or drop the user on the tabs.
    const { useRouter, useSegments } = require('expo-router');
    const mockReplace = jest.fn();
    const mockDismissTo = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, dismissTo: mockDismissTo });
    (useSegments as jest.Mock).mockReturnValue(['(auth)', 'sign-in']);
    mockNextRoute.mockReturnValue('/(tabs)');
    mockTakePostAuthReturn.mockReturnValueOnce('/verify');
    g.__sessionContextValue = { session: { user: { id: 'u' } }, loading: false, signOut: jest.fn() };

    render(<RootLayout />);

    await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith('/verify'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('forgets a remembered return once the user leaves the sign-in flow without signing in', async () => {
    const { useRouter, useSegments } = require('expo-router');
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn(), dismissTo: jest.fn() });
    (useSegments as jest.Mock).mockReturnValue(['(modals)', 'verify']);
    mockNextRoute.mockReturnValue(null);
    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    render(<RootLayout />);

    await waitFor(() => expect(mockForgetPostAuthReturn).toHaveBeenCalled());
  });

  it('keeps a remembered return while the user is still in the sign-in flow (guard)', async () => {
    const { useRouter, useSegments } = require('expo-router');
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn(), dismissTo: jest.fn() });
    (useSegments as jest.Mock).mockReturnValue(['auth', 'callback']);
    mockNextRoute.mockReturnValue(null);
    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    render(<RootLayout />);
    await waitFor(() => expect(mockNextRoute).toHaveBeenCalled());
    expect(mockForgetPostAuthReturn).not.toHaveBeenCalled();
  });

  it('does NOT call router.replace when suppressGuardRedirect is true, even if nextRoute would redirect', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    mockNextRoute.mockReturnValue('/(tabs)');
    g.__sessionContextValue = {
      session: { user: { id: 'u1' } },
      loading: false,
      signOut: jest.fn(),
      suppressGuardRedirect: true,
    };

    render(<RootLayout />);

    await act(async () => {});

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does NOT call router.replace when nextRoute returns null', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    mockNextRoute.mockReturnValue(null);
    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    render(<RootLayout />);

    await act(async () => {});

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('calls router.replace with /reset-password on PASSWORD_RECOVERY event', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    mockOnAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    render(<RootLayout />);

    await waitFor(() => {
      expect(capturedCallback).not.toBeNull();
    });

    await act(async () => {
      capturedCallback!('PASSWORD_RECOVERY', null);
    });

    expect(mockReplace).toHaveBeenCalledWith('/reset-password');
  });

  it('unsubscribes from supabase.auth.onAuthStateChange on unmount', async () => {
    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    const { unmount } = render(<RootLayout />);

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
