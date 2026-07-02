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

const mockUpdateProfile = jest.fn();
jest.mock('../../../features/profile/updateProfile', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  DISPLAY_NAME_TAKEN_MESSAGE: 'That display name is already taken.',
}));

const mockSetSuppressGuardRedirect = jest.fn();
jest.mock('../../../features/auth/useSession', () => ({
  useSession: () => ({ setSuppressGuardRedirect: mockSetSuppressGuardRedirect }),
}));

const mockOpenURL = jest.fn();
jest.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDisplayNameTakenError.mockReturnValue(false);
  mockUpdateProfile.mockResolvedValue(undefined);
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

  it('successful signUp calls updateProfile then router.replace with /gps-consent', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(true);
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

    const { getByPlaceholderText, getByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser');
    fireEvent.changeText(getByPlaceholderText('Email'), 'new@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith('NewUser');
      expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
    });
  });

  it('updateProfile rejecting with the taken-name message shows the friendly error and does not navigate', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(true);
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
    mockUpdateProfile.mockRejectedValue(new Error('That display name is already taken.'));

    const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'RaceConditionName');
    fireEvent.changeText(getByPlaceholderText('Email'), 'race@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    expect(await findByText('That display name is already taken.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('updateProfile rejecting with any other error shows the generic error and does not navigate', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(true);
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
    mockUpdateProfile.mockRejectedValue(new Error('network down'));

    const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser2');
    fireEvent.changeText(getByPlaceholderText('Email'), 'new2@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    expect(await findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('TOS text contains "Terms of Service" and "Privacy Policy"', () => {
    const { getByText } = render(<SignUpScreen />);
    expect(getByText('Terms of Service')).toBeTruthy();
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  describe('guard suppression during post-signup provisioning', () => {
    it('suppresses the root guard before signUp/updateProfile run', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

      const { getByPlaceholderText, getByText } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser');
      fireEvent.changeText(getByPlaceholderText('Email'), 'new@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      await waitFor(() => {
        expect(mockSetSuppressGuardRedirect).toHaveBeenCalledWith(true);
        expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
      });
    });

    it('does not clear guard suppression when updateProfile fails, so the guard cannot race the error away', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
      mockUpdateProfile.mockRejectedValue(new Error('That display name is already taken.'));

      const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'RaceConditionName');
      fireEvent.changeText(getByPlaceholderText('Email'), 'race@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      expect(await findByText('That display name is already taken.')).toBeTruthy();
      expect(mockSetSuppressGuardRedirect).toHaveBeenCalledWith(true);
      expect(mockSetSuppressGuardRedirect).not.toHaveBeenCalledWith(false);
    });

    it('clears guard suppression when the screen unmounts', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

      const { getByPlaceholderText, getByText, unmount } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser');
      fireEvent.changeText(getByPlaceholderText('Email'), 'new@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
      });

      unmount();

      expect(mockSetSuppressGuardRedirect).toHaveBeenCalledWith(false);
    });
  });

  describe('retry after account already created', () => {
    it('a second submit after an updateProfile failure retries updateProfile without calling signUp or checkDisplayNameAvailable again', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
      mockUpdateProfile.mockRejectedValueOnce(new Error('That display name is already taken.'));

      const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'TakenOnce');
      fireEvent.changeText(getByPlaceholderText('Email'), 'retry@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      expect(await findByText('That display name is already taken.')).toBeTruthy();
      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(mockCheckDisplayNameAvailable).toHaveBeenCalledTimes(1);

      mockUpdateProfile.mockResolvedValueOnce(undefined);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'AvailableNow');
      fireEvent.press(getByText('Create Account'));

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenLastCalledWith('AvailableNow');
        expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
      });

      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(mockCheckDisplayNameAvailable).toHaveBeenCalledTimes(1);
    });

    it('a second submit after a generic updateProfile failure also retries updateProfile only', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
      mockUpdateProfile.mockRejectedValueOnce(new Error('network down'));

      const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser3');
      fireEvent.changeText(getByPlaceholderText('Email'), 'new3@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      expect(await findByText('Something went wrong. Try again.')).toBeTruthy();

      mockUpdateProfile.mockResolvedValueOnce(undefined);
      fireEvent.press(getByText('Create Account'));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
      });

      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(mockCheckDisplayNameAvailable).toHaveBeenCalledTimes(1);
      expect(mockUpdateProfile).toHaveBeenCalledTimes(2);
    });
  });
});
