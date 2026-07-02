# Execution State
<!-- updated: 2026-07-02 (session 2, WU-02-T4 round 3) -->

## Current Position
- Active plan: 02-02 (OAuth + Profile + Deletion)
- Active work unit: WU-02-T4 — round 1: Antigravity APPROVE, Codex BLOCKER (guard race, fixed). Round 2: Antigravity APPROVE, Codex MAJOR (retry-after-partial-signup bug, fixed). Round-3 packets ready (narrow, sign-up.tsx only), waiting on fresh verdicts.
- Execution method: Metaswarm orchestrated (IMPLEMENT → VALIDATE → ADVERSARIAL REVIEW via Antigravity+Codex → COMMIT), user-confirmed choice for T4.
- Self-enforcing gate live: `.beads/hooks/pre-commit` → `check-review-artifacts.js` blocks commits of review-queue files if packets/verdicts lack the "Runtime Boundary And Mock Audit"/"Runtime Boundary Check" sections. Verified end-to-end (both no-op and block paths).

## WU-02-T4 — Round 2 → Round 3 (retry bug)

Codex round 2 found a MAJOR: after `signUp()` succeeds and `updateProfile()` then fails, a second submit re-ran `checkDisplayNameAvailable` + `signUp()` on an already-created account instead of retrying just the profile write — would hit an "already registered"-style error and strand the user. Antigravity round 2 APPROVE did not catch this (noted explicitly in the round-3 packet as a real miss, not a contradiction).

**Fix (TDD):** added `accountCreated` state to `sign-up.tsx`; `onSubmit` now skips Steps 1-2 (pre-check + `signUp`) when `accountCreated` is already true, going straight to Step 3 (`updateProfile`) with the current form's display name. 2 new tests proving `signUp`/`checkDisplayNameAvailable` call counts stay at 1 across a failed-then-retried submit. Full DoD re-passed: 153 tests, 100% coverage, 0 errors.

**Round-3 packets** are narrow (only `sign-up.tsx` + its test changed; other 8 files unchanged since round 2, included for re-confirmation only). Both packets explicitly surface a residual edge case for reviewer judgment: `accountCreated` resets on remount, so a contrived re-entry to `/sign-up` while still holding an incomplete-profile session could re-attempt `signUp()` — flagged as likely acceptable given the guard/redirect logic makes that path hard to reach, but asked for explicit sign-off rather than deciding unilaterally.

## WU-02-T4 — Round 1 Result

**Files (original scope):**
- `app/src/app/(auth)/sign-in.tsx` + test — Google button (Android)/Apple stub (iOS) gating, `authError` search-param handling
- `app/src/app/auth/callback.tsx` (NEW) + test — deep-link target, explicit navigation on success/failure
- `app/src/app/(auth)/sign-up.tsx` + test — `updateProfile(displayName)` call after `signUp`, taken-name error mapping

**Antigravity round 1: APPROVE** — confirmed all 3 flagged design decisions (callback.tsx explicit nav; direct exchangeCodeForSession in sign-in.tsx; why OAuth never reaches callback.tsx).

**Codex round 1: REQUEST CHANGES — 1 BLOCKER.** Caught a real race: `sign-up.tsx` creates a session immediately via `signUp()` (email confirmation disabled), and while awaiting `updateProfile(displayName)`, the root guard (`_layout.tsx`/`redirect.ts`) could independently redirect an authenticated `(auth)`-group screen to `/(tabs)` — skipping `/gps-consent` and hiding the display-name-taken error, potentially leaving `display_name = null` with no visible recovery path. Screen-only tests didn't mount the guard so they missed it.

## WU-02-T4 — BLOCKER Fix (round 2, scope expanded)

