/**
 * Protected route segments. A route is protected if it requires authentication
 * to access — the caller (root _layout.tsx) gates on loading before calling
 * nextRoute, so no loading check is needed here.
 *
 * NOTE (Pattern 2 gotcha d): (tabs)/profile is intentionally PUBLIC navigation.
 * Auth-required actions inside the profile screen show a modal, not a redirect.
 */
const PROTECTED_SEGMENTS: ReadonlySet<string> = new Set(['submit']);

/**
 * Returns true when the given route segments represent a protected route
 * that requires an authenticated session to view.
 *
 * @param segments - array from expo-router useSegments()
 */
export function isProtected(segments: string[]): boolean {
  if (segments[0] !== '(tabs)') return false;
  const leaf = segments[1];
  if (leaf === undefined) return false;
  return PROTECTED_SEGMENTS.has(leaf);
}

/**
 * Pure redirect decision function. Returns the target route to navigate to,
 * or null if no navigation is needed.
 *
 * Rules:
 *   - No session + protected segment → '/(auth)/sign-in'
 *   - Has session + in (auth) group  → '/(tabs)'
 *   - Otherwise                      → null (no navigation)
 *
 * Loading is gated by the CALLER (root _layout), not here.
 *
 * @param segments - array from expo-router useSegments()
 * @param hasSession - whether a valid session exists
 */
export function nextRoute(segments: string[], hasSession: boolean): string | null {
  const inAuthGroup = segments[0] === '(auth)';

  if (!hasSession && isProtected(segments)) {
    return '/(auth)/sign-in';
  }

  if (hasSession && inAuthGroup) {
    return '/(tabs)';
  }

  return null;
}
