/**
 * Thin render + behavior tests for app/src/app/auth/callback.tsx (deep-link OAuth +
 * password-recovery target route).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ replace: mockReplace })),
  useSegments: jest.fn(() => []),
}));

const mockUseURL = jest.fn();
jest.mock('expo-linking', () => ({
  useURL: () => mockUseURL(),
}));

const mockHandleAuthCallback = jest.fn();
jest.mock('../../../features/auth/oauth', () => ({
  handleAuthCallback: (...args: unknown[]) => mockHandleAuthCallback(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

import AuthCallbackScreen from '../../auth/callback';

describe('AuthCallbackScreen', () => {
  it('renders a loading indicator', () => {
    mockUseURL.mockReturnValue(null);

    const { getByTestId } = render(<AuthCallbackScreen />);

    expect(getByTestId('auth-callback-loading')).toBeTruthy();
  });

  it('does not call handleAuthCallback when there is no incoming URL yet', () => {
    mockUseURL.mockReturnValue(null);

    render(<AuthCallbackScreen />);

    expect(mockHandleAuthCallback).not.toHaveBeenCalled();
  });

  it('calls handleAuthCallback with the incoming URL and replaces to /(tabs) on success', async () => {
    mockUseURL.mockReturnValue('gotta-go://auth/callback?code=abc123');
    mockHandleAuthCallback.mockResolvedValue({ access_token: 'x' });

    render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockHandleAuthCallback).toHaveBeenCalledWith(
        'gotta-go://auth/callback?code=abc123'
      );
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('replaces to sign-in with an authError param when handleAuthCallback fails', async () => {
    mockUseURL.mockReturnValue('gotta-go://auth/callback?code=bad');
    mockHandleAuthCallback.mockRejectedValue(new Error('invalid grant'));

    render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(auth)/sign-in',
        params: { authError: '1' },
      });
    });
  });
});
