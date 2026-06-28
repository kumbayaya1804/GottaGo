# Phase 2: Auth & Profiles - Research

**Researched:** 2026-06-27
**Domain:** Supabase Auth + Expo Router v4/SDK 55 (React Native) — session management, OAuth deep links, protected routes, profile provisioning, GDPR consent + account deletion
**Confidence:** HIGH for codebase/schema findings (read directly); MEDIUM-HIGH for Expo/Supabase patterns (CITED official docs); one HIGH-PRIORITY open question requires live-DB verification (auth trigger existence)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
1. **SessionProvider** = React Context wrapping root `_layout.tsx`; subscribes to `supabase.auth.onAuthStateChange`.
2. **Protected route mechanism** = `useSegments + router.replace` inside root `_layout.tsx` effect that runs on every session state change. (NOT `Stack.Protected`.)
3. **`users` row fetch** = NOT in SessionProvider — fetched lazily via TanStack Query when a component needs profile data.
4. **Sign-out triggers** = (1) Settings button; (2) `onAuthStateChange` `SIGNED_OUT` event (external revocation).
5. **Cold-start UI** = blank splash (`loading=true`) until first `onAuthStateChange` event fires — no premature redirect.
6. **Email confirmation** = DISABLED in v1 (`signUp()` returns a session immediately).
7. **Unauthenticated landing** = Map tab; sign-in prompt appears only on protected action.
8. **Google OAuth** = `supabase.auth.signInWithOAuth({ provider: 'google' })` + `expo-web-browser`; deep-link callback `gotta-go://auth/callback`; **Android-only**.
9. **iOS** = no Google button; disabled Apple Sign-In stub + "coming soon" copy.
10. **GPS consent** = dedicated screen after sign-in/sign-up, before Map tab, first launch only; explanation first, then OS dialog; writes `users.gps_consent` + `users.gps_consent_at` ONLY on `granted`.
11. **Welcome screen** = logo + tagline + two buttons "Sign In" / "Create Account" (UI-SPEC authoritative over wireframe).
12. **Sign-up fields** = email + password + display name on one form.
13. **Display name** = unique, 3–20 chars, letters/numbers/spaces/hyphens/underscores; DB-level unique index + API-layer friendly error.
14. **Account deletion** = immediate, no grace period; submissions & ratings anonymized (`user_id = null`); type-`DELETE`-to-confirm; `delete_account` RPC (client never touches `users` directly).
15. **Password reset** = magic link → `gotta-go://auth/callback` → in-app Reset Password screen.
16. **Form validation** = on submit only (no inline/blur validation).
17. **TOS/Privacy copy** = below Create Account button, tappable links, no checkbox.
18. **Supabase client** (`app/src/lib/supabase.ts`) = already configured; NO changes needed.

### Claude's Discretion
- Internal file/module organization for auth logic (where SessionProvider lives, how validation is factored).
- Choice of supporting libraries for URL parsing / redirect URI generation (within "no unnecessary deps" constraint).
- Test structure and mocking approach for Supabase auth.
- Exact SQL form of the unique index and the `delete_account` RPC body (subject to the open questions below).

### Deferred Ideas (OUT OF SCOPE)
- Apple Sign-In real implementation (Phase 9 — needs Apple Developer enrollment).
- Google OAuth on iOS.
- Display-name editing UI (Settings "Account" row is a stub in Phase 2).
- Social providers beyond Google; 2FA/MFA.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID / Requirement | Description | Research Support |
|------------------|-------------|------------------|
| Email/password auth | `signUp` / `signInWithPassword`; session persisted | Client already configured (AsyncStorage + persistSession). `signUp` returns session because `enable_confirmations=false` (config.toml:221). See §Standard Stack, §Code Examples. |
| SessionProvider | React Context wrapping root, subscribes to `onAuthStateChange` | Pattern + cold-start gate documented in §Architecture Pattern 1. |
| onAuthStateChange | Drives redirects + sign-out handling | §Pattern 1, §Pattern 2. Events list incl. `PASSWORD_RECOVERY`, `SIGNED_OUT`. |
| Protected routes | `useSegments + router.replace` in root layout | §Pattern 2; gotchas (initial-render race, navigation-before-mount) documented. |
| Google OAuth (Android) | `signInWithOAuth` + `expo-web-browser` + deep link | §Pattern 3. **BLOCKER: scheme mismatch + Google provider not configured** — see §Common Pitfalls 1 & 2. |
| Apple Sign-In stub (iOS) | Disabled button + copy; no Google on iOS | `Platform.OS` gate; pure UI, no auth call. §Pattern 3 note. |
| GPS consent | Dedicated screen; OS dialog; write on granted only | `expo-location` installed. Write must go through SECURITY DEFINER RPC (no client UPDATE policy on `users`). §Don't Hand-Roll, §Pitfall 4. |
| account deletion RPC | Anonymize + delete auth user | §Pattern 4 + §Pitfall 3. **FK NOT NULL constraints block the locked design — schema migration required.** |
| display_name uniqueness | DB unique index + friendly error | No unique index exists today. Migration + pre-check RPC needed. §Pattern 5, §Pitfall 5. |
| password reset deep link | `resetPasswordForEmail` → deep link → in-app reset | §Pattern 6. Uses same callback route + `PASSWORD_RECOVERY` event + `updateUser`. |
| Settings stub | sign out, privacy, ToS, delete entry, location perms | UI-SPEC Screen 9; `Linking.openSettings()` for OS deep link. |
| TOS/Privacy links | Termly URLs in onboarding + Settings | `expo-linking` `openURL` (installed). Termly URLs are an open input (see §Open Questions). |
</phase_requirements>

---

## Summary

Phase 2 wires Supabase email/password + Google-OAuth (Android) onto an Expo SDK 55 / Expo Router app whose Supabase client, route stubs, and generated DB types already exist. The **client code is the easy part** — the riskier work is at three seams that the codebase audit shows are *not* ready for the locked decisions:

1. **Deep-link scheme is wrong.** `app.config.ts` declares `scheme: 'gotta-go'`, so the real callback URL is `gotta-go://auth/callback`, **not** the `gottago://auth/callback` written into CONTEXT/UI-SPEC. OAuth and password-reset both break silently if this isn't reconciled, and the redirect must also be allow-listed in the Supabase project.