Added `suppressGuardRedirect`/`setSuppressGuardRedirect` to `SessionContextValue` (`SessionProvider.tsx`); the guard's redirect effect (`_layout.tsx`) now skips when set. `sign-up.tsx` raises the flag before `signUp()` and lowers it **only via `useEffect` cleanup on unmount** (not on every branch return) — so a failed `updateProfile` keeps the guard suppressed while the error is visible; only navigating away (real or in a future retry) clears it. Alternative (`finally`-block clearing) was considered and rejected — it would only narrow the race, not close it.

**New files added to scope:** `SessionProvider.tsx` + test, `_layout.tsx` + test (both already-committed/approved from WU-01b-T5/T6 — expansion justified by needing a guard-level fix, not just a screen-level one). Confirmed via `grep -rn "useSession()" app/src` that only `_layout.tsx` and `sign-up.tsx` consume the context, so no other screen is affected by the additive fields.

**Side discovery:** Antigravity, during round 1, autonomously updated its own command scripts (`.claude/commands/antigravity-review.md`, `.claude/commands/codex-prompt.md`) and `AGENTS.md` to add git-diff + dependency-call-chain context to future review packets, in direct response to the class of bug it helped catch. Not something I did — flagged to the user, and the round-2 packets follow that updated structure (Verification Context / Dependency Call Chains sections).

**DoD passed (round 2):** typecheck 0 errors, 20 suites / 151 tests, 100% coverage on `src/features/**`, lint 0 errors. File scope confirmed via `git status --short` (10 files in review-queue.txt).

**Next:** get fresh Antigravity + Codex verdicts on round-2 packets (`.claude/antigravity-prompt-latest.md` / `.claude/codex-prompt-latest.md`), commit (referencing both rounds), close beads `gotta-go-wct`, proceed to WU-02-T5. Also decide whether to commit the Antigravity-authored doc/command updates alongside T4's commit or separately — currently sitting as uncommitted changes too.

## Process Update (human, via Codex direct edits, 2026-07-02)

User made a second, independent round of process edits (via Codex working directly on the repo, not through me) tightening the review-handoff standard further: `CODEX.md`/`ANTIGRAVITY.md` now require a call-path pass + mock-boundary check before approving; `docs/agent-harness.md` now requires every reviewer packet to include runtime-boundary + mock-boundary context; `.claude/commands/codex-prompt.md`/`antigravity-review.md` now specify a **leaner** packet structure (focused excerpts, not full-document dumps, plus new "Dependency Call Chains" and "Runtime Boundary And Mock Audit" sections); `.claude/skills/review_packet_generator.md` and `docs/verification.md` updated to match (verification.md now specifies `npm.cmd`/`--runTestsByPath` for Windows PowerShell + explicit call-path/mock-boundary verification expectations).

Per the user's explicit request, both round-2 packets were rebuilt from scratch against the new template: trimmed `SPEC.md`/`schema-contract.md`/full `AGENTS_ROSTER.md`/`AGENTS.md`/`agent-harness.md` dumps down to relevant excerpts (~404 lines of doc context vs. ~1288 previously), added explicit "Dependency Call Chains" (`useSession.ts`, `redirect.ts`) and "Runtime Boundary And Mock Audit" sections. The mock-boundary audit **self-identifies a real gap**: no test in the queue mounts the real `SessionProvider` wrapping the real `GuardComponent` end-to-end — each of the three links (screen/context/guard) is proven correct only in isolation. This is flagged explicitly for both reviewers to assess rather than silently glossed over. Final packet sizes: Antigravity 2240 lines, Codex 2563 lines (dominated by the 10 full review files, not doc-bloat).

## WU-02-T3 — Resolution Summary

**Files:**
- `app/src/features/auth/oauth.ts` + `__tests__/oauth.test.ts`
- `app/src/features/profile/{updateProfile,deleteAccount,profileStats}.ts` + tests
- `supabase/migrations/20260701211135_profile_stats_rpc.sql` (live)
- `app/src/lib/database.types.ts` (regenerated)

