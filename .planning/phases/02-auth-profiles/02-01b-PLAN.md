---
phase: "02-auth-profiles"
plan: "01b"
type: execute
wave: 2
depends_on: ["02-01a"]
autonomous: false   # TDD-first screens + manual smoke-test verification required
requirements: [REQ-2-1, REQ-2-4, REQ-2-6, REQ-2-7]
files_modified:
  - app/src/features/auth/validation.ts
  - app/src/features/auth/redirect.ts
  - app/src/features/auth/SessionProvider.tsx
  - app/src/features/auth/useSession.ts
  - app/src/features/auth/displayName.ts
  - app/src/features/auth/gpsConsent.ts
  - app/src/features/auth/__tests__/validation.test.ts
  - app/src/features/auth/__tests__/redirect.test.ts
  - app/src/features/auth/__tests__/SessionProvider.test.tsx
  - app/src/features/auth/__tests__/useSession.test.ts
  - app/src/features/auth/__tests__/displayName.test.ts
  - app/src/features/auth/__tests__/gpsConsent.test.ts
  - app/src/app/_layout.tsx
  - app/src/app/index.tsx
  - app/src/app/gps-consent.tsx
  - app/src/app/reset-password.tsx
  - app/src/app/(auth)/_layout.tsx
  - app/src/app/(auth)/sign-in.tsx
  - app/src/app/(auth)/sign-up.tsx
  - app/src/app/(auth)/forgot-password.tsx
  - app/src/app/(tabs)/_layout.tsx
  - app/src/app/(tabs)/nearby.tsx
  - app/src/app/(tabs)/submit.tsx

must_haves:
  truths:
    - "App cold-starts to a blank splash, then to the Welcome screen (Sign In / Create Account) when there is no session"
    - "User can create an account with email + password + display name and receives a session immediately (email confirmation disabled)"
    - "User signing in with bad credentials sees the generic copy 'Invalid email or password.' (no enumeration)"
    - "A public.users row is auto-created on signup by the handle_new_user trigger (from 02-01a)"
    - "Session persists across app restart via AsyncStorage-backed supabase auth"
    - "An unauthenticated user who reaches a protected route is redirected to /(auth)/sign-in via the root guard"
    - "After first sign-in/up the GPS Consent screen appears; gps_consent=true + gps_consent_at=now() are written ONLY after the OS dialog resolves to granted"
    - "display_name is unique case-insensitively; a taken name surfaces 'That display name is already taken.'"
    - "Forgot-password sends a reset email; the PASSWORD_RECOVERY event routes the user to the in-app /reset-password screen"
  artifacts:
    - path: "app/src/features/auth/redirect.ts"
      provides: "Pure nextRoute(segments, hasSession) guard decision"
      exports: ["nextRoute", "isProtected"]
    - path: "app/src/features/auth/SessionProvider.tsx"
      provides: "Session context with loading gate + onAuthStateChange subscription + signOut()"
      exports: ["SessionProvider", "useSession"]
    - path: "app/src/features/auth/validation.ts"
      provides: "Zod schemas for displayName/email/password with locked error copy"
      exports: ["displayName", "email", "password", "signUpSchema", "signInSchema"]
    - path: "app/src/features/auth/gpsConsent.ts"
      provides: "granted-only consent writer calling set_gps_consent RPC"
      exports: ["requestGpsConsent"]
    - path: "app/src/features/auth/displayName.ts"
      provides: "check_display_name_available caller + unique-violation → friendly error mapping"
      exports: ["checkDisplayNameAvailable", "isDisplayNameTakenError"]
  key_links:
    - from: "app/src/app/_layout.tsx"
      to: "app/src/features/auth/redirect.ts"
      via: "guard effect calls nextRoute(segments, !!session) and router.replace, gated on loading"
      pattern: "nextRoute\\("
    - from: "app/src/features/auth/SessionProvider.tsx"
      to: "supabase.auth.onAuthStateChange"
      via: "subscription set in useEffect"
      pattern: "onAuthStateChange"
    - from: "app/src/app/(auth)/sign-up.tsx"
      to: "supabase.auth.signUp + check_display_name_available"
      via: "submit handler"
      pattern: "signUp|check_display_name_available"
    - from: "app/src/app/gps-consent.tsx"
      to: "app/src/features/auth/gpsConsent.ts"
      via: "Enable Location button → requestGpsConsent → set_gps_consent RPC on granted"
      pattern: "requestGpsConsent|set_gps_consent"
