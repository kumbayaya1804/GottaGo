/**
 * Thin render + behavior tests for app/src/app/(auth)/sign-in.tsx (Sign-In Screen).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace })),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => mockSearchParams),
}));

const mockSignInWithPassword = jest.fn();
const mockExchangeCodeForSession = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
    },
  },
}));

const mockSignInWithGoogle = jest.fn();
jest.mock('../../../features/auth/oauth', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = {};
  Platform.OS = 'android';
});

import SignInScreen from '../../(auth)/sign-in';

describe('SignInScreen', () => {
  it('renders Email and Password fields and Sign In button', () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('renders "Forgot password?" link', () => {
    const { getByText } = render(<SignInScreen />);
    expect(getByText('Forgot password?')).toBeTruthy();
  });

  it('wrong-password auth error shows "Invalid email or password."', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { status: 400, message: 'Invalid login credentials' },
    });

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpassword');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Invalid email or password.')).toBeTruthy();
    });
  });

  it('unregistered-email auth error shows "Invalid email or password."', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { status: 400, message: 'Email not confirmed' },
    });

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'unknown@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'somepassword');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Invalid email or password.')).toBeTruthy();
    });
  });

  it('generic server error shows "Invalid email or password."', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { status: 500, message: 'Internal server error' },
    });

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Invalid email or password.')).toBeTruthy();
    });
  });

  it("network error shows \"Couldn't sign in. Check your connection and try again.\"", async () => {
    mockSignInWithPassword.mockRejectedValue(new TypeError('Network request failed'));

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(
        getByText("Couldn't sign in. Check your connection and try again.")
      ).toBeTruthy();
    });
  });

  it('successful sign-in calls signInWithPassword with correct credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
    });
  });

  describe('platform-gated OAuth row', () => {
    it('shows "Continue with Google" and no Apple stub on Android', () => {
      Platform.OS = 'android';

      const { getByText, queryByText } = render(<SignInScreen />);

      expect(getByText('Continue with Google')).toBeTruthy();
      expect(queryByText('Sign in with Apple — coming soon')).toBeNull();
    });

    it('shows the disabled Apple stub and no Google button on iOS', () => {
      Platform.OS = 'ios';

      const { getByText, queryByText } = render(<SignInScreen />);

      expect(getByText('Sign in with Apple — coming soon')).toBeTruthy();
      expect(queryByText('Continue with Google')).toBeNull();
    });

    it('the Apple stub reports accessibilityState disabled', () => {
      Platform.OS = 'ios';

      const { getByLabelText } = render(<SignInScreen />);
      const stub = getByLabelText('Sign in with Apple — coming soon');

      expect(stub.props.accessibilityState).toEqual({ disabled: true });
    });

    it('tapping "Continue with Google" calls signInWithGoogle', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockResolvedValue(null);

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalled();
      });
    });

    it('exchanges the returned code for a session when signInWithGoogle resolves with a code', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockResolvedValue('abc123');
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc123');
      });
    });

    it('does not attempt an exchange when signInWithGoogle resolves null (cancel/dismiss)', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockResolvedValue(null);

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalled();
      });
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('shows the network error copy when signInWithGoogle throws', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockRejectedValue(new Error('provider not enabled'));

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(
          getByText("Couldn't sign in. Check your connection and try again.")
        ).toBeTruthy();
      });
    });

    it('shows the network error copy when exchangeCodeForSession returns an error', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockResolvedValue('abc123');
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: new Error('invalid grant'),
      });

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(
          getByText("Couldn't sign in. Check your connection and try again.")
        ).toBeTruthy();
      });
    });
  });

  describe('authError search param', () => {
    it('shows the network error copy immediately when arriving with ?authError=1', () => {
      mockSearchParams = { authError: '1' };

      const { getByText } = render(<SignInScreen />);

      expect(
        getByText("Couldn't sign in. Check your connection and try again.")
      ).toBeTruthy();
    });
  });
});
