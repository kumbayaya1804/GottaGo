import { Stack } from 'expo-router';

/**
 * Auth group layout — headerless Stack.
 * Screens: sign-in, sign-up, reset-password (future).
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
