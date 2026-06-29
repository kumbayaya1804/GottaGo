/**
 * Forgot Password Screen
 *
 * Two states: 'form' (email input) and 'success' (confirmation).
 * Uses Linking.createURL for the redirectTo deep-link (expo-auth-session not installed).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { supabase } from '../../lib/supabase';

type ScreenState = 'form' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSendResetEmail() {
    if (!email.trim()) return;
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        setErrorMessage(error.message || 'Something went wrong. Try again.');
      } else {
        setScreenState('success');
      }
    } catch {
      setErrorMessage('Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.base,
      justifyContent: 'center',
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
      marginBottom: spacing.xxl,
    },
    input: {
      height: spacing.giant - spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.base,
      ...typography.body,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      marginBottom: spacing.md,
    },
    submitButton: {
      height: spacing.giant - spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      ...typography.bodyMedium,
      color: colors.textInverse,
    },
    errorContainer: {
      backgroundColor: colors.primarySurface,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    errorText: {
      ...typography.subhead,
      color: colors.errorRed,
    },
    backLink: {
      alignItems: 'center',
      marginTop: spacing.xl,
    },
    backLinkText: {
      ...typography.subhead,
      color: colors.textLink,
    },
  });

  if (screenState === 'success') {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Check your email</Text>
        <Text style={styles.body}>
          {`We sent a password reset link to ${email}`}
        </Text>
        <Pressable
          style={styles.backLink}
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityRole="link"
        >
          <Text style={styles.backLinkText}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Reset Password</Text>
      <Text style={styles.body}>
        Enter your email and we will send you a reset link.
      </Text>

      {errorMessage !== null && (
        <View style={styles.errorContainer} accessibilityLiveRegion="assertive">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textDisabled}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <Pressable
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
        onPress={handleSendResetEmail}
        disabled={isLoading}
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.submitButtonText}>Send Reset Email</Text>
        )}
      </Pressable>
    </View>
  );
}
