/**
 * Sign-Up Screen
 *
 * Form with display name + email + password. Calls checkDisplayNameAvailable
 * before supabase.auth.signUp. On success, navigates to /gps-consent.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { signUpSchema } from '../../features/auth/validation';
import {
  checkDisplayNameAvailable,
  isDisplayNameTakenError,
} from '../../features/auth/displayName';
import { updateProfile, DISPLAY_NAME_TAKEN_MESSAGE } from '../../features/profile/updateProfile';
import { useSession } from '../../features/auth/useSession';
import { supabase } from '../../lib/supabase';
import { LEGAL_URLS } from '../../constants/legal';

type SignUpFormValues = {
  displayName: string;
  email: string;
  password: string;
};

const GENERIC_ERROR_COPY = 'Something went wrong. Try again.';

export default function SignUpScreen() {
  const router = useRouter();
  const sessionCtx = useSession();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [awaitingProfileProvisioning, setAwaitingProfileProvisioning] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  // Suppresses the root guard's auto-redirect while this screen is completing
  // post-signUp provisioning (updateProfile) — signUp() creates a session immediately
  // (email confirmation disabled), so without this the guard can race this screen's
  // own error handling / navigation and silently strand the user on /(tabs) with no
  // display_name and no visible error (WU-02-T4 review finding). Cleared on unmount
  // (i.e. once this screen is actually navigated away from), not on every branch
  // return, so a visible updateProfile error also keeps the guard suppressed until
  // the user leaves this screen.
  useEffect(() => {
    if (!awaitingProfileProvisioning) return;
    sessionCtx?.setSuppressGuardRedirect(true);
    return () => {
      sessionCtx?.setSuppressGuardRedirect(false);
    };
  }, [awaitingProfileProvisioning, sessionCtx]);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  async function onSubmit(values: SignUpFormValues) {
    // If a prior submit already created the auth account but updateProfile then
    // failed (taken name, transient error), the account/session already exist —
    // re-running checkDisplayNameAvailable/signUp would hit an "already registered"
    // error instead of actually retrying. Skip straight to Step 3 (WU-02-T4 review
    // finding, round 2).
    if (!accountCreated) {
      // Step 1: Check display name availability
      try {
        const available = await checkDisplayNameAvailable(values.displayName);
        if (!available) {
          setError('displayName', { message: DISPLAY_NAME_TAKEN_MESSAGE });
          return;
        }
      } catch (e) {
        if (isDisplayNameTakenError(e)) {
          setError('displayName', { message: DISPLAY_NAME_TAKEN_MESSAGE });
        } else {
          setError('root', { message: GENERIC_ERROR_COPY });
        }
        return;
      }

      // Step 2: Create account. Suppress the root guard first — signUp() creates a
      // session as a side effect (email confirmation disabled), and the guard would
      // otherwise be free to redirect away from this screen before Step 3 completes.
      setAwaitingProfileProvisioning(true);
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { display_name: values.displayName } },
      });

      if (error) {
        setError('root', { message: error.message || 'Something went wrong.' });
        return;
      }

      setAccountCreated(true);
    }

    // Step 3: persist display_name (handle_new_user trigger only sets id+email)
    try {
      await updateProfile(values.displayName);
    } catch (e) {
      if (e instanceof Error && e.message === DISPLAY_NAME_TAKEN_MESSAGE) {
        setError('displayName', { message: DISPLAY_NAME_TAKEN_MESSAGE });
      } else {
        setError('root', { message: GENERIC_ERROR_COPY });
      }
      return;
    }

    router.replace('/gps-consent' as never);
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
      marginBottom: spacing.xs,
    },
    fieldError: {
      ...typography.caption,
      color: colors.errorRed,
      marginBottom: spacing.sm,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      marginBottom: spacing.xs,
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
      marginTop: spacing.md,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      ...typography.bodyMedium,
      color: colors.textInverse,
    },
    rootErrorContainer: {
      backgroundColor: colors.primarySurface,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    rootErrorText: {
      ...typography.subhead,
      color: colors.errorRed,
    },
    tosContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: spacing.sm,
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
      <Text style={styles.heading}>Join Gotta Go</Text>

      {errors.root?.message && (
        <View style={styles.rootErrorContainer} accessibilityLiveRegion="assertive">
          <Text style={styles.rootErrorText}>{errors.root.message}</Text>
        </View>
      )}

      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="none"
            value={value}
            onChangeText={onChange}
          />
        )}
      />
      {errors.displayName?.message && (
        <Text style={styles.fieldError}>{errors.displayName.message}</Text>
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
      {errors.email?.message && (
        <Text style={styles.fieldError}>{errors.email.message}</Text>
      )}

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
      {errors.password?.message && (
        <Text style={styles.fieldError}>{errors.password.message}</Text>
      )}

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Create Account"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.submitButtonText}>Create Account</Text>
        )}
      </Pressable>

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

