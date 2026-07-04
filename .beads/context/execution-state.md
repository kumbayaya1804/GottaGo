# Execution State
<!-- updated: 2026-07-04T12:00:00.000Z (savepoint) -->

## Current Position
- Phase 2 (Auth & Profiles): **FULLY CLOSED** — all 3 plans (02-01a, 02-01b, 02-02) implemented, reviewed, committed. Phase-level goal-backward verification PASSED 11/11 success criteria, 0 gaps (`.planning/phases/02-auth-profiles/02-VERIFICATION.md`, commit `d159219`). ROADMAP.md checkbox `[x]`.
- 2026-07-03 full project audit: CLOSED. Zero app-code findings; all bookkeeping/drift findings fixed. Doc: `.planning/project-audit-2026-07-03.md`.
- 2026-07-04 harness integrity audit: CLOSED. 5 defects in the Claude/Antigravity/Codex review-gate machinery fixed, commit `b413be8`, two review rounds (Codex caught a real forward-slash-path bug in the round-1 fix; round 2 both reviewers APPROVE, zero findings).
- **Active plan: none yet.** Phase 3 (Read Path & Map) is in the discussion stage — `03-CONTEXT.md` written (32 decisions, commit `5c3accc`), NOT yet planned.
- Execution method confirmed by user for Phase 3: **Metaswarm orchestrated** (4-phase loop: IMPLEMENT → VALIDATE → ADVERSARIAL REVIEW → COMMIT) — re-confirm at the start of each new WU per project convention.
- TDD Guard: **ON**.
- New workflow rule (2026-07-04): Claude only writes/updates `.claude/antigravity-prompt-latest.md` and `.claude/codex-prompt-latest.md`. User runs both CLIs (`codex exec`, `agy`/`antigravity`) himself in his own terminal tabs and they write their own `-review-latest.md` files. Claude does NOT invoke either CLI going forward.

## Work Unit Status (Phase 1–2, all COMPLETE)
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
| WU-02-T2 | gotta-go-n1j | COMPLETE | fa63838 + dashboard/EAS config verified live |
| WU-02-T3 | gotta-go-3ov | COMPLETE | 10e0f9e |
| WU-02-T4 | gotta-go-wct | COMPLETE | 76c7375 |
| WU-02-T5 | gotta-go-g1u | COMPLETE | 254af27 |
| WU-02-T6 | gotta-go-ntn | COMPLETE | c33bc1a |

Process/tooling commits (not tied to a WU):
| What | Commit |
|------|--------|
| Review-handoff standard tightening (runtime-boundary/mock-boundary audit sections, self-enforcing pre-commit hook) | c2e1e33 |
| Bookkeeping fixes from 2026-07-03 audit (ROADMAP/STATE counters, closed beads issues, backfilled SUMMARYs) | 9986c4e |
| Dead Expo template code deletion + Colors.ts relocation (2026-07-03 audit A1) | bc9a52b |
| Harness integrity fix batch (queue-path normalization, Antigravity invocation repair, roster drift, Stop-hook gating) | b413be8 |
| Phase 2 verification + audit closure | d159219 |
| Phase 3 context (32 decisions, 2 scope gaps → new plan 03-04) | 5c3accc |

## Next Action To Resume
Run `/gsd:plan-phase 3` — Phase 3 has a full `03-CONTEXT.md` ready (32 locked decisions, canonical refs, code context). ROADMAP.md's Phase 3 section already reflects the two discussion-discovered scope additions (Nearby tab + family_mode toggle → plan 03-04). Execution method for Phase 3 is confirmed as Metaswarm orchestrated — do not re-ask, but do re-confirm at the start of each individual WU per standing convention.

## Carry-Forward Patterns (apply going forward)

