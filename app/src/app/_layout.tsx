import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '../features/auth/SessionProvider';
import { useSession } from '../features/auth/useSession';
import { nextRoute } from '../features/auth/redirect';
import { supabase } from '../lib/supabase';

const queryClient = new QueryClient();

/**
 * Guard component - reads session state and performs route-level redirects.
 *
 * Two effects:
 *   1. Session guard: calls nextRoute() whenever loading/session/segments change.
 *      If loading, does nothing. Otherwise redirects as needed.
 *   2. PASSWORD_RECOVERY: separate supabase.auth.onAuthStateChange subscription
 *      that watches for the PASSWORD_RECOVERY event and navigates to /reset-password.
 *      Unsubscribes on unmount.
 *
 * When loading is true, renders null (blank splash) per CONTEXT section 1.
 */
function GuardComponent() {
  const sessionValue = useSession();
  const session = sessionValue?.session ?? null;
  const loading = sessionValue?.loading ?? true;
  const suppressGuardRedirect = sessionValue?.suppressGuardRedirect ?? false;
  const router = useRouter();
  const segments = useSegments();

  // Effect 1: redirect guard based on session state
  //
  // Skips when suppressGuardRedirect is set — screens that create a session as a
  // side effect of an in-flight multi-step flow (e.g. sign-up's updateProfile call
  // after signUp()) raise this flag so this effect doesn't race their own explicit
  // navigation/error handling (WU-02-T4 review finding).
  useEffect(() => {
    if (loading || suppressGuardRedirect) return;
    const route = nextRoute(segments as string[], !!session);
    if (route !== null) {
      // as never required: expo-router replace type is strict about known routes
      router.replace(route as never);
    }
  }, [loading, suppressGuardRedirect, session, segments, router]);

  // Effect 2: PASSWORD_RECOVERY deep-link handler (separate subscription)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password' as never);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return null;
  }

  return <Stack />;
}

/**
 * RootLayout - entry point for Expo Router.
 *
 * Wraps the entire navigation tree in:
 *   1. GestureHandlerRootView - required by react-native-gesture-handler
 *   2. QueryClientProvider - enables lazy TanStack Query fetches (e.g. profile.tsx
 *      stats/display-name) per CONTEXT §1 decision #3 ("TanStack Query lazy elsewhere")
 *   3. SessionProvider - provides auth session context to all descendants
 *   4. GuardComponent - handles route protection and PASSWORD_RECOVERY redirects
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <GuardComponent />
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
