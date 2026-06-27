---
phase: "02"
phase_name: "Auth & Profiles"
status: locked
created: 2026-06-26
discuss_areas:
  - Auth state architecture
  - Google OAuth approach
  - GPS consent placement
  - Sign-in UX details
  - Display name constraints
  - Onboarding / TOS links
  - Account deletion UX
---

# Phase 2 Context: Auth & Profiles

All decisions below are LOCKED. Downstream agents (researcher, planner, executor) must not re-ask these questions or introduce alternatives without a context update signed off by the user.

---

## 1. Auth State Architecture

| Decision | Value |
|----------|-------|
| SessionProvider pattern | React Context — `SessionProvider` wraps root `_layout.tsx`; subscribes to `supabase.auth.onAuthStateChange` |
| Protected route mechanism | `useSegments + router.replace` inside root `_layout.tsx` effect that runs on every session state change |
| `users` table row fetch | **NOT in SessionProvider** — fetched lazily via TanStack Query when a component needs profile data |
| Sign-out triggers | Two paths: (1) Settings screen button; (2) `onAuthStateChange` fires `SIGNED_OUT` event (handles external revocation) |
| Cold-start UI | Blank splash (loading=true) until the first `onAuthStateChange` event fires — no premature redirect |
| Email confirmation | **Disabled in v1** — `supabase.auth.signUp()` returns a session immediately; no confirm-your-email step |
| Unauthenticated landing | Map tab — users browse freely; sign-in prompt appears only when a protected action is tapped |

**Supabase client already configured** in `app/src/lib/supabase.ts`:
- `storage: AsyncStorage`, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`
- No changes needed to this file in Phase 2.

---

## 2. Google OAuth

| Decision | Value |
|----------|-------|
| Implementation | `supabase.auth.signInWithOAuth({ provider: 'google' })` + `expo-web-browser` to open the consent page |
| Deep-link callback scheme | `gotta-go://auth/callback` — `app.config.ts` already declares `scheme: 'gotta-go'` (confirmed). Supabase redirect allow-list must include `gotta-go://auth/callback`. |
| iOS | **No Google button on iOS.** Disabled Apple Sign-In button with explanation text: "Apple Sign-In coming soon — use email/password for now." |
| Android | Google OAuth button is present and functional |

Apple OAuth is a stub only (no Apple Developer account). Google OAuth is Android-only in Phase 2.

---

## 3. GPS Consent

| Decision | Value |
|----------|-------|
| Timing | Dedicated GPS Consent screen shown **after sign-in/sign-up, before Map tab** — first launch only |
| Screen UX | Explanation screen first (why GPS is needed, privacy assurance), then user taps a button to trigger the OS dialog. No cold OS dialog. |
| Denial behavior | User taps "Skip for now" — `users.gps_consent` stays `false`, app enters manual-search mode (no geo-filtering). User reaches Map tab regardless. |
| Re-prompt policy | Only from Settings → GPS Permissions section. **Never automatically re-shown.** |
| `gps_consent_at` | Written to `users` table only after OS dialog resolves to `granted`. Never written on denial or skip. |

---

## 4. Sign-in UX

| Decision | Value |
|----------|-------|
| Welcome screen | YES — a welcome screen appears before auth forms. Contents: app logo + tagline + two buttons: "Sign In" / "Create Account". No feature carousel. |
| Protected-action entry point | Sign-in screen first (not a choice hub). "Don't have an account? Create one" link at bottom. |
| Sign-up fields | Email + password + display name (all three on one form) |
| Auth error copy | Generic: "Invalid email or password." — no user enumeration |
| Password reset | User taps "Forgot password?", enters email, receives magic link. Link uses `gottago://auth/callback` deep link to return to an in-app Reset Password screen. |
| Form validation timing | On submit only — no inline/blur validation errors while typing |
| TOS/Privacy copy | Below "Create Account" button: "By creating an account you agree to our [Terms of Service] and [Privacy Policy]." Tappable links, no checkbox required. |

---

## 5. Display Name Constraints

| Constraint | Value |
|-----------|-------|
| Length | 3–20 characters |
| Allowed characters | Letters, numbers, spaces, hyphens, underscores |
| Uniqueness | **YES — unique.** No two users may share a display name. Uniqueness check required at sign-up. |

The `display_name` uniqueness constraint must be enforced at the **database level** (unique index on `users.display_name`) AND at the API/RPC layer with a user-friendly error message: "That display name is already taken."

---

## 6. Account Deletion