- **Guard-race pattern:** any screen that calls `supabase.auth.signUp`/`signInWith*` (session created as a side effect) and then does further async work before navigating must raise `sessionCtx.setSuppressGuardRedirect(true)` first and only lower it via `useEffect` cleanup on unmount — not in a `finally` block. See `app/src/app/(auth)/sign-up.tsx` for the reference implementation.
- **Retry-after-partial-success pattern:** if a flow has two sequential server calls where the first succeeds and the second can fail independently, track that with explicit state so a retry doesn't repeat the already-succeeded call.
- **Synchronous re-entrancy guard pattern:** a React `state` check alone (`if (submitting) return`) does NOT prevent two synchronous event handlers dispatched before the first state update commits — both closures read the same stale value. Use a `useRef` mutated immediately instead. See `DeleteAccountModal.tsx`'s `submittingRef`.
- **TanStack Query cache-key scoping pattern:** any `useQuery` whose data is user-scoped MUST include the user id in its `queryKey` if the `QueryClient` instance is app-lifetime (created once outside component tree, e.g. in `_layout.tsx`) — an unscoped key lets one user's cached data render for the next user who signs in during the same app runtime.
- **Async test cleanup:** a test simulating an "in-flight"/pending fetch with `new Promise(() => {})` (never resolves) leaves an open async handle that can hang `npm test`/`npm run test:coverage`. Always capture the `resolve` function and settle the promise before the test ends.
- **Codebase-invariant source-scan test pattern:** for contracts that can't be unit-tested through mocks alone (e.g. "no client code ever calls X on table Y"), a jest test can walk `app/src` with real `fs`/`path` at test time and regex-scan file contents. Document known blind spots inline. See `profileTrigger.test.ts`.
- **Avoid tautological mock-only tests:** a test that fully controls both sides of a mock proves nothing about real application code.
- **Review packets require, per `docs/agent-harness.md`/`CODEX.md`/`ANTIGRAVITY.md`:** a "Runtime Boundary And Mock Audit" section in both prompt packets and a "Runtime Boundary Check" section in both verdicts. **Self-enforced** via `.beads/hooks/pre-commit` → `node .claude/hooks/check-review-artifacts.js`.
- **PostToolUse review-queue hook (fixed 2026-07-04):** now correctly normalizes both backslash- and forward-slash-separated absolute paths to repo-relative forward-slash entries before appending to `.claude/review-queue.txt`, and drops out-of-repo paths. Verified against Codex's exact forward-slash repro. See `.claude/settings.json`.
- **Antigravity CLI invocation on this Windows host:** `antigravity -p "$(...)"` with a full packet inline hits Windows' ~32K command-line limit and fails silently. Fixed pattern (now documented in `.claude/commands/antigravity-review.md`, `AGENTS.md`, `AGENTS_ROSTER.md`): write the full packet to `.claude/antigravity-prompt-latest.md`, invoke with only a short prompt pointing at that file. Binary: `C:\Users\mrsai\AppData\Local\agy\bin\agy.exe`; PowerShell's `antigravity` wrapper works but not reliably piped through Git Bash.
- **Codex CLI:** `codex exec --sandbox read-only "<short prompt pointing at .claude/codex-prompt-latest.md>"` also works non-interactively (confirmed 2026-07-04) — but per the 2026-07-04 workflow-rule change, Claude does not invoke it; the user runs it himself.
- **Packets should stay lean:** focused excerpts over full-document dumps; skip `SPEC.md`/`docs/schema-contract.md` entirely for pure client-UI tasks that don't touch PostGIS/GPS/trust/RLS.
- **Discussion-phase cross-referencing pattern (new, Phase 3 discussion):** systematically cross-referencing a phase's design-doc (Phase 1.5's `01-5-CONTEXT.md`) and `PROJECT.md` requirements against actual ROADMAP.md scheduling surfaces real "designed but never scheduled" gaps — found two for Phase 3 (Nearby tab, family_mode toggle). Worth repeating for future phase discussions.

## Human Checkpoints (none currently known)
- [ ] None identified yet for Phase 3 planning.

## Recovery Instructions
1. Read `.beads/context/project-context.md` (tooling + patterns + completed work).
2. Read `.planning/phases/03-read-path-map/03-CONTEXT.md` in full (32 decisions locked, canonical refs, code context) before planning.
3. Read `.planning/ROADMAP.md`'s Phase 3 section — already updated with the two scope additions (Nearby tab, family_mode toggle → plan 03-04).
4. Run `/gsd:plan-phase 3`. Execution method already confirmed: Metaswarm orchestrated.

## Test Suite State (as of last commit, `bc9a52b`/`b413be8`/`d159219` — no app code changed since)
- 25 suites, 200 tests, 100% coverage on all `src/features/**`
- jest@29.7.0 pinned; 0 typecheck errors; 0 lint errors (27 pre-existing `unicode-bom` warnings, unrelated)
