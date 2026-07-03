# Execution State
<!-- updated: 2026-07-02T00:00:00.000Z (savepoint) -->

## Current Position
- Active plan: 02-02 (OAuth + Profile + Deletion)
- Last completed work unit: **WU-02-T5** (Profile screen + DeleteAccountModal + AuthRequiredModal + getMyProfile.ts + QueryClientProvider) — COMMITTED `254af27`
- Next work unit: **WU-02-T6** (Profile-trigger provisioning test) — see verbatim scope below
- Execution method in use for Phase 2 T-work: Metaswarm orchestrated (IMPLEMENT → VALIDATE → ADVERSARIAL REVIEW via Antigravity+Codex → COMMIT) — user-confirmed choice, re-confirm at the start of each new WU per project convention (don't auto-select).
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
| WU-02-T6 | gotta-go-ntn | **NEXT** | — |

Process/tooling (review-handoff standard + self-enforcing hook, not tied to a WU): COMMITTED `c2e1e33`.

## Carry-Forward Patterns From T3/T4/T5 (apply to T6+)

- **Guard-race pattern:** any screen that calls `supabase.auth.signUp`/`signInWith*` (session created as a side effect) and then does further async work before navigating must raise `sessionCtx.setSuppressGuardRedirect(true)` first and only lower it via `useEffect` cleanup on unmount — not in a `finally` block. See `app/src/app/(auth)/sign-up.tsx` for the reference implementation.
- **Retry-after-partial-success pattern:** if a flow has two sequential server calls where the first succeeds and the second can fail independently, track that with explicit state so a retry doesn't repeat the already-succeeded call.
- **Synchronous re-entrancy guard pattern (new from T5):** a React `state` check alone (`if (submitting) return`) does NOT prevent two synchronous event handlers dispatched before the first state update commits — both closures read the same stale value. Use a `useRef` mutated immediately instead. See `DeleteAccountModal.tsx`'s `submittingRef`.
- **TanStack Query cache-key scoping pattern (new from T5, Codex MAJOR finding):** any `useQuery` whose data is user-scoped MUST include the user id in its `queryKey` if the `QueryClient` instance is app-lifetime (created once outside component tree, e.g. in `_layout.tsx`) — an unscoped key lets one user's cached data render for the next user who signs in during the same app runtime. Check every new `useQuery` call site against this before review.
- **Async test cleanup (new from T5, Codex MAJOR finding, round 2):** a test simulating an "in-flight"/pending fetch with `new Promise(() => {})` (never resolves) leaves an open async handle that can hang `npm test`/`npm run test:coverage`, sometimes not until later in a full-suite run — misleadingly looking like environment/resource flakiness rather than a test bug. Always capture the `resolve` function and settle the promise before the test ends (see `profile.test.tsx`'s `CODEX-01` test for the pattern).
- **Review packets require, per `docs/agent-harness.md`/`CODEX.md`/`ANTIGRAVITY.md`:** a "Runtime Boundary And Mock Audit" section in both prompt packets and a "Runtime Boundary Check" section in both verdicts. **Self-enforced** via `.beads/hooks/pre-commit` → `node .claude/hooks/check-review-artifacts.js` (presence check only) — this checks whatever is CURRENTLY on disk in `.claude/{antigravity,codex}-{prompt,review}-latest.md` at commit time, so if you send a narrow follow-up re-review prompt without the full original packet, that narrower prompt still needs its own "Runtime Boundary And Mock Audit" heading or the pre-commit hook blocks.
- **Antigravity CLI invocation on this Windows host:** the documented `antigravity -p "$(...)"` PowerShell pattern hits Windows' ~32K command-line length limit for anything beyond a small prompt — pasting full context docs + file contents (as the literal `/antigravity-review` command script does) will fail with "The filename or extension is too long" silently leaving the review artifact stale/unwritten. Since `agy`/`antigravity` is itself an agentic CLI with filesystem read access, prefer a SHORT prompt (a few KB) that names file paths for it to read itself, rather than pasting full file contents inline. Codex (human-paste into a GUI app) has no such constraint — the documented full-packet approach is fine there.
- **Packets should stay lean:** focused excerpts over full-document dumps; skip `SPEC.md`/`docs/schema-contract.md` entirely for pure client-UI tasks that don't touch PostGIS/GPS/trust/RLS.

## Next Task — WU-02-T6 Verbatim Spec (from `.planning/phases/02-auth-profiles/02-02-PLAN.md` Task 6)

**Files:** `app/src/features/profile/__tests__/profileTrigger.test.ts`

**Read first:** `.planning/phases/02-auth-profiles/02-CONTEXT.md` (§10 handle_new_user body; §7 existing assets); `.planning/phases/02-auth-profiles/02-RESEARCH.md` (§Pitfall 4 trigger/INSERT policy; §Validation Architecture); `app/src/lib/__tests__/supabase.test.ts` (mock structure); `supabase/migrations/20260627000000_handle_new_user_trigger.sql` (from 02-01).

**Behavior to assert:**
- The signup path leads to a `public.users` row keyed by the new auth user id with `email` populated and `display_name` initially unset by the trigger (set later by `update_profile`).
- The client never performs a direct `INSERT` into `users` (provisioning is trigger-only; no INSERT RLS policy).

**Action:** Add a covered TDD test that mocks `supabase.auth.signUp` + a `users` select and asserts the provisioning contract: after `signUp` the `users` row exists with `id`+`email` and no client-side INSERT was issued (the only write to `users` is via the SECURITY DEFINER trigger / `update_profile` RPC). This closes ROADMAP SC-3 ("User row is auto-created on signup, trigger confirmed"). If a live integration check is preferred over a mocked unit test, additionally use Supabase MCP to confirm the trigger fired for a throwaway test account and record the result in the SUMMARY (clean up the test account afterward).

**Acceptance criteria:**
- `cd app && npm test -- features/profile/profileTrigger.test.ts` exits 0.
- The test asserts NO direct `from('users').insert(` is called by the client signup path.
- SUMMARY records the trigger-confirmation evidence (mocked assertion and/or live MCP check output) satisfying SC-3.

## Human Checkpoints For T6 (none currently known)
- [ ] None identified yet — re-assess during discuss/plan if scope requires live Supabase trigger inspection beyond what's already documented in `docs/schema-contract.md`.

## Recovery Instructions
1. Read `.beads/plans/active-plan.md` (plan structure) and this file in full.
2. Read `.beads/context/project-context.md` (tooling + patterns + newly-added services).
3. Ask the user to confirm execution method for WU-02-T6 (Metaswarm orchestrated / Superpowers subagent-driven / parallel session) — do not assume continuation from T5.
4. Start WU-02-T6 per the scope above (may need a short discuss/plan pass first since no verbatim Task 6 spec has been located yet in `02-02-PLAN.md`).

## Test Suite State (as of last commit, `254af27`)
- 24 suites, 198 tests, 100% coverage on all `src/features/**` (screens under `src/app/**` excluded from coverage collection per established convention, still behaviorally tested)
- jest@29.7.0 pinned; 0 typecheck errors; 0 lint errors (27 pre-existing `unicode-bom` warnings, unrelated)
