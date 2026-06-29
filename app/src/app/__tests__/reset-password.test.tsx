/**
 * Thin render + behavior tests for app/src/app/reset-password.tsx.
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

const mockUpdateUser = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

import ResetPasswordScreen from '../reset-password';

describe('ResetPasswordScreen', () => {
  it('renders new password input and "Set New Password" button', () => {
    const { getByPlaceholderText, getByText } = render(<ResetPasswordScreen />);
    expect(getByPlaceholderText('New Password')).toBeTruthy();
    expect(getByText('Set New Password')).toBeTruthy();
  });

  it('successful updateUser calls router.replace with /(tabs)', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: {} }, error: null });

    const { getByPlaceholderText, getByText } = render(<ResetPasswordScreen />);
    fireEvent.changeText(getByPlaceholderText('New Password'), 'newpassword123');
    fireEvent.press(getByText('Set New Password'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });
});
