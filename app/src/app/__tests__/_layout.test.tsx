/**
 * Thin render tests for app/src/app/_layout.tsx (Root Layout).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
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
jest.mock('../../features/auth/redirect', () => ({
  nextRoute: (...args: unknown[]) => mockNextRoute(...args),
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

jest.mock('expo-router', () => ({
  Stack: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'stack' });
  },
  useSegments: jest.fn(() => []),
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));

import RootLayout from '../_layout';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
