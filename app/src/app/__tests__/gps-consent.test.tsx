/**
 * Thin render + behavior tests for app/src/app/gps-consent.tsx.
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 *
 * T-02-04 critical: "Skip for now" must NOT call requestGpsConsent.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace })),
  useSegments: jest.fn(() => []),
}));

const mockRequestGpsConsent = jest.fn();
jest.mock('../../features/auth/gpsConsent', () => ({
  requestGpsConsent: (...args: unknown[]) => mockRequestGpsConsent(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestGpsConsent.mockResolvedValue('granted');
});

import GpsConsentScreen from '../gps-consent';

describe('GpsConsentScreen', () => {
  it('renders "Enable Location" button', () => {
    const { getByText } = render(<GpsConsentScreen />);
    expect(getByText('Enable Location')).toBeTruthy();
  });

  it('pressing "Enable Location" calls requestGpsConsent()', async () => {
    const { getByText } = render(<GpsConsentScreen />);
    fireEvent.press(getByText('Enable Location'));

    await waitFor(() => {
      expect(mockRequestGpsConsent).toHaveBeenCalledTimes(1);
    });
  });

  it('"Skip for now" does NOT call requestGpsConsent — navigates directly (T-02-04)', () => {
    const { getByText } = render(<GpsConsentScreen />);
    fireEvent.press(getByText('Skip for now'));

    expect(mockRequestGpsConsent).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('after requestGpsConsent resolves, router.replace("/(tabs)") is called', async () => {
    const { getByText } = render(<GpsConsentScreen />);
    fireEvent.press(getByText('Enable Location'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });
});
