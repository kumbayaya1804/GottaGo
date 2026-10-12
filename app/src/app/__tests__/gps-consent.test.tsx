/**
 * Thin render + behavior tests for app/src/app/gps-consent.tsx.
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * Probity compliance and behavioral verification only, not coverage metrics.
 *
 * T-02-04 critical: "Skip for now" must NOT call requestGpsConsent.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet, useColorScheme } from 'react-native';

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

  it('when consent cannot be saved, stays on the screen and shows the save-failed message', async () => {
    mockRequestGpsConsent.mockResolvedValue('error');
    const { getByText, findByText } = render(<GpsConsentScreen />);
    fireEvent.press(getByText('Enable Location'));

    expect(
      await findByText("Couldn't save your location choice. Check your connection and try again."),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  describe('screen-reader announcement of the save failure', () => {
    const originalOS = Platform.OS;
    let announce: jest.SpyInstance;

    beforeEach(() => {
      announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => {});
      mockRequestGpsConsent.mockResolvedValue('error');
    });

    afterEach(() => {
      Platform.OS = originalOS;
      announce.mockRestore();
    });

    it('on iOS, announces the message to VoiceOver when the save fails', async () => {
      Platform.OS = 'ios';
      const { getByText, findByText } = render(<GpsConsentScreen />);
      fireEvent.press(getByText('Enable Location'));

      await findByText("Couldn't save your location choice. Check your connection and try again.");
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        "Couldn't save your location choice. Check your connection and try again.",
      );
    });

    it('on iOS, announces the message again when a retry fails', async () => {
      Platform.OS = 'ios';
      const { getByText, findByText } = render(<GpsConsentScreen />);
      fireEvent.press(getByText('Enable Location'));
      fireEvent.press(await findByText('Try again'));

      await waitFor(() => expect(announce).toHaveBeenCalledTimes(2));
    });

    it('on Android, the assertive live region announces the failure and no second announcement is posted', async () => {
      Platform.OS = 'android';
      const { getByText, findByText, UNSAFE_getAllByProps } = render(<GpsConsentScreen />);
      fireEvent.press(getByText('Enable Location'));

      await findByText("Couldn't save your location choice. Check your connection and try again.");
      expect(UNSAFE_getAllByProps({ accessibilityLiveRegion: 'assertive' }).length).toBeGreaterThan(0);
      expect(announce).not.toHaveBeenCalled();
    });

    it('does not announce a failure that arrives after the user pressed Skip', async () => {
      Platform.OS = 'ios';
      let resolveConsent!: (result: 'error') => void;
      mockRequestGpsConsent.mockReturnValue(
        new Promise<'error'>((resolve) => {
          resolveConsent = resolve;
        }),
      );
      const { getByText, queryByText } = render(<GpsConsentScreen />);
      fireEvent.press(getByText('Enable Location'));
      fireEvent.press(getByText('Skip for now'));

      resolveConsent('error');
      await waitFor(() => expect(mockRequestGpsConsent).toHaveBeenCalledTimes(1));
      expect(announce).not.toHaveBeenCalled();
      expect(
        queryByText("Couldn't save your location choice. Check your connection and try again."),
      ).toBeNull();
    });
  });

  it('after a failed save, "Try again" retries consent and continues to the map on success', async () => {
    mockRequestGpsConsent.mockResolvedValueOnce('error').mockResolvedValueOnce('granted');
    const { getByText, findByText } = render(<GpsConsentScreen />);
    fireEvent.press(getByText('Enable Location'));

    fireEvent.press(await findByText('Try again'));

    await waitFor(() => {
      expect(mockRequestGpsConsent).toHaveBeenCalledTimes(2);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('hides the save-failed message while a retry is in flight and shows it again if the retry fails', async () => {
    let failRetry!: (result: 'error') => void;
    mockRequestGpsConsent.mockResolvedValueOnce('error').mockReturnValueOnce(
      new Promise<'error'>((resolve) => {
        failRetry = resolve;
      }),
    );
    const { getByText, findByText, queryByText, getByLabelText } = render(<GpsConsentScreen />);
    fireEvent.press(getByText('Enable Location'));
    fireEvent.press(await findByText('Try again'));

    // The live region is removed during the retry, so a second failure re-mounts it
    // and TalkBack announces it again; unchanged text in a mounted region is silent.
    expect(
      queryByText("Couldn't save your location choice. Check your connection and try again."),
    ).toBeNull();
    expect(getByLabelText('Try again')).toBeTruthy();

    failRetry('error');
    expect(
      await findByText("Couldn't save your location choice. Check your connection and try again."),
    ).toBeTruthy();
  });

  it('after a failed save, "Skip for now" still continues to the map without retrying', async () => {
    mockRequestGpsConsent.mockResolvedValue('error');
    const { getByText, findByText } = render(<GpsConsentScreen />);
    fireEvent.press(getByText('Enable Location'));
    await findByText('Try again');

    fireEvent.press(getByText('Skip for now'));

    expect(mockRequestGpsConsent).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('does not navigate a second time when Skip is pressed while consent is pending', async () => {
    let resolveConsent!: (result: 'granted') => void;
    mockRequestGpsConsent.mockReturnValue(
      new Promise<'granted'>((resolve) => {
        resolveConsent = resolve;
      }),
    );
    const { getByText } = render(<GpsConsentScreen />);
    fireEvent.press(getByText('Enable Location'));
    fireEvent.press(getByText('Skip for now'));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    resolveConsent('granted');
    await waitFor(() => expect(mockRequestGpsConsent).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  describe('ERR-12 contrast (WCAG 2.1 AA, design-system 18.1)', () => {
    function luminance(hex: string) {
      const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function contrast(a: string, b: string) {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    }

    afterEach(() => {
      (useColorScheme as jest.Mock).mockReturnValue('light');
    });

    it.each(['light', 'dark'] as const)(
      '%s theme: message text reaches 4.5:1 and the warning glyph 3:1 against the message box',
      async (scheme) => {
        (useColorScheme as jest.Mock).mockReturnValue(scheme);
        mockRequestGpsConsent.mockResolvedValue('error');
        const { getByText, findByText, UNSAFE_getAllByProps } = render(<GpsConsentScreen />);
        fireEvent.press(getByText('Enable Location'));

        // design-system 18.4: an inline error pairs the message with a warning mark.
        const text = await findByText(
          "Couldn't save your location choice. Check your connection and try again.",
        );
        const box = UNSAFE_getAllByProps({ accessibilityLiveRegion: 'assertive' })[0];
        const textStyle = StyleSheet.flatten(text.props.style);
        const boxStyle = StyleSheet.flatten(box.props.style);

        expect(contrast(textStyle.color, boxStyle.backgroundColor)).toBeGreaterThanOrEqual(4.5);
        const glyphStyle = StyleSheet.flatten(getByText('⚠').props.style);
        expect(glyphStyle.color).toEqual(expect.any(String));
        expect(contrast(glyphStyle.color, boxStyle.backgroundColor)).toBeGreaterThanOrEqual(3);
      },
    );
  });

  it('when the OS denies permission, continues to the map (map shows the ERR-01 state)', async () => {
    mockRequestGpsConsent.mockResolvedValue('denied');
    const { getByText, queryByText } = render(<GpsConsentScreen />);
    fireEvent.press(getByText('Enable Location'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
    expect(
      queryByText("Couldn't save your location choice. Check your connection and try again."),
    ).toBeNull();
  });
});