2. **The account-deletion design is blocked by the live schema.** Every child table references `users(id)` as **`NOT NULL` with no `ON DELETE` rule (RESTRICT)**. `submissions` uses `submitter_id` (not `user_id`) and is `NOT NULL`; `ratings.user_id` is `NOT NULL`. The locked "anonymize to null" decision is therefore impossible without a migration, and `verification_events`, `trust_events`, `reports`, `failure_events` will hard-block the cascade delete entirely unless they're also handled. This needs a schema decision before the RPC can be written.

3. **Profile auto-creation has no trigger in the repo.** No `handle_new_user` / `AFTER INSERT ON auth.users` trigger exists in any migration, and the `users` table has **no INSERT RLS policy**, so the client cannot create its own profile row. Provisioning must be a SECURITY DEFINER trigger (or RPC). Whether one already exists on the live project (added via dashboard, outside migrations) is the single most important thing to verify before planning 02-02.

Supporting gaps: `react-native-gesture-handler` is not installed (CONTEXT adds it in Phase 2); `expo-auth-session` (the package the official Supabase deep-link guide uses for `makeRedirectUri`/`QueryParams`) is not installed; there is no `babel.config.js`; `jest.config.js` currently **excludes `src/app/**` from coverage**, which conflicts with the TDD-100% mandate now that real screens land here; and `users` has no unique index on `display_name`. Config also disables email confirmation (matches the decision) but sets `minimum_password_length = 6` while the UI validates 8.

**Primary recommendation:** Front-load three "Wave 0" de-risking tasks before any screen work — (a) reconcile the deep-link scheme and Supabase redirect allow-list, (b) verify the live auth trigger via Supabase and write the `display_name` unique-index + profile-provisioning migration, and (c) resolve the deletion FK problem with a migration + `delete_account` RPC spec. Extract all auth *logic* (validation, redirect decision, session reducer, display-name rules) into covered modules outside `src/app/` so TDD-100% is satisfiable while screens stay thin.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Credential auth (sign-up/in) | Supabase Auth (GoTrue) | RN client (form + call) | Auth server owns identity; client only collects + submits. |
| Session persistence / refresh | Supabase client + AsyncStorage | — | Already configured (`persistSession`, `autoRefreshToken`). No client logic needed. |
| Session → app state | RN client (SessionProvider Context) | — | UI concern; subscribes to `onAuthStateChange`. |
| Route protection / redirect | RN client (root `_layout` effect) | — | Client-side guard per locked decision; **not** a security boundary (RLS is). |
| Profile row creation | Database (SECURITY DEFINER trigger/RPC) | — | `users` has no client INSERT policy; must run with elevated rights. |
| Display-name uniqueness | Database (unique index) | API/RPC (pre-check + friendly error) | DB index is the hard guarantee; RPC gives UX. |
| GPS consent persistence | Database (SECURITY DEFINER RPC) | RN client (OS dialog) | No client UPDATE policy on `users`; OS owns the permission, DB owns the record. |
| Account deletion + anonymization | Database (SECURITY DEFINER RPC) | RN client (confirm UX) | Touches `auth.users` + multiple tables; must be server-side/elevated. |
| OAuth provider exchange | Supabase Auth + provider | RN client (browser + URL parse) | Provider + GoTrue own the token exchange; client shuttles the redirect. |
| TOS/Privacy/Settings deep links | OS / system browser | RN client (`expo-linking`) | External URLs + OS settings, not app-owned. |

**Security note:** the `useSegments` redirect is UX only. Real protection of data is RLS + SECURITY DEFINER RPCs (schema-contract.md). Tests must assert server-side enforcement, not just that the client hid a button.

---

## Standard Stack

### Already installed (use these — no alternatives)
| Library | Version (pinned) | Purpose | Notes |
|---------|------------------|---------|-------|
| `@supabase/supabase-js` | ^2.106.0 | Auth + DB | Client preconfigured in `src/lib/supabase.ts`. `detectSessionInUrl: false` (required for RN). |
| `@react-native-async-storage/async-storage` | 2.2.0 | Session storage | Wired into the client already. |
| `expo-router` | ~55.0.16 | Routing | `typedRoutes: true` is enabled in `app.config.ts`. |
| `expo-web-browser` | ~55.0.16 | OAuth consent window | `openAuthSessionAsync` + `maybeCompleteAuthSession()`. |
| `expo-linking` | ~55.0.15 | Deep-link build/parse, open URLs | `createURL('auth/callback')`, `Linking.parse(url)`, `openURL`, `openSettings`. |
| `expo-location` | ~55.1.10 | GPS permission | `requestForegroundPermissionsAsync()` for consent screen. |
| `react-hook-form` | ^7.76.0 | Forms | Pair with Zod resolver. |
| `@hookform/resolvers` | ^5.2.2 | RHF↔Zod bridge | |
| `zod` | ^4.4.3 | Validation schemas | Display-name regex, email, password rules. |
| `@tanstack/react-query` | ^5.100.11 | Lazy profile + stats fetch | Per decision #3, profile row fetched here, not in SessionProvider. |
| `@testing-library/react-native` | ^13.3.3 | Screen/logic tests | `getByRole`, `getByLabelText`. |
| `msw` | ^2.14.6 | API mocking in tests | For Supabase REST/auth endpoint mocking. |

### Must be ADDED in Phase 2 (verify with `npx expo install`, do not hand-pin)
| Library | SDK-55 version | Purpose | Install command |
|---------|----------------|---------|-----------------|
| `react-native-gesture-handler` | Expo-resolved (npm `latest` 3.0.2; `legacy` 2.32.0) `[VERIFIED: npm registry]` for existence; exact SDK-55 pin `[ASSUMED]` | Required by Expo Router navigators; CONTEXT adds it in Phase 2 | `npx expo install react-native-gesture-handler` |
| `expo-auth-session` | `sdk-55` dist-tag = **55.0.17** `[VERIFIED: npm dist-tags]` | `makeRedirectUri()` + `QueryParams.getQueryParams()` per the official Supabase RN deep-link guide | `npx expo install expo-auth-session` |

