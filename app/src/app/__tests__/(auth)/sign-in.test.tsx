/**
 * Thin render + behavior tests for app/src/app/(auth)/sign-in.tsx (Sign-In Screen).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace })),
  useSegments: jest.fn(() => []),
}));

const mockSignInWithPassword = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
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
});