---

<objective>
Auth-logic modules and screens for Phase 2 email/password path — built on the Wave 0 foundation
delivered by 02-01a (packages, babel, migrations, token files all complete before this plan starts).

Scope: Six covered auth-logic modules in src/features/auth/ (validation, redirect, SessionProvider,
useSession, displayName, gpsConsent), the root layout with SessionProvider + protected-route guard,
the Welcome screen, navigation shell (tab/auth layouts, nearby/submit stubs), and the five auth
screens (Sign-In, Sign-Up, Forgot Password, Reset Password, GPS Consent).

Purpose: Deliver the email/password identity path, session persistence, protected routing, and GPS
consent UX that everything else in Phase 2 (and Phases 3+) depends on.

Output: All src/features/auth/** modules at 100% coverage; thin auth screens; navigation shell.
Final artifacts documented in `.planning/phases/02-auth-profiles/02-01-SUMMARY.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@CLAUDE.md
@.planning/phases/02-auth-profiles/02-CONTEXT.md
@.planning/phases/02-auth-profiles/02-RESEARCH.md
@.planning/phases/02-auth-profiles/02-PATTERNS.md
@.planning/phases/02-auth-profiles/02-UI-SPEC.md
@docs/design/design-system.md
@docs/schema-contract.md
@.planning/phases/02-auth-profiles/02-01a-SUMMARY.md

<interfaces>
<!-- Contracts produced by 02-01a + the codebase. Use directly. -->

From 02-01a (already built):
  app/constants/Colors.ts → 39-token Colors object (light + dark)
  app/src/constants/typography.ts, spacing.ts, radius.ts → full token scales
  app/src/constants/legal.ts → LEGAL_URLS { termsOfService, privacyPolicy }
  app/babel.config.js → babel-preset-expo (GestureHandlerRootView wraps root layout here)
  supabase migrations 00000–00002 applied → handle_new_user trigger, lower(display_name) unique index,
    check_display_name_available (anon+auth) + set_gps_consent (auth only) RPCs live

Shared Supabase client (DO NOT modify — import only) — app/src/lib/supabase.ts:
  export const supabase = createClient<Database>(url, anonKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
  });

Deep-link scheme (authoritative): app.config.ts:10 → scheme: 'gotta-go'
  → all redirects use gotta-go://auth/callback. CONTEXT §4 previously said 'gottago' — that is corrected.

Test mock pattern to copy — app/src/lib/__tests__/supabase.test.ts:4-16, 39-61
  (jest.mock of @supabase/supabase-js, AsyncStorage, url-polyfill; jest.isolateModules + env save/restore).

jest.setup.ts already mocks (from 02-01a): @rnmapbox/maps, expo-location, react-native-mmkv,
  EXPO_PUBLIC_SUPABASE_* env, expo-web-browser, expo-router (useSegments/useRouter).
  DO NOT redeclare any existing mock.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 5: Covered auth-logic modules (validation, redirect, SessionProvider, useSession, displayName, gpsConsent)</name>
  <files>app/src/features/auth/validation.ts, app/src/features/auth/redirect.ts, app/src/features/auth/SessionProvider.tsx, app/src/features/auth/useSession.ts, app/src/features/auth/displayName.ts, app/src/features/auth/gpsConsent.ts, and colocated __tests__/*.test.ts(x)</files>
  <behavior>
    - validation: signUpSchema rejects display name <3, >20, and chars outside /^[A-Za-z0-9 _-]+$/ with the exact UI-SPEC error strings; password <8 → "Password must be at least 8 characters."; email invalid → "Enter a valid email address."
    - redirect.nextRoute: (no session, protected segment) → '/(auth)/sign-in'; (session, in '(auth)') → '/(tabs)'; (no session, '(tabs)/index') → null (Map is public); (no session, '(tabs)/profile') → null (public per Pattern 2 gotcha d); loading is gated by the caller, not nextRoute.
    - SessionProvider: starts loading=true; after getSession resolves sets session + loading=false; an onAuthStateChange SIGNED_IN sets session; SIGNED_OUT clears it; PASSWORD_RECOVERY exposes a recovery flag/route signal; signOut() calls supabase.auth.signOut(); unsubscribes on unmount.
    - displayName: checkDisplayNameAvailable(name) calls rpc('check_display_name_available', {name}) and returns its boolean; isDisplayNameTakenError maps a Postgres unique-violation (code 23505 on users_display_name_lower_uniq) to true.
    - gpsConsent.requestGpsConsent: calls Location.requestForegroundPermissionsAsync; on status 'granted' calls rpc('set_gps_consent') and returns 'granted'; on 'denied' returns 'denied' and performs NO rpc call (T-02-04).
  </behavior>
  <read_first>
    - .planning/phases/02-auth-profiles/02-RESEARCH.md (§Pattern 1 SessionProvider, §Pattern 2 redirect, §Pattern 5 displayName, §Code Examples zod + GPS consent)
    - .planning/phases/02-auth-profiles/02-PATTERNS.md (validation analog appConfigSmoke.ts; service import convention; test mock + isolateModules)
    - .planning/phases/02-auth-profiles/02-UI-SPEC.md (validation error-copy table; Color/Error matrices)
    - app/src/lib/__tests__/supabase.test.ts (mock structure to copy)
    - app/src/lib/supabase.ts (import the shared `supabase` client; never recreate it)
  </read_first>
  <action>
    TDD (test-first, red→green→refactor) for every file — these are TDD-Guard-ON src/features modules with 100% coverage.
    validation.ts: zod schemas `displayName`, `email`, `password`, and composed `signUpSchema`/`signInSchema`, using the exact
    locked error strings from the UI-SPEC validation table. redirect.ts: pure `isProtected(segments)` + `nextRoute(segments, hasSession)`
    per Pattern 2 (treat (tabs)/index and (tabs)/profile as public — only specific actions gate via the Auth-Required modal in 02-02).
    SessionProvider.tsx: React Context holding `{ session, loading }`, seeded from supabase.auth.getSession(), updated on every
    onAuthStateChange event (handle INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, PASSWORD_RECOVERY, USER_UPDATED),
    exposing `signOut()`; do NOT fetch the users row here (CONTEXT §1/#3 — lazy via TanStack Query elsewhere). useSession.ts: the
    consumer hook. displayName.ts and gpsConsent.ts per the behavior block, importing `{ supabase }`. Keep all logic here so the
    src/app screens in Tasks 6–7 stay thin.
  </action>
  <acceptance_criteria>
    - `cd app && npm test -- features/auth/validation.test.ts features/auth/redirect.test.ts features/auth/SessionProvider.test.tsx features/auth/useSession.test.ts features/auth/displayName.test.ts features/auth/gpsConsent.test.ts` exits 0.
    - `cd app && npm run test:coverage` shows 100% lines/branches/functions/statements for all six new `src/features/auth/*` files.
    - `grep -n 'export function nextRoute' app/src/features/auth/redirect.ts` and `grep -n 'export function SessionProvider\|export const SessionProvider\|export function useSession' app/src/features/auth/SessionProvider.tsx app/src/features/auth/useSession.ts` return matches.
    - A test asserts requestGpsConsent performs NO rpc call when status is 'denied' (T-02-04 proof).
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 6: Root layout + navigation shell + Welcome screen</name>
  <files>app/src/app/_layout.tsx, app/src/app/index.tsx, app/src/app/(tabs)/_layout.tsx, app/src/app/(tabs)/nearby.tsx, app/src/app/(tabs)/submit.tsx, app/src/app/(auth)/_layout.tsx, and colocated thin render tests</files>
  <read_first>
    - .planning/phases/02-auth-profiles/02-UI-SPEC.md (Screen 1 Welcome; Navigation Model subset; Button Hierarchy; §20 checklist below)
    - .planning/phases/02-auth-profiles/02-PATTERNS.md (_layout target shape; thin-screen shape; Bash-vs-Write rule for pure stubs)
    - app/src/app/_layout.tsx (current stub being replaced)
    - app/src/app/(tabs)/_layout.tsx, app/src/app/(tabs)/index.tsx (existing tab stubs)
    - app/src/features/auth/SessionProvider.tsx, app/src/features/auth/redirect.ts (wired here)
    - app/src/constants/* and app/constants/Colors.ts (tokens — no raw hex / no magic numbers)
  </read_first>
  <action>
    Replace app/src/app/_layout.tsx: wrap with `GestureHandlerRootView style={{ flex: 1 }}` → `SessionProvider` → a guard effect
    that, when `!loading`, computes `nextRoute(useSegments(), !!session)` and `router.replace`s when non-null (gated on loading so
    no navigate-before-mount); render `<Stack/>`; while `loading` render the blank splash (CONTEXT §1 cold-start). Also route the
    PASSWORD_RECOVERY signal to `/reset-password`. Create app/src/app/index.tsx (Welcome): logo + "Gotta Go" Display + tagline, then
    Primary "Sign In" (56pt) → /(auth)/sign-in and Secondary "Create Account" (48pt) → /(auth)/sign-up, then the locked TOS subhead
    "By continuing, you agree to our [Terms of Service] and [Privacy Policy]." with tappable textLink links opening LEGAL_URLS via
    expo-linking openURL (REQ-2-6) — use the CONTEXT §4 two-button layout, NOT the wireframe single-button version. Modify
    app/src/app/(tabs)/_layout.tsx to register the 4-tab bar (Map / Nearby / Submit / Profile) with token-driven tabBar colors.
    Create app/src/app/(tabs)/nearby.tsx and submit.tsx as minimal stubs (Nearby empty-state "No bathrooms loaded yet."); these two
    are pure visual stubs and per Phase 1 convention may be created via Bash to avoid TDD-Guard Write blocks — Welcome and _layout
    contain behavior and are TDD-tested. Confirm (auth)/_layout.tsx is headerless/stack-appropriate. All screens cite §20 below.
  </action>
  <acceptance_criteria>
    - `cd app && npm test -- app/_layout app/index` exits 0 (render + guard-wiring tests pass).
    - `grep -n 'GestureHandlerRootView' app/src/app/_layout.tsx`, `grep -n 'SessionProvider' app/src/app/_layout.tsx`, and `grep -n 'nextRoute' app/src/app/_layout.tsx` all match.
    - `grep -vn '^\s*//' app/src/app/index.tsx | grep -c '#[0-9A-Fa-f]\{6\}'` returns 0 (no raw hex in the Welcome StyleSheet).
    - `grep -n 'Sign In' app/src/app/index.tsx` and `grep -n 'Create Account' app/src/app/index.tsx` both match; LEGAL_URLS is imported.
    - `cd app && npx expo-router routes` (or app boots in the dev client) resolves /(tabs)/nearby and /(tabs)/submit without a missing-route error.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 7: Auth forms + GPS consent + password reset screens</name>
  <files>app/src/app/(auth)/sign-in.tsx, app/src/app/(auth)/sign-up.tsx, app/src/app/(auth)/forgot-password.tsx, app/src/app/reset-password.tsx, app/src/app/gps-consent.tsx, and colocated tests</files>
  <read_first>
    - .planning/phases/02-auth-profiles/02-UI-SPEC.md (Screen 2 Sign-In, Screen 3 Sign-Up, Screen 4 GPS Consent; Password Reset Flow Copy; Input Field Spec; Keyboard Behavior; Accessibility; §20 below)
    - .planning/phases/02-auth-profiles/02-CONTEXT.md (§3 GPS consent, §4 sign-in UX, §5 display_name)
    - app/src/app/(auth)/sign-in.tsx, sign-up.tsx (current stubs being replaced)
    - app/src/features/auth/validation.ts, displayName.ts, gpsConsent.ts, SessionProvider.tsx (consumed here)
    - app/src/lib/supabase.ts (auth calls)
  </read_first>
  <action>
    sign-in.tsx: react-hook-form + zodResolver(signInSchema), Email + Password (eye toggle), "Forgot password?" link →
    /(auth)/forgot-password, Primary "Sign In" (56pt) calling supabase.auth.signInWithPassword; on error render the GENERIC inline
    copy "Invalid email or password." (T-02-01 — no enumeration) with the alert-circle icon + accessibilityLiveRegion="assertive";
    network failure → "Couldn't sign in. Check your connection and try again."; "Create account" link → /(auth)/sign-up. Leave a
    clearly-marked placeholder region below the divider where 02-02 inserts the OAuth/Apple buttons (do not add them here).
    sign-up.tsx: zodResolver(signUpSchema) with Display Name + Email + Password; on submit call checkDisplayNameAvailable first
    (surface "That display name is already taken." on false or on a 23505 unique-violation backstop — T-02-05 format is validated
    server-side by the index/RPC), then supabase.auth.signUp({ email, password, options: { data: { display_name } } }) (confirmations
    disabled → session returns immediately); success routes to /gps-consent on first launch. Render the locked TOS subhead with
    [Terms of Service]/[Privacy Policy] textLinks below the Create Account button (REQ-2-6). forgot-password.tsx: email input →
    supabase.auth.resetPasswordForEmail(email, { redirectTo: makeRedirectUri({ path: 'auth/callback' }) }) using the gotta-go scheme;
    show the "Check your email" confirmation state. reset-password.tsx: reached via the PASSWORD_RECOVERY route from _layout; New
    Password input → supabase.auth.updateUser({ password }); "Set New Password" / "Update Password" copy. gps-consent.tsx: location
    icon + "Enable Location" copy block; Primary "Enable Location" calls requestGpsConsent() (Task 5) — which triggers the OS dialog
    and writes consent ONLY on granted (T-02-04 / §20 GPS-Consent) — then navigates to /(tabs)/index; "Skip for now" navigates to
    /(tabs)/index writing nothing. All copy verbatim from the UI-SPEC Copywriting Contract; on-submit validation only (no blur).
  </action>
  <acceptance_criteria>
    - `cd app && npm test -- app/(auth) app/gps-consent app/reset-password` exits 0 (render, on-submit validation, error-state, and consent-write-condition tests pass).
    - `grep -n 'Invalid email or password.' app/src/app/(auth)/sign-in.tsx` matches and NO branch renders a more specific auth-failure reason (T-02-01).
    - A sign-in test asserts that every `supabase.auth.signInWithPassword` error branch renders exactly "Invalid email or password." and that the network-failure branch renders the separate copy "Couldn't sign in. Check your connection and try again." — no branch leaks a more specific reason (test must cover at least: wrong password, unregistered email, and generic server error paths).
    - `grep -n 'check_display_name_available\|checkDisplayNameAvailable' app/src/app/(auth)/sign-up.tsx` and `grep -n 'options:.*data\|display_name' app/src/app/(auth)/sign-up.tsx` match.
    - `grep -n 'requestGpsConsent' app/src/app/gps-consent.tsx` matches; a gps-consent test asserts navigation proceeds on BOTH granted and denied with NO consent write on denied/skip.
    - `grep -n 'resetPasswordForEmail' app/src/app/(auth)/forgot-password.tsx` and `grep -n 'updateUser' app/src/app/reset-password.tsx` match.
    - `grep -rn '#[0-9A-Fa-f]\{6\}' app/src/app/(auth)/sign-in.tsx app/src/app/(auth)/sign-up.tsx app/src/app/(auth)/forgot-password.tsx app/src/app/reset-password.tsx app/src/app/gps-consent.tsx | grep -v '^\s*//'` returns nothing (token-only styling).
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Supabase Auth (GoTrue) | Untrusted email/password/display-name submitted from the device |
| client → Postgres RPC | Consent + display-name-availability writes/reads cross into elevated SECURITY DEFINER functions |
| OS location permission → app | The OS owns the grant; the app must not record consent it did not receive |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Information Disclosure | sign-in.tsx auth error path | mitigate | Single generic copy "Invalid email or password." for all credential failures; no field-level "user not found" (Task 7, asserted in test). |
| T-02-04 | Tampering/Repudiation | gps-consent.tsx + set_gps_consent RPC | mitigate | gps_consent/gps_consent_at written ONLY after OS dialog resolves to granted, server-side via SECURITY DEFINER set_gps_consent using auth.uid(); no client UPDATE on users (Tasks 5, 7). |
| T-02-05 | Tampering/Spoofing | display_name (sign-up) | mitigate | Format validated by Zod regex AND case-insensitive unique index lower(display_name) + check_display_name_available RPC; 23505 mapped to friendly error (Tasks 5, 7). |
</threat_model>

