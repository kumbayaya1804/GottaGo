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

/**
 * Screens a sign-in may return to (ERR-10: signing in resumes the action that asked for
 * it). An allowlist, so nothing can stash an arbitrary destination for after sign-in.
 */
const POST_AUTH_RETURN_ROUTES: ReadonlySet<string> = new Set(['/verify']);

let postAuthReturn: string | null = null;

/**
 * Remembers where to send the user once they are signed in. Call it just before opening
 * sign-in or sign-up from a screen that should resume afterwards. Ignored for routes
 * outside the allowlist.
 */
export function rememberPostAuthReturn(route: string): void {
  if (POST_AUTH_RETURN_ROUTES.has(route)) postAuthReturn = route;
}

/** Returns the remembered route, if any, and forgets it: each sign-in resumes once. */
export function takePostAuthReturn(): string | null {
  const route = postAuthReturn;
  postAuthReturn = null;
  return route;
}

/** Forgets the remembered route, e.g. when the user leaves sign-in without signing in. */
export function forgetPostAuthReturn(): void {
  postAuthReturn = null;
}

/**
 * True while the user is inside the sign-in flow: the (auth) screens or the OAuth
 * callback route, where a sign-in may still complete.
 */
export function isInAuthFlow(segments: string[]): boolean {
  return segments[0] === '(auth)' || segments[0] === 'auth';
}

/** The two router calls `resumeAfterAuth` needs (expo-router's Router satisfies it). */
interface ResumeRouter {
  dismissTo: (href: never) => void;
  replace: (href: never) => void;
}

/**
 * Finishes a sign-in or sign-up journey: back to the screen that asked for it, if one is
 * remembered (dismissTo unwinds to it, still on the stack beneath the auth screens),
 * otherwise to the tabs. Used by every screen that ends the journey: the OAuth callback
 * and GPS consent, which new accounts pass through after sign-up.
 */
export function resumeAfterAuth(router: ResumeRouter): void {
  const resume = takePostAuthReturn();
  if (resume !== null) router.dismissTo(resume as never);
  else router.replace('/(tabs)' as never);
}
