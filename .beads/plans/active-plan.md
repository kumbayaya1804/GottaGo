# Active Plan — Phase 2: Auth & Profiles
<!-- approved: 2026-06-28 -->
<!-- antigravity-verdict: APPROVE Round 1 -->
<!-- codex-verdict: APPROVE Round 2 -->
<!-- user-approved: true -->
<!-- status: in-progress -->
<!-- execution-method: metaswarm-orchestrated -->

## Three-Plan Wave Structure

| Plan | Wave | Depends On | Human Gates |
|------|------|------------|-------------|
| 02-01a | 1 | none | T1 (gesture-handler verify) |
| 02-01b | 2 | 02-01a T4 complete (db push) | none |
| 02-02 | 3 | 02-01b complete | T2 (expo-auth-session + OAuth dashboard) |

## Work Unit Decomposition

### Plan 02-01a — Wave 0 Foundation

| WU | Type | Title | Depends On | Files |
|----|------|-------|------------|-------|
| WU-01a-T1 | CHECKPOINT | Verify react-native-gesture-handler (npmjs) | — | none |
| WU-01a-T2 | AUTO | Packages, babel, Supabase config, jest mocks | T1 approved | app/package.json, babel.config.js, jest.setup.ts, jest.config.js, supabase/config.toml |
| WU-01a-T3 | AUTO | Design token files | T1 approved (parallel with T2) | app/constants/Colors.ts, app/src/constants/*.ts |
| WU-01a-T4 | AUTO+BLOCKING | Wave 0 migrations + supabase db push | T2+T3 | supabase/migrations/20260627000000-02.sql |

### Plan 02-01b — Auth Modules + Screens

| WU | Type | Title | Depends On | Files |
|----|------|-------|------------|-------|
| WU-01b-T5 | AUTO+TDD | Covered auth-logic modules | T4 db push ✓ | app/src/features/auth/* (6 modules + 6 tests) |
| WU-01b-T6 | AUTO | Root layout + nav shell + Welcome | T5 | app/src/app/_layout.tsx, index.tsx, (tabs)/*, (auth)/_layout.tsx |
| WU-01b-T7 | AUTO | Auth forms + GPS consent + reset screens | T5+T6 | app/src/app/(auth)/*.tsx, gps-consent.tsx, reset-password.tsx |

### Plan 02-02 — OAuth + Profile + Deletion

| WU | Type | Title | Depends On | Files |
|----|------|-------|------------|-------|
| WU-02-T1 | AUTO+BLOCKING | Nullable-FK migration + profile RPCs + db push | 02-01b ✓ | supabase/migrations/20260627000003-04.sql |
| WU-02-T2 | CHECKPOINT | expo-auth-session verify + Supabase OAuth dashboard | T1 done | none |
| WU-02-T3 | AUTO+TDD | Covered OAuth + profile modules | T1+T2 | app/src/features/auth/oauth.ts, features/profile/* (4 modules + 5 tests) |
| WU-02-T4 | AUTO | OAuth/Apple buttons + callback + updateProfile wiring | T3 | sign-in.tsx, auth/callback.tsx, sign-up.tsx |
| WU-02-T5 | AUTO | Profile + Settings + Delete + AuthRequired modals | T3 | (tabs)/profile.tsx, (components)/*.tsx |
| WU-02-T6 | AUTO+TDD | Profile-trigger provisioning test | T1+T5 | features/profile/__tests__/profileTrigger.test.ts |
