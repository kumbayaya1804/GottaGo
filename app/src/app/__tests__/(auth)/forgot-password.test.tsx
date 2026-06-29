/**
 * Thin render + behavior tests for app/src/app/(auth)/forgot-password.tsx.
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace })),
  useSegments: jest.fn(() => []),
}));

const mockResetPasswordForEmail = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) =>
        mockResetPasswordForEmail(...args),
    },
  },
}));

const mockCreateURL = jest.fn(() => 'gotta-go://auth/callback');
jest.mock('expo-linking', () => ({
  createURL: (...args: unknown[]) => mockCreateURL(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

import ForgotPasswordScreen from '../../(auth)/forgot-password';

describe('ForgotPasswordScreen', () => {
  it('renders email input and "Send Reset Email" button', () => {
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByText('Send Reset Email')).toBeTruthy();
  });

  it('successful resetPasswordForEmail shows "Check your email" confirmation', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    const { getByPlaceholderText, getByText, findByText } = render(<ForgotPasswordScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.press(getByText('Send Reset Email'));

    expect(await findByText('Check your email')).toBeTruthy();
  });

  it('resetPasswordForEmail error shows error message', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'User not found' },
    });

    const { getByPlaceholderText, getByText, findByText } = render(<ForgotPasswordScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'bad@example.com');
    fireEvent.press(getByText('Send Reset Email'));

    expect(await findByText('User not found')).toBeTruthy();
  });
});