## Component Acceptance Checklist (from docs/design/design-system.md §20)

### Visual Tokens
- [ ] All color values reference `Colors[colorScheme].tokenName` — no raw hex strings in component StyleSheet
- [ ] All text sizes reference the typography scale (`typography.ts` constants) — no inline `fontSize` raw numbers
- [ ] All spacing values reference the spacing scale (`spacing.ts` constants) — no magic numbers
- [ ] Dark mode tested: toggle OS dark mode setting, verify no color inversion artifacts or invisible elements
- [ ] Policy tag badge colors match Section 8 token table — `code_required` uses `textPrimary` text (not white)
- [ ] Confidence badge colors match Section 9 — `confidenceMedium` uses `textPrimary` text (not white)

### Accessibility
- [ ] All tappable elements have `accessibilityLabel` (non-empty string)
- [ ] All tappable elements have `accessibilityRole` (see Section 18.3 role table)
- [ ] `accessibilityHint` added on any element whose action outcome is not obvious from the label
- [ ] `accessibilityState` reflects current state: `{ disabled, selected, checked, expanded }` as applicable
- [ ] Rating inputs have `accessibilityValue={{ min: 1, max: 5, now: N, text: 'N out of 5 — Label' }}`
- [ ] No status uses color as its only indicator — every status has icon + text alongside color (Section 18.4)
- [ ] All touch targets ≥44pt; emergency-mode elements ≥56pt; FAB 64×64pt (Section 18.2)
- [ ] No `numberOfLines` on critical labels (location name, CTA text, error copy, distance)
- [ ] Tested at iOS maximum Larger Text size (+5 steps) — no content clipping, no layout breakage

