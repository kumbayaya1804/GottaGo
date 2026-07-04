/**
 * Reset Password Screen
 *
 * Shown when the user follows the password-reset deep-link (PASSWORD_RECOVERY event).
 * Single field: New Password. Calls supabase.auth.updateUser({ password }).
 * On success: navigates to /(tabs).
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
import { Colors } from '../constants/Colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { radius } from '../constants/radius';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSetNewPassword() {
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage(error.message || 'Something went wrong. Try again.');
      } else {
        router.replace('/(tabs)');
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
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Reset Your Password</Text>
      <Text style={styles.body}>
        Choose a new password for your account.
      </Text>

      {errorMessage !== null && (
        <View style={styles.errorContainer} accessibilityLiveRegion="assertive">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="New Password"
        placeholderTextColor={colors.textDisabled}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
        onPress={handleSetNewPassword}
        disabled={isLoading}
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.submitButtonText}>Set New Password</Text>
        )}
      </Pressable>
    </View>
  );
}

