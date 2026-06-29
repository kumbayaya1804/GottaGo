/**
 * Thin render + behavior tests for app/src/app/(auth)/sign-up.tsx (Sign-Up Screen).
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

const mockCheckDisplayNameAvailable = jest.fn();
const mockIsDisplayNameTakenError = jest.fn();
jest.mock('../../../features/auth/displayName', () => ({
  checkDisplayNameAvailable: (...args: unknown[]) =>
    mockCheckDisplayNameAvailable(...args),
  isDisplayNameTakenError: (...args: unknown[]) =>
    mockIsDisplayNameTakenError(...args),
}));

const mockSignUp = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

const mockOpenURL = jest.fn();
jest.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDisplayNameTakenError.mockReturnValue(false);
});

import SignUpScreen from '../../(auth)/sign-up';

describe('SignUpScreen', () => {
  it('renders Display Name, Email, and Password fields', () => {
    const { getByPlaceholderText } = render(<SignUpScreen />);
    expect(getByPlaceholderText('Display Name')).toBeTruthy();
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('checkDisplayNameAvailable returns false shows "That display name is already taken."', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(false);

    const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'TakenName');
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    expect(await findByText('That display name is already taken.')).toBeTruthy();
  });

  it('successful signUp calls router.replace with /gps-consent', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(true);
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

    const { getByPlaceholderText, getByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser');
    fireEvent.changeText(getByPlaceholderText('Email'), 'new@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
    });
  });

  it('TOS text contains "Terms of Service" and "Privacy Policy"', () => {
    const { getByText } = render(<SignUpScreen />);
    expect(getByText('Terms of Service')).toBeTruthy();
    expect(getByText('Privacy Policy')).toBeTruthy();
  });
});
