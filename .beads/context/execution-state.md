# Execution State
<!-- updated: 2026-07-02T00:00:00.000Z (savepoint) -->

## Current Position
- Active plan: 02-02 (OAuth + Profile + Deletion)
- Last completed work unit: **WU-02-T4** (OAuth UI + deep-link callback + sign-up profile wiring) — COMMITTED `76c7375`
- Next work unit: **WU-02-T5** (Profile screen + DeleteAccountModal + AuthRequiredModal) — see verbatim spec below
- Execution method in use for Phase 2 T-work: Metaswarm orchestrated (IMPLEMENT → VALIDATE → ADVERSARIAL REVIEW via Antigravity+Codex → COMMIT) — user-confirmed choice, re-confirm at the start of each new WU per project convention (don't auto-select).
- TDD Guard: **ON** (re-enabled via literal chat message `tdd-guard on` after WU-02-T3 committed; was OFF only for that one WU).

## Work Unit Status
| WU | BD ID | Status | Commit |
|----|-------|--------|--------|
| WU-01a-T1 | gotta-go-xpr.1 | COMPLETE | — |
| WU-01a-T2 | gotta-go-xpr.2 | COMPLETE | 15a8dc4 |
| WU-01a-T3 | gotta-go-xpr.3 | COMPLETE | 502105c |
| WU-01a-T4 | gotta-go-xpr.4 | COMPLETE | 6c60a1d |
| infra | — | COMPLETE | fedc053 |
| WU-01b-T5 | gotta-go-xpr.5 | COMPLETE | 97ec0e1 |
| WU-01b-T6 | gotta-go-xpr.6 | COMPLETE | c37d1e2 |
| WU-01b-T7 | gotta-go-xpr.7 | COMPLETE | ea07fca |
| WU-02-T1 | gotta-go-x88 | COMPLETE | ac66fc4 |
| WU-02-T2 | gotta-go-n1j | COMPLETE | fa63838 + dashboard/EAS config verified live 2026-07-01 (no code commit for dashboard side) |
| WU-02-T3 | gotta-go-3ov | COMPLETE | 10e0f9e |
| WU-02-T4 | gotta-go-wct | COMPLETE | 76c7375 |
| WU-02-T5 | gotta-go-g1u | **NEXT** | — |
| WU-02-T6 | gotta-go-ntn | PENDING (depends on T5) | — |

Process/tooling (review-handoff standard + self-enforcing hook, not tied to a WU): COMMITTED `c2e1e33`.

## Carry-Forward Patterns From T3/T4 (apply to T5+)

- **Guard-race pattern:** any screen that calls `supabase.auth.signUp`/`signInWith*` (session created as a side effect) and then does further async work before navigating must raise `sessionCtx.setSuppressGuardRedirect(true)` first and only lower it via `useEffect` cleanup on unmount — not in a `finally` block (that only narrows the race, doesn't close it). See `app/src/app/(auth)/sign-up.tsx` for the reference implementation. T5's `DeleteAccountModal` calls `deleteAccount()` which triggers `SIGNED_OUT`, not a new session — this specific pattern likely doesn't apply there, but re-derive from first principles rather than assuming.
- **Retry-after-partial-success pattern:** if a flow has two sequential server calls where the first succeeds and the second can fail independently, track that with explicit state (e.g. `accountCreated`) so a retry doesn't repeat the already-succeeded call. Relevant if T5/T6 introduce any multi-step server flow.
- **Review packets now require, per `docs/agent-harness.md`/`CODEX.md`/`ANTIGRAVITY.md` (updated 2026-07-02):** a "Dependency Call Chains" section (nearest callers/callees/providers/guards/RPCs) and a "Runtime Boundary And Mock Audit" section (which tests mock which boundaries, explicit ask about production-vs-test divergence). Reviewer verdicts must include a "Runtime Boundary Check" section. **This is now self-enforced**: `.beads/hooks/pre-commit` → `node .claude/hooks/check-review-artifacts.js` blocks any commit that stages a file in `.claude/review-queue.txt` unless both prompt packets and both verdicts contain the required section headings. Presence check only, not a quality check. Verified end-to-end (no-op, block, and pass paths all confirmed against real commits this session).
- **Packets should stay lean:** focused excerpts over full-document dumps; skip `SPEC.md`/`docs/schema-contract.md` entirely for pure client-UI tasks that don't touch PostGIS/GPS/trust/RLS (note in the packet why they're not relevant rather than pasting them).

## Next Task — WU-02-T5 Verbatim Spec (from `.planning/phases/02-auth-profiles/02-02-PLAN.md` Task 5)

**Files:** `app/src/app/(tabs)/profile.tsx`, `app/src/app/(components)/DeleteAccountModal.tsx`, `app/src/app/(components)/AuthRequiredModal.tsx`, and colocated tests.

**Read first:** `.planning/phases/02-auth-profiles/02-UI-SPEC.md` (Screen 5 Profile signed-in, Screen 6 unauthenticated, Screen 7 Auth-Required modal, Screen 9 Settings stub; Delete confirmation modal; Copywriting Contract; §20 Component Acceptance Checklist); `.planning/phases/02-auth-profiles/02-CONTEXT.md` (§6 deletion UX, §4 sign-out); current `app/src/app/(tabs)/profile.tsx` stub; `app/src/features/profile/deleteAccount.ts`, `profileStats.ts`; `app/src/features/auth/SessionProvider.tsx` (signOut); `app/src/constants/legal.ts` (LEGAL_URLS).

**Action:**
- `profile.tsx`: render conditionally on `useSession`. Signed-in shows avatar placeholder, `display_name`, masked email, a Stats section lazily loaded via `profileStats` (TanStack Query; skeleton while loading, "—" on error), and a Settings section with rows: Account (stub "Coming soon"), Privacy Policy → `Linking.openURL(LEGAL_URLS.privacyPolicy)`, Terms of Service → `Linking.openURL(LEGAL_URLS.termsOfService)`, Delete Account → opens `DeleteAccountModal`, Sign Out → `SessionProvider.signOut()` (→ `SIGNED_OUT` → Welcome), and a Location Permissions row with an "Open Settings" button → `Linking.openSettings()`. Unauthenticated shows "Sign in to contribute" CTA (Primary "Sign In" + Secondary "Create Account") + muted stats preview — **no `router.replace` redirect** (public route per Pattern 2, matches `redirect.ts`'s `isProtected` excluding `(tabs)/profile`).
- `DeleteAccountModal.tsx`: title "Delete Account", verbatim body copy, "Type DELETE to confirm" input, Destructive "Delete Account" button **disabled until input equals exactly "DELETE"** (case-sensitive, T-02-03), calls `deleteAccount()`; on failure show "Couldn't delete your account. Check your connection and try again."; swipe-to-dismiss forbidden, explicit Cancel only.
- `AuthRequiredModal.tsx`: ERR-10 inline slide-up (NOT a navigation redirect) with action-specific heading "Sign in to [verify/rate/report/submit/see access code]", Primary "Sign In" + Secondary "Create Account" + Ghost "Cancel"; reduced-motion instant appear.
- Tokens only (no raw hex); touch targets ≥44pt, Primary ≥56pt.

**Acceptance criteria:**
- `cd app && npm test -- app/(tabs)/profile (components)/DeleteAccountModal (components)/AuthRequiredModal` exits 0 (use `--runTestsByPath` for the parenthesized paths per `docs/verification.md`).
- `DeleteAccountModal` test asserts the Destructive button is disabled for empty input, "delete", and "Delete" — only exact "DELETE" enables it; tapping the enabled button calls `deleteAccount`.
- `grep -n 'openSettings'`, `grep -n 'LEGAL_URLS'`, `grep -n 'signOut'` in `profile.tsx` all match.
- `grep -n "Couldn.t delete your account"` in `DeleteAccountModal.tsx` matches; `grep -n 'router.replace'` in `AuthRequiredModal.tsx` returns nothing (it's a modal, not a redirect).
- `grep -rn '#[0-9A-Fa-f]{6}'` across all three new files (excluding comments) returns nothing.

## Human Checkpoints For T5 (none currently known)
- [ ] None identified yet — T5 is pure client UI + already-approved RPC calls (`deleteAccount`, `profileStats`), no new external service/credential dependency expected. Re-assess if scope changes during discuss/plan.

## Recovery Instructions
1. Read `.beads/plans/active-plan.md` (plan structure) and this file in full.
2. Read `.beads/context/project-context.md` (tooling + patterns + newly-added services).
3. Ask the user to confirm execution method for WU-02-T5 (Metaswarm orchestrated / Superpowers subagent-driven / parallel session) — do not assume continuation from T4.
4. Start WU-02-T5 per the verbatim spec above.

## Test Suite State (as of last commit, `76c7375`)
- 20 suites, 153 tests, 100% coverage on all `src/features/**` (screens under `src/app/**` excluded from coverage collection per established convention, still behaviorally tested)
- jest@29.7.0 pinned; 0 typecheck errors; 0 lint errors (27 pre-existing `unicode-bom` warnings, unrelated)
