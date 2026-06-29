/**
 * GPS Consent Screen
 *
 * Shown after account creation. Explains GPS usage, offers:
 * - "Enable Location": calls requestGpsConsent() then navigates to /(tabs)
 * - "Skip for now": navigates directly to /(tabs) WITHOUT calling requestGpsConsent
 *
 * T-02-04: The "Skip for now" path MUST NOT call requestGpsConsent or set_gps_consent.
 * Writing consent before the OS grants permission is a GDPR violation.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { radius } from '../constants/radius';
import { requestGpsConsent } from '../features/auth/gpsConsent';

export default function GpsConsentScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const [isLoading, setIsLoading] = useState(false);

  async function handleEnableLocation() {
    setIsLoading(true);
    try {
      await requestGpsConsent();
    } finally {
      setIsLoading(false);
      router.replace('/(tabs)');
    }
  }

  function handleSkip() {
    // T-02-04: Do NOT call requestGpsConsent on skip
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

      <Pressable
        style={[styles.enableButton, isLoading && styles.enableButtonDisabled]}
        onPress={handleEnableLocation}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel="Enable Location"
      >
        {isLoading ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.enableButtonText}>Enable Location</Text>
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

