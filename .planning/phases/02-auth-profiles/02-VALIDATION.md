---
phase: "02"
slug: auth-profiles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.7.0 (PINNED) + jest-expo 55 |
| **Config file** | `app/jest.config.js` |
| **Quick run command** | `cd app && npm test` |
| **Full suite command** | `cd app && npm run test:coverage` |
| **Coverage scope** | `app/src/features/**` + `app/src/lib/**` — screens in `app/src/app/**` excluded per project convention |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npm test`
- **After every plan wave:** Run `cd app && npm run test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green at 100% lines/branches/functions/statements
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-W0 | 01 | 0 | Migrations | T-02-01 | SET NULL FKs prevent deletion block | migration | `cd app && npm test` | ❌ W0 | ⬜ pending |
| 02-01-01 | 01 | 1 | SessionProvider | T-02-02 | onAuthStateChange fires before any redirect | unit | `cd app && npm test` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | Protected routes | T-02-03 | Unauthenticated user redirected to sign-in | unit | `cd app && npm test` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | Sign-in form | T-02-04 | Invalid credentials → generic error, no user enumeration | unit | `cd app && npm test` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | Sign-up form | T-02-05 | display_name uniqueness error surfaced to user | unit | `cd app && npm test` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | GPS consent | T-02-06 | gps_consent_at only written on OS grant (never on skip) | unit | `cd app && npm test` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | Google OAuth | T-02-07 | OAuth only shown on Android (Platform.OS gate) | unit | `cd app && npm test` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | Profile trigger | T-02-08 | users row auto-created on signup | integration | `cd app && npm test` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | Account deletion | T-02-09 | delete_account anonymizes submissions + 4 child tables | unit | `cd app && npm test` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 2 | Password reset | T-02-10 | Deep link `gotta-go://auth/callback` parsed correctly | unit | `cd app && npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Created via TDD in 02-01b (Tasks 5–7) and 02-02 (Tasks 3, 6):

- [ ] `app/src/features/auth/__tests__/SessionProvider.test.tsx` — SessionProvider + protected route tests
- [ ] `app/src/features/auth/__tests__/validation.test.ts` — Zod schemas + sign-in/sign-up validation error copy
- [ ] `app/src/features/auth/__tests__/redirect.test.ts` — nextRoute guard logic
- [ ] `app/src/features/auth/__tests__/displayName.test.ts` — check_display_name_available + 23505 mapping
- [ ] `app/src/features/auth/__tests__/gpsConsent.test.ts` — GPS consent write logic (NO rpc on denied)
- [ ] `app/src/features/auth/__tests__/oauth.test.ts` — Google OAuth signInWithGoogle + handleAuthCallback
- [ ] `app/src/features/profile/__tests__/deleteAccount.test.ts` — delete_account RPC anonymization (7 tables)
- [ ] `app/src/features/profile/__tests__/updateProfile.test.ts` — update_profile RPC + 23505 mapping
- [ ] `app/src/features/profile/__tests__/profileTrigger.test.ts` — trigger provisioning contract
- [ ] `npx expo install react-native-gesture-handler` — 02-01a Task 2
- [ ] `cd app && npx expo install expo-auth-session` — 02-02 Task 2 (after package legitimacy checkpoint)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth deep link opens browser on Android | Phase 2 SC-2 | Requires real device + Google account | Install Android build; tap "Sign in with Google"; confirm browser opens and redirects back via `gotta-go://auth/callback` |
| Apple Sign-In stub shows correct copy on iOS | Phase 2 SC-6 | Requires iOS simulator or device | Confirm "Apple Sign-In coming soon — use email/password for now" text is visible; confirm button is non-interactive |
| GPS consent OS dialog appears after explanation screen | Phase 2 SC-9 | Requires real device GPS | Confirm explanation screen shows first; OS dialog only triggers on user tap; `gps_consent_at` written in Supabase only on grant |
| Account deletion types DELETE to confirm | Phase 2 SC-7 | Requires end-to-end auth + RPC | Sign in; navigate to Settings → Delete Account; confirm DELETE typed exactly; confirm user row removed from Supabase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