**Do NOT install `expo-auth-session` blindly** — it is only needed if you adopt the Supabase-documented helpers. A no-new-dep alternative exists (build the redirect with `Linking.createURL`, parse with `Linking.parse`). See §Alternatives Considered. Recommendation: **install `expo-auth-session`** (it is an official Expo package and the documented happy path), but treat it as a checkpoint item since slopcheck was unavailable.

**Critical version rule (from CLAUDE.md):** `jest@29.7.0` is PINNED. Do not let any added dep pull a jest upgrade. Use `npx expo install` so Expo resolves SDK-55-compatible versions rather than npm `latest`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-auth-session` helpers | `expo-linking` `createURL` + `Linking.parse` | Zero new deps, but you reimplement redirect-URI + token parsing the official guide gives free; easier to get the OAuth fragment/PKCE handling subtly wrong. |
| `useSegments + router.replace` | `Stack.Protected` guard (SDK 53+) | Declarative + less boilerplate, BUT **CONTEXT locks `useSegments`**, and `Stack.Protected` has a documented iOS "protected screen flashes before redirect" issue. Do not switch. |
| Profile trigger | Client insert after signUp | Impossible: `users` has no INSERT RLS policy. Trigger/RPC is the only path. |

**Installation (let Expo resolve versions):**
```bash
cd app
npx expo install react-native-gesture-handler expo-auth-session
```

---

## Package Legitimacy Audit

> slopcheck was **not available** in this environment. Per protocol, the two added packages are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task. Both are nonetheless well-known official packages with clean npm metadata and **no `postinstall` scripts** (verified — `npm view … scripts.postinstall` returned empty).

| Package | Registry | Maintainer | Source Repo | postinstall | slopcheck | Disposition |
|---------|----------|------------|-------------|-------------|-----------|-------------|
| `react-native-gesture-handler` | npm (latest 3.0.2) | Software Mansion | github.com/software-mansion/react-native-gesture-handler | none | unavailable | Approved — gate behind `checkpoint:human-verify`; install via `npx expo install` |
| `expo-auth-session` | npm (sdk-55 = 55.0.17) | Expo (official) | github.com/expo/expo | none | unavailable | Approved — gate behind `checkpoint:human-verify`; install via `npx expo install` |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged [SUS]:** none. (Both are first-party/widely-adopted; risk is low, but tag `[ASSUMED]` stands because verification tooling was unavailable.)

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────────────────────────────┐
   App cold start ───────▶│ Root _layout.tsx                             │
                          │  ├─ <GestureHandlerRootView>  (NEW in P2)    │
                          │  ├─ <SessionProvider>                        │
                          │  │    subscribes supabase.auth                │
                          │  │      .onAuthStateChange                    │
                          │  │    holds {session, loading}                │
                          │  └─ guard effect: useSegments()+router.replace│
                          └───────────────┬──────────────────────────────┘
                                          │ session/loading
            loading=true (blank splash)   │   session change
                                          ▼
        ┌──────────────┬─────────────────┴───────────────┬──────────────────┐
        │ no session   │ session && in (auth)             │ session && consent? │
        ▼              ▼                                  ▼                  ▼
   (auth)/sign-in   replace → (tabs)              first launch?        (tabs)/index
   (auth)/sign-up      ▲                          ──▶ GPS Consent ─────▶  (Map)
        │              │                              screen
        │ submit       │ onAuthStateChange(SIGNED_IN)
        ▼              │
  signInWithPassword ──┘
  signUp ──────────────────────▶ GoTrue (Supabase Auth)
  signInWithOAuth(google) ──┐         │ AFTER INSERT auth.users
       (Android only)       │         ▼
       expo-web-browser     │   handle_new_user TRIGGER (SECURITY DEFINER)  ← MUST EXIST
       openAuthSessionAsync │         └─▶ INSERT public.users (id,email,display_name)
       │                    │
       ▼                    │   ┌─ delete_account() RPC (SECURITY DEFINER)
  gotta-go://auth/callback ─┘   │     anonymize submissions/ratings → delete auth.users (cascade)
  route → parse code/tokens     │   ┌─ set_gps_consent() RPC (SECURITY DEFINER)
  → setSession/exchange         │   ┌─ check_display_name_available() RPC
                                ▼
                          Postgres (RLS + SECURITY DEFINER); lazy profile via TanStack Query
```

### Recommended Project Structure
Keep `src/app/` files **thin** (currently excluded from coverage) and push logic into covered modules:
```
app/src/
├── app/                          # Expo Router routes — THIN wrappers (render + wire hooks)
│   ├── _layout.tsx               # GestureHandlerRootView + SessionProvider + guard effect
│   ├── index.tsx                 # Welcome screen (root, no tab bar)  ← NEW
│   ├── gps-consent.tsx           # GPS consent screen (root overlay)  ← NEW
│   ├── reset-password.tsx        # in-app set-new-password screen     ← NEW
│   ├── auth/callback.tsx         # deep-link target (OAuth + recovery) ← NEW (or handle in _layout)
│   ├── (auth)/{sign-in,sign-up,forgot-password}.tsx
│   └── (tabs)/{_layout,index,nearby,submit,profile}.tsx   # nearby+submit NEW
├── features/auth/                # COVERED logic (TDD-100%)
│   ├── SessionProvider.tsx       # context + reducer
│   ├── useSession.ts / useProtectedRedirect.ts
│   ├── validation.ts             # zod schemas: displayName, email, password
│   ├── redirect.ts               # pure: (segments, session) → target | null
│   └── oauth.ts                  # build redirect, open browser, parse, set session
├── features/profile/             # delete-account caller, stats query
└── constants/                    # Colors.ts, typography.ts, spacing.ts, radius.ts (UI-SPEC)
```

