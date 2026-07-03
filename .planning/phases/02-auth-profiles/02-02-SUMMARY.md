# Phase 2 — Plan 02-02 Summary (IN PROGRESS)
<!-- save point: 2026-07-02 -->
<!-- status: T1 COMPLETE, T2 COMPLETE, T3 COMPLETE, T4 COMPLETE, T5 COMPLETE, T6 NEXT -->

---

## Commits

| SHA | Description | WU |
|-----|-------------|-----|
| `ac66fc4` | feat(02-02-T1): nullable FK migration + update_profile/delete_account RPCs | T1 |
| `fa63838` | chore(02-02-T2): install expo-auth-session@55.0.17 | T2 partial (dashboard/EAS config has no code commit — verified live, not git-tracked) |
| `10e0f9e` | feat(profile): OAuth + profile TDD modules with get_profile_stats RPC | T3 |
| `76c7375` | feat(auth): OAuth UI, deep-link callback, and sign-up profile wiring | T4 |
| `c2e1e33` | docs(review-gate): runtime-boundary/mock-boundary audit + self-enforcing hook (process, not a WU) | — |
| `254af27` | feat(profile): Profile screen, Delete/AuthRequired modals, profile display-name fetch | T5 |

---

## T1 — Nullable FK Migration + Profile RPCs (COMPLETE)

### Migration 000003: nullable_user_fks
Applied live to project `ebmzhjmmtmldhrojkdqw`. All 7 FK columns now:
- `NOT NULL` dropped
- FK constraint re-added with `ON DELETE SET NULL`

| Table | Column | Old | New |
|-------|--------|-----|-----|
| submissions | submitter_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| ratings | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| trust_events | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| verification_events | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| reports | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| failure_events | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| availability_flags | reporter_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |

### Migration 000004: profile_rpcs
Applied live. Two SECURITY DEFINER functions (revoke public + anon; grant authenticated):

| RPC | Signature | Behavior |
|-----|-----------|----------|
| `update_profile` | `(new_display_name text) → void` | Checks auth.uid(); UPDATE users SET display_name, updated_at |
| `delete_account` | `() → void` | Nulls 7 FK columns atomically then DELETE auth.users |

`database.types.ts` regenerated — both RPCs typed in Functions block.

---

## T2 — expo-auth-session Verify + Dashboard Config (COMPLETE)

### Package (DONE)
- `expo-auth-session@55.0.17` installed via `npx expo install` (Expo-resolved pin)
- Publisher verified: `github.com/expo/expo`, MIT, no postinstall script
- `jest@29.7.0` unchanged

### Dashboard Tasks (DONE — verified live 2026-07-01)
- [x] Supabase Dashboard → Authentication → Providers → Google: enabled with real client id + secret (from a newly-created Google Cloud OAuth 2.0 Web client, redirect URI `https://ebmzhjmmtmldhrojkdqw.supabase.co/auth/v1/callback`)
- [x] Authentication → URL Configuration → Redirect URLs: `gotta-go://auth/callback` and `gotta-go://**` added
- [x] Authentication → Providers → Email: "Confirm email" confirmed DISABLED
- [x] EAS secrets: `GOOGLE_CLIENT_ID` (sensitive) and `GOOGLE_SECRET` (secret) confirmed present in all 3 EAS environments (production/preview/development) via `eas env:list`

---

## T3 — Covered OAuth + Profile Modules (COMPLETE — commit `10e0f9e`)

**Files:** `auth/oauth.ts`, `profile/{updateProfile,deleteAccount,profileStats}.ts` + 4 test files (21 tests total, 100% coverage on all four).

**Review round 1:** Both Antigravity and Codex independently returned REQUEST CHANGES:
- [CRITICAL/MAJOR, both] `profileStats.ts` queried `ratings` directly — blocked by the privacy-motivated privilege revocation in migration `20260624000002`. Fixed by adding `get_profile_stats()` SECURITY DEFINER RPC deriving the user via `auth.uid()`, and rewriting `profileStats.ts`/its test to call it instead of querying tables directly.
- [MINOR, Antigravity] `oauth.ts` unsafe `data.url` access — fixed with an explicit guard.
- [MINOR, informational] iOS Guideline 4.8 gating is T4's (`sign-in.tsx`) responsibility, not T3's — flagged forward, no T3 action needed.