### Error States
- [ ] All error conditions applicable to this screen are handled (reference Section 15 Error-State Copy Matrix)
- [ ] No screen state is a dead end — every error has a recovery action with a tappable affordance
- [ ] Auth-required state (ERR-10) triggers inline slide-up modal, not a full navigation redirect
- [ ] Failed verification copy (ERR-09) is generic — does not reveal detection method or rejection reason

### Emergency Mode
- [ ] Emergency-mode elements use `colors.emergency` / `colors.emergencyOrange` tokens — not `colors.primary`
- [ ] Any screen reachable during emergency mode has ≥56pt primary action height
- [ ] Emergency mode dismiss is explicit (Dismiss button or FAB re-tap) — no auto-dismiss
- [ ] Emergency mode is reachable from this tab in ≤2 taps (verify against Section 16 reachability matrix)

### Loading States
- [ ] Skeleton placeholders (not spinners) used for content area loading (Section 19 skeleton spec)
- [ ] Skeleton uses `colors.skeletonBase` / `colors.skeletonHighlight` tokens
- [ ] Reduced-motion: skeleton renders without animation when `AccessibilityInfo.isReduceMotionEnabled()` is true

### Map Pins (Map-screen components only)
- [ ] Pin colors driven by Mapbox `match` expression on `policy_tag` — not React state or client-side conditional
- [ ] Pending pin visible only when `submissions JOIN` returns submitter match — not a client-side filter
- [ ] Overlay icons (wheelchair, changing table) use separate SymbolLayer with `iconOffset: [8, -8]` starting point

