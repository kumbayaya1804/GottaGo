# Phase 2 — Plan 02-01 Summary (02-01a + 02-01b)

**Completed:** 2026-06-29
**Plans:** Wave 0 foundation (02-01a) + Auth modules + screens (02-01b)
**Status:** ALL TASKS COMPLETE — 02-02 may begin

---

## Commits

| SHA | Description | WU |
|-----|-------------|-----|
| `15a8dc4` | feat(02-01a): Wave 0 packages, babel, Supabase config, jest mocks | T2 |
| `502105c` | feat(02-01a): Design token files — Colors, typography, spacing, radius, legal | T3 |
| `6c60a1d` | feat(02-01a): Wave 0 migrations — handle_new_user trigger, display_name index, auth RPCs | T4 |
| `fedc053` | chore(02-01b): jest coverage exclusion + types sync | infra |
| `97ec0e1` | feat(02-01b-T5): TDD auth-logic modules | T5 |
| `c37d1e2` | feat(02-01b-T6): Root layout + nav shell + Welcome screen | T6 |
| `ea07fca` | feat(02-01b-T7): Auth forms + GPS consent + reset-password screens | T7 |

---

## Test Suite State

- **109 tests, 15 suites, 0 failures** (as of ea07fca)
- **100% coverage** on all `src/features/**` (src/app/** and src/constants/** excluded)

---

## Auth-Logic Modules (src/features/auth/) — 100% coverage

| File | Exports | Key Behavior |
|------|---------|--------------|
| `validation.ts` | `displayName`, `email`, `password`, `signUpSchema`, `signInSchema` | Zod schemas; display name 3–20 chars, `[A-Za-z0-9 _-]`; password ≥8 |
| `redirect.ts` | `isProtected`, `nextRoute` | Only `submit` is protected; `(tabs)/profile` is public (Pattern 2 gotcha d) |
| `SessionProvider.tsx` | `SessionProvider`, `SessionContext`, `SessionContextValue` | getSession seed + onAuthStateChange subscription; `{ session, loading, signOut }` |
| `useSession.ts` | `useSession` | Consumer hook; throws if used outside SessionProvider |
| `displayName.ts` | `checkDisplayNameAvailable`, `isDisplayNameTakenError` | RPC caller + 23505/users_display_name_lower_uniq error mapper |
| `gpsConsent.ts` | `requestGpsConsent` | set_gps_consent RPC called ONLY on 'granted' (T-02-04) |

---

## Screens Delivered

| Screen | Route | Key Behavior |
|--------|-------|--------------|
| Welcome | `/` (index.tsx) | Sign In → `/(auth)/sign-in`; Create Account → `/(auth)/sign-up`; LEGAL_URLS TOS links |
| Sign In | `/(auth)/sign-in` | Single AUTH_ERROR_COPY for all credential failures (T-02-01); network error separate |
| Sign Up | `/(auth)/sign-up` | checkDisplayNameAvailable first; display_name in signUp options.data; → /gps-consent |
| Forgot Password | `/(auth)/forgot-password` | resetPasswordForEmail + success state; redirectTo via Linking.createURL |
| Reset Password | `/reset-password` | updateUser; reached via PASSWORD_RECOVERY route in root layout |
| GPS Consent | `/gps-consent` | "Enable Location" calls requestGpsConsent(); "Skip for now" does NOT (T-02-04) |

## Navigation Shell

| File | Status |
|------|--------|
| `_layout.tsx` | GestureHandlerRootView → SessionProvider → guard (nextRoute) + PASSWORD_RECOVERY subscription |
| `(tabs)/_layout.tsx` | 4 tabs: Map, Nearby, Submit, Profile; token-driven colors |
| `(auth)/_layout.tsx` | headerless Stack |
| `(tabs)/nearby.tsx` | Visual stub |
| `(tabs)/submit.tsx` | Visual stub |

---

## Migrations Applied (live — project ebmzhjmmtmldhrojkdqw)

| Migration | Name | Status |
|-----------|------|--------|
| 20260627000000 | handle_new_user_trigger | ✓ Applied |
| 20260627000001 | display_name_unique_index | ✓ Applied |
| 20260627000002 | auth_rpcs | ✓ Applied |

`check_display_name_available(text)`: callable by anon + authenticated ✓
`set_gps_consent()`: callable by authenticated only; anon explicitly revoked ✓

---

## Infrastructure Notes

- **jest.config.js**: `src/constants/**` excluded from coverage (pure data tokens, no logic)
- **database.types.ts**: regenerated 2026-06-28 — includes `check_display_name_available` + `set_gps_consent` in `Functions` block
- **expo-auth-session NOT installed**: deferred to 02-02. Password reset uses `Linking.createURL('auth/callback')` instead of `makeRedirectUri`.
- **Supabase Alt DEFAULT PRIVILEGES**: both `revoke from public` AND `revoke from anon` required (documented in 20260627000002 migration comment)

---

## ⚠️ LEGAL_URLS: Still Placeholder

`app/src/constants/legal.ts` exports placeholder Termly UUIDs.
**User action required before any user-facing build:** Replace `PLACEHOLDER_TOS` and `PLACEHOLDER_PRIVACY` with real Termly policy UUIDs.

---

## What 02-02 Starts With

- Email/password auth path: complete and tested
- Session persistence: AsyncStorage-backed, survives app restart
- Protected routing: `submit` tab only; all other tabs public
- GPS consent: OS dialog + DB write wired; consent written server-side only
- OAuth/Apple: placeholder comment in sign-in.tsx — wired in 02-02 (T3/T4)
- Profile update RPC: NOT YET — built in 02-02 T1
- DeleteAccountModal, AuthRequiredModal: NOT YET — built in 02-02 T5