**Migration applied (2026-07-01):** user confirmed directly in a live session; applied via Supabase MCP `apply_migration` to `ebmzhjmmtmldhrojkdqw`, `database.types.ts` regenerated, full DoD re-passed (0 typecheck errors, 130/130 tests, 100% coverage, 0 lint errors).

**Review round 2:**
- Antigravity: **APPROVE** — critical `ratings` fix confirmed resolved; only a MINOR carry-forward note (iOS 4.8 gating, T4's concern).
- Codex: **REQUEST CHANGES** — [MAJOR] the Supabase MCP `apply_migration` tool assigns its own timestamp-based version on apply rather than honoring the local file's version. Local file was drafted as `20260627000005_profile_stats_rpc.sql` but Supabase recorded it live as `20260701211135_profile_stats_rpc`, creating repo/live migration-history drift. Fixed by renaming the local file to `20260701211135_profile_stats_rpc.sql` to match. All of Codex's other findings from round 1 confirmed resolved (RPC correctness, `auth.uid()` scoping, cast pattern acceptable, test coverage of the error path).

**Round 3:** both APPROVE. iOS 4.8 note carried forward to T4. Committed `10e0f9e`; TDD Guard re-enabled (`tdd-guard on`) immediately after.

---

## T4 — OAuth UI + Deep-Link Callback + Sign-Up Profile Wiring (COMPLETE — commit `76c7375`)

**Files:** `app/src/app/(auth)/{sign-in,sign-up}.tsx` + tests, `app/src/app/auth/callback.tsx` + test (new route), `app/src/features/auth/SessionProvider.tsx` + test, `app/src/app/_layout.tsx` + test.

**Round 1:** Antigravity APPROVE (confirmed 3 flagged design decisions: explicit nav in `callback.tsx`, direct `exchangeCodeForSession` in `sign-in.tsx`, why OAuth never reaches `callback.tsx`). Codex **BLOCKER** — `signUp()` creates a session immediately (email confirmation disabled); while `sign-up.tsx` awaits `updateProfile()`, the root guard could race it and redirect to `/(tabs)` before the display-name error was shown, or before `/gps-consent`. Fixed by adding `suppressGuardRedirect`/`setSuppressGuardRedirect` to `SessionContextValue` (scope expanded to `SessionProvider.tsx`/`_layout.tsx`, both already-approved from WU-01b); `sign-up.tsx` raises it before `signUp()`, clears it only via `useEffect` cleanup on unmount (not `finally`, which would only narrow the race).

**Round 2:** Antigravity APPROVE (didn't catch the next finding). Codex **MAJOR** — a second submit after a failed `updateProfile()` re-ran the display-name precheck and `signUp()` against an already-created account instead of retrying just the profile write. Fixed with an `accountCreated` state gate: subsequent submits skip straight to `updateProfile()` once the account exists.

**Round 3:** both Antigravity and Codex **APPROVE**. Both independently assessed the residual `accountCreated`-resets-on-remount edge case as non-blocking (converging reasoning: the root guard eventually routes any authenticated-but-incomplete-profile session out of the `(auth)` group).

**Side effect:** this review cycle prompted a tightening of the review-handoff standard itself (runtime-boundary/mock-boundary audit now mandatory in `CODEX.md`/`ANTIGRAVITY.md`, self-enforced via `.beads/hooks/pre-commit` → `.claude/hooks/check-review-artifacts.js`). Committed separately as `c2e1e33` (process, not app code).

---

## T5 — Profile Screen + Delete/AuthRequired Modals + Profile Display-Name Fetch (COMPLETE — commit `254af27`)

**Files:** `app/src/app/(tabs)/profile.tsx`, `app/src/app/(components)/{DeleteAccountModal,AuthRequiredModal}.tsx` + tests, `app/src/features/profile/getMyProfile.ts` + test (new, out-of-plan), `app/src/app/_layout.tsx` (QueryClientProvider added, out-of-plan), `app/jest.setup.ts` (TanStack Query test-sync fix).

**Two deviations from the plan's literal 3-file list**, both approved by Antigravity + Codex:
1. `getMyProfile.ts` — new feature module fetching the signed-in user's `display_name` via a direct `public.users` SELECT. Safe under the `users_select_own` RLS policy (`auth.uid() = id`); no table-level REVOKE exists on `users` (unlike `ratings`).
2. `_layout.tsx` gained `QueryClientProvider` — the first use of TanStack Query in the codebase (`profile.tsx`'s Stats section + display-name fetch use `useQuery`), required per `02-CONTEXT.md`'s "TanStack Query lazy elsewhere" decision.

**GSD code review (Claude, standard depth):** 1 Critical + 3 Warning + 3 Info — all fixed via TDD before reviewer handoff (full report: `02-REVIEW.md`):
- CR-01 — `DeleteAccountModal` didn't reset `confirmText`/`error`/`submitting` on reopen (component stays mounted, only `visible` toggles), defeating the T-02-03 fresh-confirmation gate. Fixed with a `useEffect` keyed on `visible`.
- WR-01 — `handleDelete` had no synchronous re-entrancy guard; a plain `submitting` state check wouldn't actually stop two presses dispatched before the first re-render commits (both closures read the same stale value) — fixed with a `useRef`.
- WR-02 / IN-03 — no fallback when `getMyProfile` fails or `display_name` is null; display name row rendered blank forever. Fixed: falls back to `'Profile'`.
- WR-03 — delete-failure error text missing `accessibilityLiveRegion="assertive"`.
- IN-02 — `AuthRequiredModal`'s `isReduceMotionEnabled()` had no `.catch()`/unmount guard (confirmed via an actual unhandled-rejection test failure).

**Round 1:** Antigravity APPROVE (full 10-file scope). Codex REQUEST CHANGES — **MAJOR**: `profileStats`'s `queryKey: ['profileStats']` wasn't scoped by user id, but the `QueryClient` is app-lifetime (module-scope in `_layout.tsx`) — a sign-out/sign-in during the same app runtime could render user A's cached stats for user B. Fixed: `queryKey: ['profileStats', session?.user.id]` (the sibling `getMyProfile` query was already correctly scoped) + a new regression test (`CODEX-01`) sharing one `QueryClient` across two users' render/unmount cycles.

**Round 2:** Antigravity re-review APPROVE (confirmed via repo-wide search: only two `useQuery` call sites exist, both now correctly scoped). Codex re-review REQUEST CHANGES — **MAJOR**: the regression test's `new Promise(() => {})` for user 2's in-flight fetch never resolved, leaving an open async handle (`npm test --runTestsByPath profile.test.tsx` hung past its own reported PASS). Fixed with a captured/settled deferred promise.

**Round 3:** Codex APPROVE. Both reviewers APPROVE — committed `254af27`.

**Debugging note:** the dangling promise from Codex's round-2 finding was also the root cause of several `npm run test:coverage --runInBand` hangs seen mid-session (initially misdiagnosed as environment resource pressure late in a long session) — worth remembering that a hanging aggregate test/coverage run can be a real async-cleanup bug in a *newly added* test, not just infra flakiness.

---

## T6 — Profile-Trigger Provisioning Test (NEXT)

| Task | BD ID | Scope | Blocked By |
|------|-------|-------|------------|
| T6 — Profile-trigger provisioning test | gotta-go-ntn | features/profile/__tests__/profileTrigger.test.ts | none — T5 complete |

Scope (from beads): TDD test asserting that after `signUp()` the `users` row exists with `id`+`email`; no client-side INSERT to `users`; `display_name` initially null (set later by `update_profile`). Closes SC-3.

---

## Test Suite State (as of commit `254af27`)
- **24 suites, 198 tests, 100% coverage** on all `src/features/**`. typecheck clean, lint clean (27 pre-existing unrelated `unicode-bom` warnings).

---

## Migrations Applied (live — project ebmzhjmmtmldhrojkdqw)

| Migration | Name | Status |
|-----------|------|--------|
| 20260627000000 | handle_new_user_trigger | ✓ Applied (02-01a) |
| 20260627000001 | display_name_unique_index | ✓ Applied (02-01a) |
| 20260627000002 | auth_rpcs | ✓ Applied (02-01a) |
| 20260627000003 | nullable_user_fks | ✓ Applied (02-02 T1) |
| 20260627000004 | profile_rpcs | ✓ Applied (02-02 T1) |
| 20260701211135 | profile_stats_rpc | ✓ Applied (02-02 T3) — note: live version differs from any draft filename timestamp; Supabase's `apply_migration` assigns its own |
