import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../constants/Colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { LEGAL_URLS } from '../constants/legal';

/**
 * Welcome screen — the app entry point at route "/".
 * Shown when there is no active session.
 *
 * Contains:
 *   - Logo placeholder (View with accessibilityRole='image')
 *   - App title + tagline
 *   - Sign In and Create Account CTAs
 *   - TOS/Privacy Policy subhead with tappable links
 *
 * Styling rules:
 *   - All colors from Colors[colorScheme] — no raw hex
 *   - All spacing from spacing tokens — no magic numbers
 *   - All font sizes from typography scale — no inline fontSize
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.base,
      justifyContent: 'center',
    },
    logoPlaceholder: {
      width: spacing.giant,
      height: spacing.giant,
      backgroundColor: colors.primarySurface,
      marginBottom: spacing.xl,
      alignSelf: 'center',
    },
    title: {
      ...typography.display,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    tagline: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xxl,
    },
    signInButton: {
      height: spacing.giant - spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    signInButtonText: {
      ...typography.bodyMedium,
      color: colors.textInverse,
    },
    createAccountButton: {
      height: spacing.xxxl,
      backgroundColor: colors.primarySurface,
      borderRadius: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    createAccountButtonText: {
      ...typography.bodyMedium,
      color: colors.primary,
    },
    tosContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    tosText: {
      ...typography.subhead,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    tosLink: {
      ...typography.subhead,
      color: colors.textLink,
    },
  });

  return (
    <View style={styles.container}>
      <View
        style={styles.logoPlaceholder}
        accessibilityRole="image"
        accessibilityLabel="Gotta Go logo"
      />
      <Text style={styles.title}>Gotta Go</Text>
      <Text style={styles.tagline}>{"Find a bathroom before it's too late."}</Text>
      <TouchableOpacity
        style={styles.signInButton}
        onPress={() => router.push('/(auth)/sign-in')}
        accessibilityRole="button"
        accessibilityLabel="Sign In"
      >
        <Text style={styles.signInButtonText}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.createAccountButton}
        onPress={() => router.push('/(auth)/sign-up')}
        accessibilityRole="button"
        accessibilityLabel="Create Account"
      >
        <Text style={styles.createAccountButtonText}>Create Account</Text>
      </TouchableOpacity>
      <View style={styles.tosContainer}>
        <Text style={styles.tosText}>By continuing, you agree to our </Text>
        <Text
          style={styles.tosLink}
          onPress={() => Linking.openURL(LEGAL_URLS.termsOfService)}
        >
          Terms of Service
        </Text>
        <Text style={styles.tosText}> and </Text>
        <Text
          style={styles.tosLink}
          onPress={() => Linking.openURL(LEGAL_URLS.privacyPolicy)}
        >
          Privacy Policy
        </Text>
        <Text style={styles.tosText}>.</Text>
      </View>
    </View>
  );
}
