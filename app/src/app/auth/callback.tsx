/**
 * Auth Callback Screen
 *
 * Deep-link target for gotta-go://auth/callback (OAuth escapes + password recovery).
 * Reads the incoming URL, exchanges the PKCE code for a session via handleAuthCallback.
 *
 * This route sits outside the (auth) group, so the root layout's session guard
 * (redirect.ts nextRoute) does not fire for it — navigation on success/failure is
 * explicit here, matching the convention already used by reset-password.tsx and
 * sign-up.tsx for routes outside (auth)/(tabs).
 */

import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../../constants/Colors';
import { handleAuthCallback } from '../../features/auth/oauth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const handled = useRef(false);

  useEffect(() => {
    if (!url || handled.current) return;
    handled.current = true;

    handleAuthCallback(url)
      .then(() => {
        router.replace('/(tabs)');
      })
      .catch(() => {
        router.replace({ pathname: '/(auth)/sign-in', params: { authError: '1' } });
      });
  }, [url, router]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <ActivityIndicator testID="auth-callback-loading" color={colors.primary} />
    </View>
  );
}