### Bottom Sheet (components using bottom sheet)
- [ ] Snap points configured as exactly 30% / 55% / 90% — no intermediate or computed snap states
- [ ] Drag handle has `accessibilityRole='adjustable'` and `accessibilityValue={{ text: 'Peek'|'Half'|'Full' }}`
- [ ] Emergency mode sheet opens directly to 55% — no Peek state in emergency context

### GPS Consent (sign-up / first-launch components only)
- [ ] `gps_consent = true` and `gps_consent_at = now()` written ONLY after OS dialog resolves to `granted`
- [ ] Pre-prompt button triggers OS dialog only — does not itself write consent

### Security & Server Enforcement
- [ ] Access code field is ABSENT (not masked) for unauthenticated users — no client-side masking as the sole gate (T-1.5-05)
- [ ] `access_sensitivity` and `family_mode` filtering enforced at the RPC layer — client code must not apply these as a client-side filter (T-1.5-04)
- [ ] Public search results exclude deleted, shadowbanned, and suppressed locations at the server RPC — client-side filtering of these properties is forbidden
- [ ] No PII (email, display name) and no precise GPS coordinates written to `console.log`, analytics events, or crash/error reports
- [ ] No client-side trust score, shadowban status, or suppression logic — client receives pre-filtered results only; enforcement is server-side

