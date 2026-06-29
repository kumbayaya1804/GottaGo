/**
 * Thin render tests for app/src/app/index.tsx (Welcome Screen).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// expo-router push mock
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, replace: jest.fn() })),
  useSegments: jest.fn(() => []),
}));

const mockOpenURL = jest.fn();
jest.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

import WelcomeScreen from '../index';

describe('WelcomeScreen', () => {
  it('renders Sign In button', () => {
    const { getByLabelText } = render(<WelcomeScreen />);
    expect(getByLabelText('Sign In')).toBeTruthy();
  });

  it('renders Create Account button', () => {
    const { getByLabelText } = render(<WelcomeScreen />);
    expect(getByLabelText('Create Account')).toBeTruthy();
  });

  it('renders TOS text containing Terms of Service', () => {
    const { getByText } = render(<WelcomeScreen />);
    expect(getByText('Terms of Service')).toBeTruthy();
  });

  it('renders TOS text containing Privacy Policy', () => {
    const { getByText } = render(<WelcomeScreen />);
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  it('Sign In button calls router.push with /(auth)/sign-in', () => {
    const { getByLabelText } = render(<WelcomeScreen />);
    fireEvent.press(getByLabelText('Sign In'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('Create Account button calls router.push with /(auth)/sign-up', () => {
    const { getByLabelText } = render(<WelcomeScreen />);
    fireEvent.press(getByLabelText('Create Account'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-up');
  });
});
