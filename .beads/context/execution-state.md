# Execution State
<!-- updated: 2026-07-03T00:00:00.000Z (savepoint) -->

## Current Position
- Active plan: 02-02 (OAuth + Profile + Deletion)
- Last committed work unit: **WU-02-T5** (Profile screen + DeleteAccountModal + AuthRequiredModal + getMyProfile.ts + QueryClientProvider) — COMMITTED `254af27`
- In-progress work unit: **WU-02-T6** (profileTrigger.test.ts) — implementation complete, GSD code review findings fixed, local verification green (25 suites / 200 tests, 100% coverage, 0 typecheck/lint errors). **NOT yet reviewed by Antigravity/Codex, NOT yet committed.** Beads issue `gotta-go-ntn` already claimed.
- Execution method in use for Phase 2 T-work: Metaswarm orchestrated (IMPLEMENT → VALIDATE → ADVERSARIAL REVIEW via Antigravity+Codex → COMMIT) — user-confirmed at the start of T6, re-confirm at the start of each new WU per project convention.
- TDD Guard: **ON**.

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
| WU-02-T5 | gotta-go-g1u | COMPLETE | 254af27 |
| WU-02-T6 | gotta-go-ntn | **IN PROGRESS** (implemented, self-reviewed, uncommitted) | — |

Process/tooling (review-handoff standard + self-enforcing hook, not tied to a WU): COMMITTED `c2e1e33`.

## WU-02-T6 Detail (resume here)

**File:** `app/src/features/profile/__tests__/profileTrigger.test.ts` (test-only addition, no production code changed).

**What it does — 2 tests (a 3rd, tautological mock-only test was removed during review):**
1. Source-scan test: walks all of `app/src` at test time (real `fs`/`path`, not mocking) and asserts no non-test `.ts`/`.tsx` file contains `.from('users').insert(` or `.from('users').upsert(` — provisioning is trigger-only, closes SC-3's "no client-side INSERT" requirement.
2. Reads the actual `handle_new_user` migration SQL from disk and asserts the function body (scoped to that specific named function) only sets `id`+`email`, never `display_name` — locks 02-CONTEXT.md §10.

**GSD code review already run and all findings fixed** (0 Critical, 2 Warning, 3 Info — see `.planning/phases/02-auth-profiles/02-02-SUMMARY.md` T6 section for full detail): removed the tautological test, widened the insert-detection regex to also catch `.upsert(`, scoped the migration function-body match to `handle_new_user` specifically, added clarifying comments on the regex's known blind spots and the hardcoded migration path.