<verification>
- `cd app && npm run test:coverage` — 100% over src/features/** (src/app/** excluded by config); all suites green.
- Manual dev-client smoke: cold start → Welcome → Create Account (email/pw/display_name) → session returned → GPS Consent → grant writes consent → Map; restart app → still signed in (session persists); sign out → Welcome.
- Bad credentials show exactly "Invalid email or password."; taken display name shows "That display name is already taken."
- §20 Component Acceptance Checklist reviewed for every screen (Welcome, Sign-In, Sign-Up, GPS Consent, root _layout, (tabs)/_layout) before /review-gate.
</verification>

<success_criteria>
- ROADMAP SC-1 (account creation → profile path), SC-3 (users row auto-created), SC-4 (protected redirect), SC-5 (session persists), SC-9 (gps_consent written before any GPS read), and the email/password + password-reset paths are demonstrable in the dev client.
- REQ-2-1, REQ-2-4, REQ-2-7 fully covered; REQ-2-6 partially covered (Welcome + Sign-Up legal links).
- All new src/features/** modules at 100% coverage; no raw hex / magic numbers in screen StyleSheets.
</success_criteria>

<output>
Create `.planning/phases/02-auth-profiles/02-01-SUMMARY.md` when done (note Termly URL status
and the manual smoke-test results for the critical paths above).
</output>