### Pattern 1: SessionProvider (Context + cold-start gate)
**What:** A Context provider mounted at the root that holds `{ session, loading }`, set the initial value from `getSession()`, and updates on every `onAuthStateChange`. `loading` stays true until the first event resolves → blank splash (decision #5).
**When:** Always mounted; every screen reads it via `useSession()`.
```typescript
// Source: CITED supabase.com/docs/guides/auth/quickstarts/react-native + decision #1,#5
// features/auth/SessionProvider.tsx (logic lives here so it's covered)
const [session, setSession] = useState<Session | null>(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
  supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
  const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
    setSession(s); setLoading(false);
  });
  return () => sub.subscription.unsubscribe();
}, []);
```
**Events you must handle:** `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT` (decision #4 — external revocation), `TOKEN_REFRESHED`, `PASSWORD_RECOVERY` (Pattern 6), `USER_UPDATED`. `[CITED: supabase-js AuthChangeEvent]`

### Pattern 2: Protected-route guard (useSegments + router.replace)
**What:** A root-layout effect that, on every `(segments, session, loading)` change, redirects. Extract the *decision* into a pure function so it's unit-testable.
```typescript
// Source: CITED docs.expo.dev/router/advanced/authentication + decision #2
// features/auth/redirect.ts  (pure, covered)
export function nextRoute(segments: string[], hasSession: boolean): string | null {
  const inAuthGroup = segments[0] === '(auth)';
  if (!hasSession && isProtected(segments)) return '/(auth)/sign-in';
  if (hasSession && inAuthGroup)            return '/(tabs)';
  return null;
}
// _layout.tsx effect
useEffect(() => {
  if (loading) return;                       // wait for first auth event (decision #5)
  const target = nextRoute(segments, !!session);
  if (target) router.replace(target);
}, [segments, session, loading]);
```
**Gotchas (CITED):** (a) Calling `router.replace` before the Root layout has mounted throws "navigate before mounting" — gate on `loading` and let the first render complete. (b) Use `replace`, never `push`, so unauthorized routes don't stack. (c) On iOS a protected screen can flash before redirect — keep the splash/`loading` gate to mask it. (d) `(tabs)/index` (Map) and `(tabs)/profile` are intentionally **public** (no redirect); only specific actions are gated via the Auth-Required modal (ERR-10), not navigation.

### Pattern 3: Google OAuth via expo-web-browser (Android only)
**What:** Open the provider consent page in an auth session browser, catch the redirect, set the session.
```typescript
// Source: CITED supabase.com/docs/guides/auth/native-mobile-deep-linking
// top-level once:
WebBrowser.maybeCompleteAuthSession();
const redirectTo = makeRedirectUri();              // expo-auth-session → gotta-go://...
const { data } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo, skipBrowserRedirect: true },
});
const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
if (res.type === 'success') {
  const { params } = QueryParams.getQueryParams(res.url);   // access_token, refresh_token OR code
  // PKCE (supabase-js default): await supabase.auth.exchangeCodeForSession(params.code)
  // implicit:                   await supabase.auth.setSession({ access_token, refresh_token })
}
```
**Platform gate (decision #8/#9):** render the Google button only when `Platform.OS === 'android'`; on iOS render the disabled Apple stub (no auth call). Apple App Review guideline 4.8 forbids offering Google on iOS without Apple Sign-In — hence the gate, not just a hidden button.
**Flow type:** supabase-js v2 defaults to **PKCE**; the callback carries `?code=` and you call `exchangeCodeForSession`. Confirm the flow type and branch accordingly — do not assume implicit tokens. `[ASSUMED — verify supabase-js v2.106 flowType default]`

### Pattern 4: `delete_account` SECURITY DEFINER RPC
**What:** One server-side function that anonymizes community data then deletes the auth user (cascade removes `public.users`). **Cannot be written as specified until the schema FK problem is fixed** (see Pitfall 3).
```sql
-- Source: pattern from supabase auth admin docs; ADAPTED to live FK reality
create or replace function delete_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  update submissions set submitter_id = null where submitter_id = uid;  -- needs nullable col
  update ratings     set user_id      = null where user_id = uid;       -- needs nullable col
  -- DECISION REQUIRED: verification_events / trust_events / reports / failure_events
  --   are NOT NULL refs → must be reassigned/deleted or cascade delete fails.
  delete from auth.users where id = uid;   -- cascades to public.users (on delete cascade)
end; $$;
```
Client calls `supabase.rpc('delete_account')`; on success `onAuthStateChange` fires `SIGNED_OUT` → guard redirects to Welcome (decision #4).

### Pattern 5: display_name uniqueness
**What:** DB unique index (hard guarantee) + pre-check RPC (UX). The DB has neither today.
```sql
-- recommend case-insensitive to prevent impersonation ("John" vs "john")
create unique index users_display_name_lower_uniq on public.users (lower(display_name));

create or replace function check_display_name_available(name text)
returns boolean language sql security definer set search_path = public as $$
  select not exists (select 1 from users where lower(display_name) = lower(name));
$$;
```
Call `check_display_name_available` before `signUp`; rely on the index as the race-safe backstop (map unique-violation → "That display name is already taken."). `[ASSUMED: case-insensitive — confirm with user]`

### Pattern 6: Password reset deep link
```typescript
// 1. forgot-password screen:
await supabase.auth.resetPasswordForEmail(email, { redirectTo: makeRedirectUri({ path: 'auth/callback' }) });
// 2. user taps emailed link → app opens at callback → exchangeCodeForSession(code)
//    onAuthStateChange fires PASSWORD_RECOVERY → route to /reset-password
// 3. reset-password screen:
await supabase.auth.updateUser({ password: newPassword });
```
`[CITED: supabase password reset + AuthChangeEvent PASSWORD_RECOVERY]`

### Anti-Patterns to Avoid
- **Fetching the `users` row inside SessionProvider.** Decision #3 forbids it — keep the provider session-only; fetch profile lazily via TanStack Query.
- **Treating the `useSegments` redirect as security.** It's UX. RLS + RPCs are the boundary.
- **Client-side INSERT into `users`.** No RLS policy permits it; will silently return 0 rows / error.
- **Writing `gps_consent = true` before the OS dialog resolves to `granted`.** Violates GDPR + design-system §16 + §20 checklist.
- **Hardcoding the redirect URL string.** Build it from the scheme via `makeRedirectUri`/`createURL` so it tracks `app.config.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session persistence/refresh | Custom token store | supabase-js + AsyncStorage (already wired) | Refresh races, expiry, secure storage are solved. |
| OAuth redirect URI | String concatenation | `makeRedirectUri()` / `Linking.createURL()` | Scheme/host edge cases per platform. |
| Callback token parsing | Manual URL regex | `QueryParams.getQueryParams` / `Linking.parse` | Fragment vs query, PKCE `code` vs tokens. |
| Profile row creation | Client insert | SECURITY DEFINER trigger/RPC | No INSERT RLS; needs elevated rights + atomicity with signup. |
| Account deletion | Client multi-delete | One SECURITY DEFINER RPC | Touches `auth.users` + FK graph; must be atomic + privileged. |
| GPS consent write | Client UPDATE on `users` | SECURITY DEFINER RPC | No client UPDATE policy for these fields (schema-contract). |
| Form validation | Ad-hoc checks | Zod schema + RHF resolver | Single source of truth; testable in isolation. |
| Password strength/length | Custom regex only | Supabase `minimum_password_length` + Zod | Server enforces too; keep both in sync. |

**Key insight:** in this project the database is the security boundary and the schema is already live. Almost every "write" in Phase 2 (profile create, consent, deletion) must be a SECURITY DEFINER server path because the client has deliberately narrow RLS. The client's job is collection + presentation, not enforcement.

---

## Runtime State Inventory

> Phase 2 is greenfield client code, but it provisions identity + consent state, so the durable-state seams matter.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `public.users` rows are created on signup; `gps_consent` / `gps_consent_at` written on grant; deletion anonymizes `submissions.submitter_id` + `ratings.user_id`. | Migrations for unique index + nullable FK cols; RPCs for consent + deletion. |
| Live service config | **Supabase project `ebmzhjmmtmldhrojkdqw` dashboard**: Google OAuth provider, redirect allow-list, and email-confirmation toggle live in the *remote project*, NOT in `config.toml` (which is local-dev only). | Verify/enable Google provider; add `gotta-go://**` (or chosen scheme) to redirect allow-list; confirm confirmations disabled remotely. |
| OS-registered state | URL scheme `gotta-go` registered via `app.config.ts` → requires a native rebuild (dev client) to take effect; `android/` is Expo-generated (never hand-edit). | Rebuild dev client after any scheme/plugin change; do not edit `android/`. |
| Secrets/env vars | `app/.env.local` exists (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`); never committed. Google client ID/secret live in the Supabase dashboard, not the app. | No app-side secret for Google (provider exchange is server-side). Keep `.env.local` out of git + review. |
| Build artifacts | No `babel.config.js` present; adding gesture-handler may require config + a dev-client rebuild; `database.types.ts` already generated (57 KB). | Add babel config only if `npx expo install` guidance requires; rebuild dev client; regenerate types if the deletion/uniqueness migrations change `users`. |

**Verified-empty:** No prior auth implementation, no existing SessionProvider, no existing `delete_account`/consent RPCs in migrations.

---

## Common Pitfalls

### Pitfall 1: Deep-link scheme mismatch (BLOCKER) — HIGH confidence
**What goes wrong:** OAuth and password-reset redirects never return to the app; the browser hangs on `gottago://...` which the OS doesn't recognize.
**Why:** `app.config.ts` line 10 declares `scheme: 'gotta-go'` → real deep link is `gotta-go://auth/callback`. CONTEXT/UI-SPEC say `gottago://auth/callback`. They disagree.
**How to avoid:** Pick one and make everything match: (recommended) keep `scheme: 'gotta-go'` and use `gotta-go://auth/callback` everywhere, updating CONTEXT/UI-SPEC; OR change the scheme to `gottago` (also needs a rebuild). Then add `<scheme>://**` to the Supabase project's redirect allow-list. Always build the URL via `makeRedirectUri`, never a literal.
**Warning signs:** "redirect_uri not allowed" from Supabase; browser stays open after consent.

### Pitfall 2: Google provider not configured in Supabase — HIGH confidence
**What goes wrong:** `signInWithOAuth({provider:'google'})` returns a provider error / 400.
**Why:** `config.toml` has `[auth.external.apple] enabled=false` and **no `[auth.external.google]` block at all**; the remote project must also have Google enabled with a client ID/secret.
**How to avoid:** Enable Google in the Supabase dashboard for the live project (and add a `[auth.external.google]` block for local dev) before testing OAuth. This is project config, not code — flag as a human/checkpoint task.
**Warning signs:** "Unsupported provider" / "provider is not enabled".

### Pitfall 3: Account deletion blocked by NOT NULL / RESTRICT FKs (BLOCKER) — HIGH confidence
**What goes wrong:** `delete_account` (or the auth-user cascade) throws a foreign-key violation; account can't be deleted; or the "anonymize to null" UPDATE fails because the column is `NOT NULL`.
**Why (verified in `20260519010000_remote_schema.sql`):**
- `submissions.submitter_id uuid NOT NULL references users(id)` (note: **`submitter_id`**, not `user_id`).
- `ratings.user_id uuid NOT NULL references users(id)`, plus `unique (user_id, location_id)`.
- `verification_events.user_id`, `trust_events.user_id`, `reports.user_id`, `failure_events.user_id` — all `NOT NULL references users(id)` with **no `ON DELETE`** (defaults to RESTRICT).
- `users.id references auth.users(id) on delete cascade` — deleting the auth user cascades to `public.users`, but that cascade is then RESTRICTED by the children above if any rows exist.
**How to avoid:** A migration that (a) makes `submissions.submitter_id` and `ratings.user_id` nullable (and ideally `ON DELETE SET NULL`); and (b) a **decision** on the other four child tables (anonymize-to-null, reassign to a sentinel "deleted user", or delete). CONTEXT only addresses submissions + ratings — the rest is an open gap. Note `ratings.unique(user_id, location_id)` is fine under multiple NULLs (NULLs are distinct in Postgres unique indexes).
**Warning signs:** `null value in column "submitter_id" violates not-null constraint`; `update or delete on table "users" violates foreign key constraint`.

### Pitfall 4: No profile-creation trigger / no INSERT policy — HIGH confidence
**What goes wrong:** User signs up, `auth.users` row exists, but `public.users` row never appears → profile screen, stats, display_name all break; or sign-up errors with "Database error saving new user".
**Why:** No `handle_new_user`/`AFTER INSERT ON auth.users` trigger exists in any migration, and `users` has only `service_role_all`, `users_select_own`, `users_update_own` policies — **no INSERT** — so the client can't self-provision.
**How to avoid:** Verify whether a trigger already exists on the *live* project (dashboard-created triggers won't appear in the public-schema capture). If absent, add a SECURITY DEFINER `handle_new_user` trigger that inserts `id, email, display_name` (display_name read from `new.raw_user_meta_data->>'display_name'`, which means `signUp` must pass `options.data.display_name`). See §Open Questions Q1.
**Warning signs:** profile query returns 0 rows for a freshly signed-up user.

### Pitfall 5: display_name uniqueness has no DB backstop — MEDIUM confidence
**What goes wrong:** Two users get the same display name; or a trigger that inserts display_name fails with an opaque "Database error saving new user" on collision.
**Why:** No unique index on `users.display_name` exists. A pre-check RPC alone is racy.
**How to avoid:** Add `create unique index ... on users (lower(display_name))` + pre-check RPC; map unique-violation to the friendly copy. If provisioning is trigger-based, a collision aborts the `auth.users` insert and surfaces as a generic 500 — so the **pre-check before signUp** is needed for good UX, with the index as the safety net.

### Pitfall 6: TDD coverage config excludes the screens you're building — MEDIUM confidence
**What goes wrong:** Real auth logic written inline in `src/app/*.tsx` is silently excluded from the 100% coverage gate (jest.config `'!src/app/**'`), violating the spirit of TDD-100% while appearing green.
**Why:** `jest.config.js` excludes `src/app/**` (comment: "Placeholder screens — E2E/integration tested from Phase 3").
**How to avoid:** Put all testable logic in `src/features/**` (covered); keep `src/app/*` thin. Update the exclusion comment/scope as a deliberate decision. Every new `src/**` file still needs a test-first per TDD Guard regardless of coverage collection.

### Pitfall 7: config.toml is local-dev only; password length mismatch — LOW/MEDIUM
**What goes wrong:** Assuming `config.toml` reflects the live project; or client enforces 8-char passwords while server allows 6 (config) → inconsistent rejection.
**How to avoid:** Treat `config.toml` as local-dev; verify remote settings in the dashboard. Align `minimum_password_length` to 8 (config + Zod) to match the UI-SPEC validation copy ("at least 8 characters").

---

## Code Examples

### Email/password sign-up passing display_name to the trigger
```typescript
// Source: CITED supabase-js v2 auth.signUp; display_name into user metadata for the trigger
const { data, error } = await supabase.auth.signUp({
  email, password,
  options: { data: { display_name: displayName } },   // → new.raw_user_meta_data in trigger
});
// confirmations disabled → data.session is present immediately (decision #6)
```

### Zod validation schema (covered module)
```typescript
// features/auth/validation.ts — Source: CONTEXT #13 + UI-SPEC validation table
export const displayName = z.string()
  .min(3, 'Display name must be at least 3 characters.')
  .max(20, 'Display name must be 20 characters or fewer.')
  .regex(/^[A-Za-z0-9 _-]+$/, 'Display name can only contain letters, numbers, spaces, hyphens, and underscores.');
export const password = z.string().min(8, 'Password must be at least 8 characters.');
```

### GPS consent write (granted only) via RPC
```typescript
// Source: design-system §16 + CONTEXT #10
const { status } = await Location.requestForegroundPermissionsAsync();
if (status === 'granted') {
  await supabase.rpc('set_gps_consent');   // SECURITY DEFINER sets gps_consent=true, gps_consent_at=now()
}
// denied / skip: write nothing; navigate to Map (ERR-01 manual mode)
```

### GestureHandlerRootView at the root (NEW in Phase 2)
```typescript
// Source: CITED docs.swmansion.com gesture-handler installation
import { GestureHandlerRootView } from 'react-native-gesture-handler';
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider><Slot /></SessionProvider>
    </GestureHandlerRootView>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-segment `_layout` auth checks | `Stack.Protected` guard OR root `useSegments` redirect | Expo Router v5 / SDK 53 | Project locks `useSegments` (decision #2); `Stack.Protected` noted only as alternative. |
| Legacy Architecture optional | **New Architecture mandatory** (Fabric/TurboModules/Bridgeless) | Expo SDK 55 / RN 0.83 | `newArchEnabled` removed; all added native libs must be New-Arch compatible (gesture-handler ≥2.16 is). `[CITED: expo.dev/changelog/sdk-55]` |
| OAuth implicit tokens in URL | PKCE `code` + `exchangeCodeForSession` (supabase-js v2 default) | supabase-js v2 | Callback parsing must branch on `code` vs tokens. |
| `expo-auth-session` 7.x (SDK 54) | `expo-auth-session` 55.0.17 (SDK 55 tag) | SDK 55 | Use `npx expo install` to pin correctly; npm `latest` (56.x) is for SDK 56. |

**Deprecated/outdated to avoid:**
- Don't enable Legacy Architecture (removed in SDK 55).
- Don't install npm `latest` for Expo-managed native libs — use `npx expo install`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A live `handle_new_user` trigger may or may not exist on the remote project (not in migrations). | Pitfall 4 / Q1 | If it exists and differs, a duplicate trigger or wrong columns; if absent and assumed present, profiles never created. **Highest-risk item.** |
| A2 | supabase-js v2.106 defaults to PKCE flow for OAuth. | Pattern 3 | Wrong callback parsing branch → OAuth login silently fails. |
| A3 | `display_name` uniqueness should be case-insensitive. | Pattern 5 | Case-sensitive index allows "John"/"john" impersonation; or over-restricts if user wanted case-sensitive. Needs user confirm. |
| A4 | Exact SDK-55 pin for `react-native-gesture-handler` (use `npx expo install`). | Standard Stack | Wrong pin → New-Arch crash; mitigated by `expo install`. |
| A5 | Termly Privacy/ToS URLs are available to drop into onboarding/Settings. | Open Questions | Links dead/missing → ToS requirement + guideline 5.1.1 unmet. |
| A6 | The 4 non-anonymized child tables (verification_events, trust_events, reports, failure_events) need a deletion-handling decision. | Pitfall 3 | Without a decision, deletion RPC fails or leaves orphaned identity data (GDPR risk). |
| A7 | Remote Supabase project has email confirmation disabled (config.toml shows local only). | Pitfall 7 | If enabled remotely, `signUp` returns no session → breaks decision #6 flow. |

---

## Open Questions (RESOLVED)

1. **Does a profile-creation trigger already exist on the live project?** — RESOLVED: `handle_new_user()` trigger confirmed live via Supabase MCP (`on_auth_user_created` → inserts id+email only, NOT display_name). Wave 0 migration in 02-01a captures it for reproducibility. See CONTEXT §10.

2. **Deletion handling for verification_events / trust_events / reports / failure_events.** — RESOLVED: SET NULL migration for all 5 child tables + submissions + ratings = 7 FK columns total. `availability_flags.reporter_id` confirmed as 7th. See CONTEXT §6.

3. **Deep-link scheme: `gotta-go` (current config) vs `gottago` (CONTEXT)?** — RESOLVED: `gotta-go://auth/callback` is authoritative (from `app.config.ts:10`). CONTEXT §4 has been corrected. All plans use `gotta-go://`.

4. **Termly Privacy Policy + ToS URLs** — RESOLVED (deferred): placeholder constants in `app/src/constants/legal.ts`; user supplies live URLs before `/review-gate`. See SUMMARY note in 02-01a.

5. **display_name case sensitivity** for the unique index — RESOLVED: case-insensitive `lower(display_name)` unique index. See CONTEXT §10.

6. **Should `jest.config.js` `!src/app/**` exclusion change?** — RESOLVED: convention confirmed and locked. Logic in covered `src/features/**` modules (100%), thin screens in `src/app/**` excluded from coverage collection. Documented in jest.config.js comment.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (remote) | All auth | ✓ (`ebmzhjmmtmldhrojkdqw`) | live | — |
| Supabase Google provider | OAuth | ✗ (not in config.toml; remote unverified) | — | Email/password works without it; gate Google behind config task |
| Deep-link scheme registration | OAuth + reset | ⚠ scheme present but mismatched | `gotta-go` | Must reconcile + rebuild dev client |
| `expo-web-browser` | OAuth | ✓ | ~55.0.16 | — |
| `expo-linking` | Deep links / URLs | ✓ | ~55.0.15 | — |
| `expo-location` | GPS consent | ✓ | ~55.1.10 | — |
| `react-native-gesture-handler` | Router/gestures | ✗ | — | `npx expo install` (Phase 2 task) |
| `expo-auth-session` | OAuth helpers | ✗ | — | `expo-linking` createURL/parse (no new dep) |
| `babel.config.js` | RN build | ✗ (none present) | — | Verify `babel-preset-expo` covers worklets; add only if `expo install` requires |
| Apple Developer account | Real Apple Sign-In | ✗ (blocker) | — | iOS stub only (out of scope) |

**Missing with no fallback (blocking until addressed):** Supabase Google provider config + reconciled redirect scheme (blocks the OAuth requirement only — email/password path is unblocked).
**Missing with fallback:** gesture-handler and expo-auth-session (install via `expo install`); babel config (likely unneeded).

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `jest@29.7.0` (PINNED) + `jest-expo@^55` + `@testing-library/react-native@^13.3.3` + `msw@^2.14.6` |
| Config file | `app/jest.config.js` (preset `jest-expo`; setup `app/jest.setup.ts`) |
| Quick run command | `cd app && npm test` |
| Full suite command | `cd app && npm run test:coverage` (threshold 100% lines/branches/functions/statements) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| validation | display_name/email/password rules + error copy | unit | `npm test -- features/auth/validation.test.ts` | ❌ Wave 0 |
| protected routes | `nextRoute(segments, hasSession)` decision | unit | `npm test -- features/auth/redirect.test.ts` | ❌ Wave 0 |
| SessionProvider | loading gate + onAuthStateChange updates (MSW/mock) | unit | `npm test -- features/auth/SessionProvider.test.tsx` | ❌ Wave 0 |
| OAuth | build redirect / parse callback / set session | unit | `npm test -- features/auth/oauth.test.ts` | ❌ Wave 0 |
| sign-in/up screens | render, on-submit validation, loading/error states, a11y roles | component (RNTL) | `npm test -- app/(auth)` | ❌ Wave 0 (note: `src/app/**` excluded from *coverage*, still tested) |
| GPS consent | write only on `granted` | unit | `npm test -- features/auth/gpsConsent.test.ts` | ❌ Wave 0 |
| account deletion | RPC caller + SIGNED_OUT redirect | unit | `npm test -- features/profile/deleteAccount.test.ts` | ❌ Wave 0 |
| display_name uniqueness | pre-check + unique-violation → friendly error | unit | `npm test -- features/auth/displayName.test.ts` | ❌ Wave 0 |
| SQL (migrations/RPCs) | TDD-OFF per CLAUDE.md; reviewed by Antigravity | review | n/a (pgTAP deferred to Phase 9) | n/a |

### Sampling Rate
- **Per task commit:** `cd app && npm test` (relevant suite) — TDD Guard enforces test-first on every `src/**` file.
- **Per wave merge:** `cd app && npm run test:coverage` (100% gate over `src/**` excluding `src/app/**`, `database.types.ts`).
- **Phase gate:** full suite green + each screen PLAN cites design-system §20 + Antigravity/Codex APPROVE before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `features/auth/validation.ts` + test — display_name/email/password (REQ validation)
- [ ] `features/auth/redirect.ts` + test — pure guard decision (REQ protected routes)
- [ ] `features/auth/SessionProvider.tsx` + test — session/loading + events
- [ ] `features/auth/oauth.ts` + test — redirect build/parse/setSession
- [ ] `features/auth/gpsConsent.ts` + test — granted-only write
- [ ] `features/profile/deleteAccount.ts` + test — RPC caller
- [ ] Decide `jest.config.js` `!src/app/**` policy; document convention
- [ ] Confirm `jest.setup.ts` mocks: `@supabase/supabase-js` auth, `expo-web-browser`, `expo-location`, `expo-router` (`useSegments`/`useRouter`)
- [ ] SQL migrations are TDD-OFF — no jest tests; ensure Antigravity review queued

---

## Security Domain

> `security_enforcement` not set in config → treated as enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase GoTrue (email/password + Google OIDC); `minimum_password_length` (align to 8); no user enumeration in error copy ("Invalid email or password."). |
| V3 Session Management | yes | supabase-js refresh-token rotation (`enable_refresh_token_rotation=true`), AsyncStorage persistence, `SIGNED_OUT` handling; deletion revokes session. |
| V4 Access Control | yes | RLS on all tables + SECURITY DEFINER RPCs; client redirect is UX only, not the boundary. |
| V5 Input Validation | yes | Zod schemas on all auth inputs; DB unique index for display_name; PKCE for OAuth. |
| V6 Cryptography | no (delegated) | Token signing/hashing handled by Supabase — never hand-rolled. |
| V7 Error/Logging | yes | **No PII in logs** (email, display_name, GPS) — CLAUDE.md non-negotiable + §20 checklist. Generic auth errors. |
| V8 Data Protection / Privacy | yes | GDPR: consent written only on grant; account deletion anonymizes/erases identity; ToS/Privacy linked. |

### Known Threat Patterns for Supabase + Expo auth
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User enumeration via auth errors | Information Disclosure | Generic "Invalid email or password." (locked copy). |
| OAuth redirect hijack / open redirect | Tampering/Elevation | Strict redirect allow-list in Supabase; `makeRedirectUri`; PKCE. |
| Client-forged profile/consent writes | Tampering/Elevation | No client INSERT/UPDATE on `users`; SECURITY DEFINER RPCs with `auth.uid()`. |
| Orphaned identity after deletion (GDPR) | Repudiation/Privacy | RPC anonymizes/erases all FK children, then deletes `auth.users`. |
| Display-name impersonation | Spoofing | Case-insensitive unique index. |
| PII leakage to logs/Sentry | Information Disclosure | No email/display_name/GPS in `console.log` or telemetry (§20 + Phase 9 scrubbing). |
| Stolen-device session reuse | Spoofing | Refresh-token rotation; sign-out clears AsyncStorage session. |

---

## Project Constraints (from CLAUDE.md)

- **TDD Guard ON for all `app/src/**`** — test-first, red→green→refactor; SQL migrations are TDD-OFF (Antigravity-reviewed). `--no-verify` forbidden without explicit approval.
- **`jest@29.7.0` PINNED** — no dep may upgrade jest (blocks `jest-expo@56` reporter integration).
- **Coverage 100%** lines/branches/functions/statements for `src/**` (current config excludes `src/app/**`, `database.types.ts`).
- **No raw SQL** except migrations or safely parameterized server-only RPCs.
- **No PII in logs** (email, display_name) — and no precise GPS.
- **`app/.env.local` never committed**, never shared in review.
- **`android/` never manually edited** (Expo-generated) — scheme/plugin changes via `app.config.ts` + rebuild.
- **GPS in PostGIS geometry/geography only** (inherited; not directly exercised in Phase 2).
- **Review gate:** log files to `.claude/review-queue.txt` → `/review-gate` (GSD → Antigravity → Codex); no commit without APPROVE from both Antigravity AND Codex.
- **Every Phase 2 PLAN.md that creates/modifies a screen component MUST cite `docs/design/design-system.md §20` verbatim** (the full checklist is embedded in `02-UI-SPEC.md`) before the review gate opens. Screen-creating plans: **02-01** (Welcome, Sign-In, Sign-Up, GPS Consent, root `_layout`, `(tabs)/_layout`) and **02-02** (Profile signed-in/unauth, Settings stub, Auth-Required modal, Forgot/Reset Password, Nearby/Submit stubs). The §20 GPS-Consent and Security sub-sections are directly load-bearing for Phase 2.
- **Token files first:** `02-UI-SPEC.md` requires creating `constants/Colors.ts` (39 tokens), `constants/typography.ts`, `spacing.ts`, `radius.ts` before any screen (TDD-excluded constants).
- **bd (beads) for task tracking** — not TodoWrite/markdown TODOs.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `app.config.ts`, `app/src/lib/supabase.ts`, `app/jest.config.js`, `app/package.json`, all route stubs, `supabase/config.toml`, `supabase/migrations/20260519010000_remote_schema.sql` (users/submissions/ratings/all FK definitions), `docs/schema-contract.md`, `02-CONTEXT.md`, `02-UI-SPEC.md`, `ROADMAP.md`, `PROJECT.md`, `CLAUDE.md`.
- npm registry (`npm view`): `expo-auth-session` dist-tags (`sdk-55`=55.0.17), `react-native-gesture-handler` (latest 3.0.2, legacy 2.32.0); both `scripts.postinstall` empty.

### Secondary (MEDIUM-HIGH, CITED official docs)
- supabase.com/docs/guides/auth/native-mobile-deep-linking — OAuth/magic-link deep-link pattern (`maybeCompleteAuthSession`, `makeRedirectUri`, `QueryParams.getQueryParams`, `setSession`, `signInWithOAuth` `skipBrowserRedirect`, `openAuthSessionAsync`).
- docs.expo.dev/router/advanced/authentication + /protected — `useSegments`+`router.replace` and `Stack.Protected`; `replace`-not-`push`, iOS flash gotcha.
- expo.dev/changelog/sdk-55 — New Architecture mandatory in SDK 55.
- docs.expo.dev/versions/latest/sdk/gesture-handler + docs.swmansion.com — New-Arch compatibility, `GestureHandlerRootView`.

### Tertiary (LOW — flagged for validation)
- Web search claim "SDK 55 pins gesture-handler ~2.20.x" conflicts with npm dist-tags (latest 3.0.2) → **do not trust; use `npx expo install`** (A4).
- supabase-js v2 PKCE-default assumption (A2) — verify against installed v2.106 behavior.

---

## Metadata

**Confidence breakdown:**
- Schema/codebase findings (scheme mismatch, FK constraints, missing trigger, missing unique index, no INSERT policy, jest exclusion): **HIGH** — read directly from source files.
- Auth/OAuth/router patterns: **MEDIUM-HIGH** — CITED official Supabase + Expo docs; exact PKCE branch + SDK-55 pins flagged.
- Live-project state (trigger existence, Google provider, remote confirmation toggle): **LOW until verified** — config.toml is local-dev only; needs dashboard/MCP check.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 for stable schema/codebase facts; ~7 days for SDK-55-pinned versions (fast-moving — re-resolve via `npx expo install` at implementation time).

## RESEARCH COMPLETE