**What's left to resume:**
1. Run `/antigravity-review` (or equivalent — see Antigravity CLI note below) on `app/src/features/profile/__tests__/profileTrigger.test.ts`.
2. Run `/codex-prompt`, human pastes into Codex app, returns verdict.
3. Resolve any findings; re-review if needed.
4. Commit (message should note: test-only WU, 0 production code changes, GSD review found 2 Warning + 3 Info all fixed pre-reviewer-handoff).
5. Update `.claude/review-queue.txt` (currently contains this one file), clear after commit.
6. Close `gotta-go-ntn` in beads.
7. This is the LAST task in Plan 02-02 — once committed, mark `02-02-PLAN.md` complete in ROADMAP.md and move to planning Phase 3 (or whatever's next per ROADMAP.md).

## Carry-Forward Patterns From T3/T4/T5/T6 (apply going forward)

- **Guard-race pattern:** any screen that calls `supabase.auth.signUp`/`signInWith*` (session created as a side effect) and then does further async work before navigating must raise `sessionCtx.setSuppressGuardRedirect(true)` first and only lower it via `useEffect` cleanup on unmount — not in a `finally` block. See `app/src/app/(auth)/sign-up.tsx` for the reference implementation.
- **Retry-after-partial-success pattern:** if a flow has two sequential server calls where the first succeeds and the second can fail independently, track that with explicit state so a retry doesn't repeat the already-succeeded call.
- **Synchronous re-entrancy guard pattern (T5):** a React `state` check alone (`if (submitting) return`) does NOT prevent two synchronous event handlers dispatched before the first state update commits — both closures read the same stale value. Use a `useRef` mutated immediately instead. See `DeleteAccountModal.tsx`'s `submittingRef`.
- **TanStack Query cache-key scoping pattern (T5, Codex MAJOR finding):** any `useQuery` whose data is user-scoped MUST include the user id in its `queryKey` if the `QueryClient` instance is app-lifetime (created once outside component tree, e.g. in `_layout.tsx`) — an unscoped key lets one user's cached data render for the next user who signs in during the same app runtime. Check every new `useQuery` call site against this before review.
- **Async test cleanup (T5, Codex MAJOR finding, round 2):** a test simulating an "in-flight"/pending fetch with `new Promise(() => {})` (never resolves) leaves an open async handle that can hang `npm test`/`npm run test:coverage`, sometimes not until later in a full-suite run — misleadingly looking like environment/resource flakiness rather than a test bug. Always capture the `resolve` function and settle the promise before the test ends (see `profile.test.tsx`'s `CODEX-01` test for the pattern).
- **Codebase-invariant source-scan test pattern (T6):** for contracts that can't be unit-tested through mocks alone (e.g. "no client code ever calls X on table Y"), a jest test can walk `app/src` with real `fs`/`path` at test time and regex-scan file contents — a legitimate "presence check, not exhaustive" test distinct from the project's usual mock-based behavioral tests. Document known blind spots inline (e.g. template-literal/variable table names not caught). See `profileTrigger.test.ts`.
- **Avoid tautological mock-only tests (T6, GSD review finding):** a test that fully controls both sides of a mock (tells it what to return, then asserts it got that back) proves nothing about real application code and can't catch a regression. If a test doesn't import/exercise any actual application module, question whether it's testing anything real.
- **Review packets require, per `docs/agent-harness.md`/`CODEX.md`/`ANTIGRAVITY.md`:** a "Runtime Boundary And Mock Audit" section in both prompt packets and a "Runtime Boundary Check" section in both verdicts. **Self-enforced** via `.beads/hooks/pre-commit` → `node .claude/hooks/check-review-artifacts.js` (presence check only) — this checks whatever is CURRENTLY on disk in `.claude/{antigravity,codex}-{prompt,review}-latest.md` at commit time, so if you send a narrow follow-up re-review prompt without the full original packet, that narrower prompt still needs its own "Runtime Boundary And Mock Audit" heading or the pre-commit hook blocks.
- **Antigravity CLI invocation on this Windows host:** the documented `antigravity -p "$(...)"` PowerShell pattern hits Windows' ~32K command-line length limit for anything beyond a small prompt — pasting full context docs + file contents (as the literal `/antigravity-review` command script does) will fail with "The filename or extension is too long" silently leaving the review artifact stale/unwritten. Since `agy`/`antigravity` is itself an agentic CLI with filesystem read access, prefer a SHORT prompt (a few KB) that names file paths for it to read itself, rather than pasting full file contents inline. Codex (human-paste into a GUI app) has no such constraint. Binary: `C:\Users\mrsai\AppData\Local\agy\bin\agy.exe`; PowerShell's `antigravity` wrapper works but piping through Git Bash (`| head` etc.) can show empty output even on success — re-run without piping before assuming failure.
- **Packets should stay lean:** focused excerpts over full-document dumps; skip `SPEC.md`/`docs/schema-contract.md` entirely for pure client-UI tasks that don't touch PostGIS/GPS/trust/RLS.

## Human Checkpoints For T6 (none currently known)
- [ ] None identified yet.

## Recovery Instructions
1. Read `.beads/plans/active-plan.md` (plan structure) and this file in full.
2. Read `.beads/context/project-context.md` (tooling + patterns + newly-added services).
3. `git status` — confirm `app/src/features/profile/__tests__/profileTrigger.test.ts` is present and uncommitted (it should be; if missing, re-implement per "WU-02-T6 Detail" above).
4. Resume at "What's left to resume" under WU-02-T6 Detail above — go straight to the Antigravity/Codex review gate, execution method already confirmed as Metaswarm orchestrated for this WU.

## Test Suite State (as of last local run, uncommitted — includes T6)
- 25 suites, 200 tests, 100% coverage on all `src/features/**` (screens under `src/app/**` excluded from coverage collection per established convention, still behaviorally tested)
- jest@29.7.0 pinned; 0 typecheck errors; 0 lint errors (27 pre-existing `unicode-bom` warnings, unrelated)
- Last COMMITTED state (`254af27`): 24 suites, 198 tests.