**Round 1** (both reviewers REQUEST CHANGES):
1. [CRITICAL/MAJOR] `profileStats.ts` queried `ratings` directly — blocked by the privacy revoke in `20260624000002_ratings_privacy_fix.sql`. Fixed with `get_profile_stats()` SECURITY DEFINER RPC (`auth.uid()`-scoped, no caller-supplied id).
2. [MINOR, Antigravity] `oauth.ts` unsafe `data.url` access — fixed with an explicit guard.
3. [MINOR, informational] iOS Guideline 4.8 gating is T4's responsibility (`sign-in.tsx`), not T3's — carried forward, no T3 action.

**Between round 1 and round 2:** user directly confirmed applying the migration; applied live via Supabase MCP `apply_migration` (project `ebmzhjmmtmldhrojkdqw`); `database.types.ts` regenerated; full DoD re-passed (0 typecheck errors, 130/130 tests, 100% coverage, 0 lint errors); `get_advisors` showed only the expected/accepted SECURITY DEFINER warning.

**Round 2:** Antigravity APPROVE. Codex REQUEST CHANGES — [MAJOR] Supabase's `apply_migration` tool assigns its own timestamp version on apply, ignoring the local filename's version. Migration went live as `20260701211135_profile_stats_rpc`, not the drafted `20260627000005`. Fixed by renaming the local file to match (content unchanged).

**Round 3:** Both Antigravity and Codex returned **APPROVE**. iOS 4.8 note carried forward to T4 as the only open item.

**Commit is proceeding now** with both reviewer verdicts referenced in the message, per `docs/agent-harness.md` Minimum Commit Gate.

## Work Unit Status
| WU | BD ID | Status | Phase | Commit |
|----|-------|--------|-------|--------|
| WU-01a-T1 | gotta-go-xpr.1 | COMPLETE | COMMITTED | — |
| WU-01a-T2 | gotta-go-xpr.2 | COMPLETE | COMMITTED | 15a8dc4 |
| WU-01a-T3 | gotta-go-xpr.3 | COMPLETE | COMMITTED | 502105c |
| WU-01a-T4 | gotta-go-xpr.4 | COMPLETE | COMMITTED | 6c60a1d |
| infra | — | COMPLETE | COMMITTED | fedc053 |
| WU-01b-T5 | gotta-go-xpr.5 | COMPLETE | COMMITTED | 97ec0e1 |
| WU-01b-T6 | gotta-go-xpr.6 | COMPLETE | COMMITTED | c37d1e2 |
| WU-01b-T7 | gotta-go-xpr.7 | COMPLETE | COMMITTED | ea07fca |
| WU-02-T1 | gotta-go-x88 | COMPLETE | COMMITTED | ac66fc4 |
| WU-02-T2 | gotta-go-n1j | COMPLETE | COMMITTED | fa63838 + dashboard/EAS config verified live 2026-07-01 |
| WU-02-T3 | gotta-go-3ov | COMPLETE | COMMITTING | see commit below |
| WU-02-T4 | gotta-go-wct | NEXT | — | — |
| WU-02-T5 | gotta-go-g1u | PENDING | — | — |
| WU-02-T6 | gotta-go-ntn | PENDING | — | — |

## Recovery Instructions
1. Read `.beads/plans/active-plan.md` (plan structure) and this file in full.
2. Read `.beads/context/project-context.md` (tooling + patterns + newly-added services).
3. Start WU-02-T4 (OAuth UI + callback + sign-up wiring): `sign-in.tsx`, `auth/callback.tsx`, `sign-up.tsx`. T4 must address the Guideline 4.8 platform-gating note carried forward from T3 (gate `signInWithGoogle` behind `Platform.OS === 'android'` on `sign-in.tsx`; iOS shows the disabled Apple Sign-In stub only).

## Test Suite State (as of commit)
- 19 suites, 130 tests, 100% coverage on all touched files
- jest@29.7.0 pinned; TDD Guard was disabled for WU-02-T3 only — **re-enabled with the exact chat message `tdd-guard on` immediately after this commit.**
