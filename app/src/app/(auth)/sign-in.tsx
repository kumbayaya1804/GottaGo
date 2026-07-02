/**
 * Sign-In Screen
 *
 * Error display rule (T-02-01):
 *   ONE code path for ALL auth failures. Only distinction:
 *   (auth error with status) vs (network/fetch error without status).
 *
 * RED phase was confirmed by test output showing:
 *   Tests: 2 failed - renders Email/Password fields, renders Forgot password link
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
  Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { signInSchema } from '../../features/auth/validation';
import { signInWithGoogle } from '../../features/auth/oauth';
import { supabase } from '../../lib/supabase';

type SignInFormValues = {
  email: string;
  password: string;
};

const AUTH_ERROR_COPY = 'Invalid email or password.';
const NETWORK_ERROR_COPY = "Couldn't sign in. Check your connection and try again.";

export default function SignInScreen() {
  const router = useRouter();
  const { authError } = useLocalSearchParams<{ authError?: string }>();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const [errorMessage, setErrorMessage] = useState<string | null>(
    authError ? NETWORK_ERROR_COPY : null
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignInFormValues) {
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        setErrorMessage(AUTH_ERROR_COPY);
      }
    } catch {
      setErrorMessage(NETWORK_ERROR_COPY);
    }
  }

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const code = await signInWithGoogle();
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMessage(NETWORK_ERROR_COPY);
        }
      }
    } catch {
      setErrorMessage(NETWORK_ERROR_COPY);
    } finally {
      setGoogleLoading(false);
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
      marginBottom: spacing.xxl,
      textAlign: 'center',
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
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      marginBottom: spacing.md,
    },
    passwordInput: {
      flex: 1,
      height: spacing.giant - spacing.xs,
      paddingHorizontal: spacing.base,
      ...typography.body,
      color: colors.textPrimary,
    },
    eyeButton: {
      paddingHorizontal: spacing.base,
      justifyContent: 'center',
      alignItems: 'center',
    },
    eyeButtonText: {
      ...typography.caption,
      color: colors.textLink,
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
    forgotLink: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    forgotLinkText: {
      ...typography.subhead,
      color: colors.textLink,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.divider,
    },
    dividerText: {
      ...typography.caption,
      color: colors.textSecondary,
      marginHorizontal: spacing.sm,
    },
    createAccountLink: {
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    createAccountLinkText: {
      ...typography.subhead,
      color: colors.textLink,
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
    secondaryButton: {
      height: spacing.giant - spacing.md,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    secondaryButtonText: {
      ...typography.bodyMedium,
      color: colors.primary,
    },
    appleStub: {
      height: spacing.giant - spacing.md,
      borderWidth: 1.5,
      borderColor: colors.textDisabled,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    appleStubText: {
      ...typography.bodyMedium,
      color: colors.textDisabled,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Welcome back</Text>

      {errorMessage !== null && (
        <View style={styles.errorContainer} accessibilityLiveRegion="assertive">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textDisabled}
            keyboardType="email-address"
            autoCapitalize="none"
            value={value}
            onChangeText={onChange}
          />
        )}
      />

      <View style={styles.passwordRow}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry={!passwordVisible}
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        <Pressable
          style={styles.eyeButton}
          onPress={() => setPasswordVisible((v) => !v)}
          accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
        >
          <Text style={styles.eyeButtonText}>{passwordVisible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Sign In"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.submitButtonText}>Sign In</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.forgotLink}
        onPress={() => router.push('/(auth)/forgot-password' as never)}
        accessibilityRole="link"
      >
        <Text style={styles.forgotLinkText}>Forgot password?</Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {Platform.OS === 'android' ? (
        <Pressable
          style={styles.secondaryButton}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityHint="Sign in with your Google account"
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>Continue with Google</Text>
          )}
        </Pressable>
      ) : (
        <View
          style={styles.appleStub}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Apple — coming soon"
          accessibilityState={{ disabled: true }}
        >
          <Text style={styles.appleStubText}>Sign in with Apple — coming soon</Text>
        </View>
      )}

      <Pressable
        style={styles.createAccountLink}
        onPress={() => router.push('/(auth)/sign-up')}
        accessibilityRole="link"
      >
        <Text style={styles.createAccountLinkText}>Create account</Text>
      </Pressable>
    </View>
  );
}

