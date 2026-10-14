/**
 * GPS Consent Screen
 *
 * Shown after account creation. Explains GPS usage, offers:
 * - "Enable Location": calls requestGpsConsent(). On grant or denial it continues to
 *   /(tabs). If the consent save fails it stays here and shows ERR-12 with "Try again".
 * - "Skip for now": navigates directly to /(tabs) WITHOUT calling requestGpsConsent
 *
 * T-02-04: The "Skip for now" path MUST NOT call requestGpsConsent or set_gps_consent.
 * Writing consent before the OS grants permission is a GDPR violation.
 */

import React, { useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { radius } from '../constants/radius';
import { requestGpsConsent } from '../features/auth/gpsConsent';

// ERR-12 (docs/design/design-system.md, Error-State Copy Matrix)
const SAVE_FAILED_MESSAGE =
  "Couldn't save your location choice. Check your connection and try again.";

export default function GpsConsentScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const [isLoading, setIsLoading] = useState(false);
  // True once a save has failed; keeps the primary button labelled 'Try again'.
  const [saveFailed, setSaveFailed] = useState(false);
  // The message is hidden while a retry is in flight, so each failure mounts the
  // live region afresh. Unchanged text in a mounted live region is not re-announced.
  const [errorVisible, setErrorVisible] = useState(false);
  // Set synchronously when the user skips, so a consent request still in flight
  // cannot navigate a second time, or report a failure, when it settles. That request
  // may still save consent after the skip; the user had already granted the OS
  // permission, so the record is accurate.
  const skippedRef = React.useRef(false);

  async function handleEnableLocation() {
    setIsLoading(true);
    setErrorVisible(false);
    const result = await requestGpsConsent();
    if (skippedRef.current) return;
    setIsLoading(false);
    if (result === 'error') {
      setSaveFailed(true);
      setErrorVisible(true);
      // accessibilityLiveRegion is Android-only, so VoiceOver needs an explicit
      // announcement. TalkBack gets it from the live region; posting here too
      // would read the message twice.
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(SAVE_FAILED_MESSAGE);
      }
      return;
    }
    router.replace('/(tabs)');
  }

  function handleSkip() {
    // T-02-04: Do NOT call requestGpsConsent on skip
    skippedRef.current = true;
    router.replace('/(tabs)');
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.base,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconPlaceholder: {
      width: spacing.giant,
      height: spacing.giant,
      backgroundColor: colors.primarySurface,
      borderRadius: radius.xl,
      marginBottom: spacing.xxl,
    },
    heading: {
      ...typography.h1,
      color: colors.textPrimary,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xxxl,
      paddingHorizontal: spacing.sm,
    },
    // Inline error (design-system 18.4): a warning mark plus the message. errorRed text
    // on primarySurface is 3.4:1 in the light theme, below the 4.5:1 body-text minimum,
    // so the message uses textPrimary and only the mark is red. This app ships no icon
    // library; the text glyph stands in for alert-circle, as on the Submit screen.
    errorContainer: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.primarySurface,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    errorGlyph: {
      ...typography.subhead,
      color: colors.errorRed,
      marginRight: spacing.sm,
    },
    errorText: {
      ...typography.subhead,
      color: colors.textPrimary,
      flex: 1,
    },
    enableButton: {
      height: spacing.giant - spacing.xs,
      width: '100%',
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    enableButtonDisabled: {
      opacity: 0.6,
    },
    enableButtonText: {
      ...typography.bodyMedium,
      color: colors.textInverse,
    },
    skipButton: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    skipButtonText: {
      ...typography.subhead,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <View
        style={styles.iconPlaceholder}
        accessibilityRole="image"
        accessibilityLabel="Location icon"
      />

      <Text style={styles.heading}>Location Access</Text>
      <Text style={styles.body}>
        Gotta Go uses your location to find nearby bathrooms and verify contributions.
      </Text>

      {errorVisible && (
        <View style={styles.errorContainer} accessibilityLiveRegion="assertive">
          <Text style={styles.errorGlyph}>⚠</Text>
          <Text style={styles.errorText}>{SAVE_FAILED_MESSAGE}</Text>
        </View>
      )}

      <Pressable
        style={[styles.enableButton, isLoading && styles.enableButtonDisabled]}
        onPress={handleEnableLocation}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={saveFailed ? 'Try again' : 'Enable Location'}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.enableButtonText}>
            {saveFailed ? 'Try again' : 'Enable Location'}
          </Text>
        )}
      </Pressable>

      <Pressable
        style={styles.skipButton}
        onPress={handleSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip for now"
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </Pressable>
    </View>
  );
}