| Decision | Value |
|----------|-------|
| Timing | **Immediate** — account is deleted on confirmation. No grace period. |
| Contributed data | **Anonymized** — submissions and ratings remain (community data). `user_id` / `submitter_id` is set to `null`. User identity removed; location data preserved. |
| Child table strategy | **SET NULL migration** — `verification_events.user_id`, `trust_events.user_id`, `reports.user_id`, `failure_events.user_id`, AND `availability_flags.reporter_id` (5 total) are currently `NOT NULL`. A Wave 0 migration alters all five to `NULL`-able with `ON DELETE SET NULL`. Without this migration the `delete_account` RPC cannot execute. |
| Trigger | Settings → "Delete Account" → confirmation modal where user must type `DELETE` to confirm. |
| RPC | `delete_account` RPC (server-side) handles anonymization + auth user deletion. Client never touches the `users` table directly for deletion. |

---

## 7. Existing Code Assets (do not recreate)

These exist from Phase 1 and must be extended, not replaced:

| File | Status | Phase 2 action |
|------|--------|----------------|
| `app/src/lib/supabase.ts` | Complete — no changes needed | Import only |
| `app/src/app/_layout.tsx` | Stub — plain `<Stack>` + `<View>` | Replace with `SessionProvider` + `useSegments` logic |
| `app/src/app/(auth)/sign-in.tsx` | Stub — `<Text>Sign In (Phase 2)</Text>` | Replace with full form |
| `app/src/app/(auth)/sign-up.tsx` | Stub — `<Text>Sign Up (Phase 2)</Text>` | Replace with full form |
| `app/src/app/(tabs)/index.tsx` | Map stub | Unauthenticated access must work (no redirect) |
| `app/src/app/(tabs)/profile.tsx` | Profile stub | Protected — redirect to sign-in if no session |

---

## 8. Scope Constraints

**In Phase 2:**
- Email/password auth (Supabase)
- Google OAuth (Android only)
- Apple Sign-In stub (iOS — disabled button + copy)
- Welcome screen + sign-in + sign-up screens
- GPS Consent screen
- Password reset (magic link + in-app reset screen)
- Profile auto-creation trigger (verify existing Supabase trigger or create if absent)
- Protected routes (`useSegments + router.replace`)
- Account deletion RPC + Settings stub screen
- Display name uniqueness enforcement

**Deferred (not Phase 2):**
- Apple Sign-In (requires Apple Developer account — Phase 9)
- Google OAuth for iOS
- Display name editing UI (Settings screen is a stub in Phase 2; edit comes later)
- Social sign-in providers beyond Google
- Two-factor authentication

---

## 10. Research Amendments (2026-06-27)

Findings from Phase 2 research that amend or extend prior decisions. All items below are LOCKED.

| Finding | Impact |
|---------|--------|
| `display_name` uniqueness is **case-insensitive** | Use `lower(display_name)` unique index (or `citext`). "Admin" and "admin" are the same name. Migration required. |
| `handle_new_user()` trigger **exists on live DB** but not in migrations | Wave 0 must add a migration capturing the trigger. Function body: `INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email)` — `display_name` is NOT set by the trigger, must be set via RPC/update after signup. |
| `react-native-gesture-handler` and `expo-auth-session` **not installed** | Wave 0 task: `npx expo install react-native-gesture-handler expo-auth-session@55.0.17`. GestureHandlerRootView must wrap root layout. |
| TDD structure: **`src/features/auth/`** pattern | Auth business logic (session management, form validation, RPC calls) lives in `src/features/auth/` and is covered at 100%. Screen files in `src/app/` remain thin wrappers excluded from coverage per existing jest.config.js rule. |
| Password minimum length mismatch | `supabase/config.toml` sets `minimum_password_length = 6`; UX should show 8-char minimum. Wave 0 migration or config update needed to align to 8. |

---

## 9. Key Constraints Inherited from Prior Phases

- **No raw SQL** except migrations or safely parameterized server-only RPCs
- **No PII in logs** — `display_name` and `email` never logged
- **GPS in PostGIS geometry/geography columns only** — never raw lat/lon strings
- **`app/.env.local` never committed**
- **`android/` never manually edited** — Expo-generated
- **TDD Guard is ON** for all `app/src/**` files — tests before implementation
- **jest@29.7.0 PINNED** — do not upgrade
- **Component Acceptance Checklist from `docs/design/design-system.md §20`** must be cited in each Phase 2 PLAN.md that creates or modifies a screen component, before the review gate is opened
