# Execution State
<!-- updated: 2026-07-05T21:37:01.000Z (savepoint) -->

## Current Position
- Phase 2 (Auth & Profiles): **FULLY CLOSED** — all 3 plans (02-01a, 02-01b, 02-02) implemented, reviewed, committed. Phase-level goal-backward verification PASSED 11/11 success criteria, 0 gaps (`.planning/phases/02-auth-profiles/02-VERIFICATION.md`, commit `d159219`). ROADMAP.md checkbox `[x]`.
- 2026-07-03 full project audit: CLOSED. Zero app-code findings; all bookkeeping/drift findings fixed. Doc: `.planning/project-audit-2026-07-03.md`.
- 2026-07-04 harness integrity audit: CLOSED. 5 defects in the Claude/Antigravity/Codex review-gate machinery fixed, commit `b413be8`, two review rounds.
- **Phase 3 (Read Path & Map): PLANNED & VERIFIED, not yet executed.** 5 plans (03-01..03-05, 4 waves) written, checker-verified, committed. See "Phase 3 Planning Summary" below.
- 2026-07-05 CLAUDE.md/AGENTS.md/docs restructuring: a separate session ran a "surgical pass" making the local instruction-file layer lean/route-first (`CLAUDE.md` → `AGENTS.md` → `docs/context-router.md`), hardened `.claude/hooks/check-review-artifacts.js` (now requires prompt manifests + APPROVE verdicts + current staged queued filenames, not just headings), and hardened Beads startup (`.claude/settings.json` falls back to `.beads/context/execution-state.md` + `.planning/STATE.md` when `bd` is unavailable). **Session startup order is now:** read `AGENTS.md` → `docs/context-router.md` → `.planning/STATE.md` → this file (if recovering after compaction/new terminal). Do not read the full roster/product-spec/schema-contract/roadmap/stale-scan/Codex/Antigravity docs unless `docs/context-router.md` says the current task needs them.
- Execution method confirmed by user for Phase 3: **Metaswarm orchestrated** (4-phase loop: IMPLEMENT → VALIDATE → ADVERSARIAL REVIEW → COMMIT) — re-confirm at the start of each new WU per project convention.
- TDD Guard: **ON**.
- Reviewer workflow (2026-07-04, still current): Claude only writes/updates `.claude/antigravity-prompt-latest.md` and `.claude/codex-prompt-latest.md`. User runs both CLIs (`codex exec`, `agy`/`antigravity`) himself and they write their own `-review-latest.md` files. Claude does NOT invoke either CLI.

## Phase 3 Planning Summary (2026-07-05)

| Step | Result |
|------|--------|
| UI-SPEC (`/gsd:ui-phase 3`) | Checker BLOCKed on Typography (5 sizes/3 weights) + Spacing (12px/20px non-standard) — both structural facts of the already-shipped Phase 1.5 token system, not Phase 3 authoring gaps. User approved as a documented standing exception: **D-33** in `03-CONTEXT.md`. UI-SPEC frontmatter `status: approved`, commit `76fd09d`. |
| Research (`/gsd:plan-phase 3`) | `03-RESEARCH.md` commit `bde615b`. Resolved the ARCHITECTURE.md-vs-UI-SPEC clustering discrepancy: **native `@rnmapbox/maps` `ShapeSource cluster:true`**, NOT the `supercluster` JS library (both take raw points from the server; ARCHITECTURE.md's "server returns raw points" principle holds either way). Caught 3 live-schema corrections to ARCHITECTURE.md: `suppressed_at` doesn't exist yet (03-01 must add it), `confidence_score`/`confidence_tier` are TEXT tiers (not numeric — can't `ORDER BY confidence_score DESC`), column is `shadowban_status` not `is_shadowbanned`, no `status` column (publish state is flag-based). |
| Validation strategy | `03-VALIDATION.md` — jest/MSW unit coverage for feature hooks, pgTAP integration tests for RLS/RPC moderation + family_mode. Commit `d6a718f`, later updated to `nyquist_compliant: true`/`wave_0_complete: true` in the revision pass. |
| Pattern mapping | `03-PATTERNS.md` — 18 files classified, 15/18 with an analog. Key: all new RPCs mirror `get_locations_in_radius` (20260624000002) for the null-include filter convention + tag-join vocab; family_mode reads `auth.uid()` like `get_profile_stats`; `useFiltersStore.ts` is the project's first Zustand store (no analog). |
| Planning | 5 plans (not the drafted 4) — planner split off 03-02 as a dedicated client-data-layer/TDD plan ahead of screens, and split 03-05 (filters/empty-states) from 03-03 (MapScreen) since both touch `index.tsx`. Commit `babec2e`. |
| Plan check round 1 | **1 BLOCKER + 5 WARNINGS.** Blocker: LocationDetail's "distance" field had no wired data source — `get_location_detail` took no user coords / returned no `distance_m`, but 03-03 assumed `useLocationDetail` alone produced `distanceM`; its own test would have passed by mocking a value production code couldn't generate. |
| Revision (2 agent runs — first hit a session-limit mid-task after only 03-01/03-02, continuation finished 03-03/03-04/03-05/RESEARCH/VALIDATION) | Fixed by extending `get_location_detail(location_id uuid, user_lat numeric default null, user_lng numeric default null)` to return a server-computed `distance_m` (same `ST_Distance` expression as `search_locations_nearby`), threaded through `useLocationDetail(id, userLat?, userLng?)` (03-02), MapScreen's pin-tap path (03-03), and Nearby's row-tap path (03-04) — **the client never fabricates or reuses a locally-known distance; the shared `LocationDetailSheet` always re-fetches its own via the RPC.** All 5 warnings also resolved (RESEARCH OQ-2/3/4 marked RESOLVED, 03-04 got the missing key_link, 03-05 got a `gpsConsent.ts` pattern reference, VALIDATION.md frontmatter corrected). |
| Plan check round 2 | **VERIFICATION PASSED.** No blockers; one pre-existing non-blocking note (03-02 at 16 `files_modified`, driven by 1:1 test-pairing under the TDD gate, not scope creep). |
| Final commit | `872b26b` — all 5 revised plans + RESEARCH.md + VALIDATION.md + PATTERNS.md + ROADMAP.md wave annotations + STATE.md. |

**Next action: `/gsd:execute-phase 3`** (Wave 1 = plan 03-01 only — DB read path, includes a `[BLOCKING] supabase db push` task).

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
| Phase 3 UI-SPEC approved with documented exception D-33 | 76fd09d |
| Phase 3 validation strategy | d6a718f |
| Phase 3 research (clustering discrepancy resolved, 3 schema corrections) | bde615b |
| Phase 3 plans created (5 plans, 4 waves) | babec2e |
| Phase 3 plans revised + re-verified (LocationDetail distance-wiring fix) | 872b26b |

## Next Action To Resume
Run `/gsd:execute-phase 3`. Plans are written, checker-verified (VERIFICATION PASSED), and committed. Wave 1 = plan `03-01` only (DB read path: 3 RPCs, `suppressed_at` migration, `max_pins` config, `update_profile` family_mode extension, dev seed, **[BLOCKING] `supabase db push`**, regenerated types, pgTAP). Execution method for Phase 3 is confirmed as Metaswarm orchestrated — do not re-ask, but do re-confirm at the start of each individual WU per standing convention.

## Carry-Forward Patterns (apply going forward)

- **Server-authoritative derived-data pattern (new, Phase 3 plan-checker finding, 2026-07-05):** any UI value that looks like it could be computed client-side from data already on screen (e.g. "distance" when a Nearby row already displays it) must still come from the SAME server-side computation as everywhere else that value appears, not be passed through as a prop or re-derived locally — a plan that assumes a shared component's hook alone produces a value with no wired data source will pass its own test by mocking exactly the value that production code can't generate. Trace every "must_haves.truths" content item back to an actual RPC/hook that produces it before treating a plan as complete. See 03-01/03-02/03-03/03-04's `get_location_detail(location_id, user_lat, user_lng) → distance_m` fix.
- **Guard-race pattern:** any screen that calls `supabase.auth.signUp`/`signInWith*` (session created as a side effect) and then does further async work before navigating must raise `sessionCtx.setSuppressGuardRedirect(true)` first and only lower it via `useEffect` cleanup on unmount — not in a `finally` block. See `app/src/app/(auth)/sign-up.tsx` for the reference implementation.
- **Retry-after-partial-success pattern:** if a flow has two sequential server calls where the first succeeds and the second can fail independently, track that with explicit state so a retry doesn't repeat the already-succeeded call.
- **Synchronous re-entrancy guard pattern:** a React `state` check alone (`if (submitting) return`) does NOT prevent two synchronous event handlers dispatched before the first state update commits — both closures read the same stale value. Use a `useRef` mutated immediately instead. See `DeleteAccountModal.tsx`'s `submittingRef`.
- **TanStack Query cache-key scoping pattern:** any `useQuery` whose data is user-scoped MUST include the user id in its `queryKey` if the `QueryClient` instance is app-lifetime (created once outside component tree, e.g. in `_layout.tsx`) — an unscoped key lets one user's cached data render for the next user who signs in during the same app runtime.
- **Async test cleanup:** a test simulating an "in-flight"/pending fetch with `new Promise(() => {})` (never resolves) leaves an open async handle that can hang `npm test`/`npm run test:coverage`. Always capture the `resolve` function and settle the promise before the test ends.
- **Codebase-invariant source-scan test pattern:** for contracts that can't be unit-tested through mocks alone (e.g. "no client code ever calls X on table Y"), a jest test can walk `app/src` with real `fs`/`path` at test time and regex-scan file contents. Document known blind spots inline. See `profileTrigger.test.ts`.
- **Avoid tautological mock-only tests:** a test that fully controls both sides of a mock proves nothing about real application code.
- **Review packets require, per `docs/agent-harness.md`/`CODEX.md`/`ANTIGRAVITY.md`:** a "Runtime Boundary And Mock Audit" section in both prompt packets and a "Runtime Boundary Check" section in both verdicts. **Self-enforced** via `.beads/hooks/pre-commit` → `node .claude/hooks/check-review-artifacts.js` (hardened 2026-07-05 to require prompt manifests + APPROVE verdicts + current staged queued filenames, not just section headings).
- **PostToolUse review-queue hook (fixed 2026-07-04):** now correctly normalizes both backslash- and forward-slash-separated absolute paths to repo-relative forward-slash entries before appending to `.claude/review-queue.txt`, and drops out-of-repo paths.
- **Antigravity CLI invocation on this Windows host:** write the full packet to `.claude/antigravity-prompt-latest.md`, invoke with only a short prompt pointing at that file. Binary: `C:\Users\mrsai\AppData\Local\agy\bin\agy.exe`.
- **Codex CLI:** `codex exec --sandbox read-only "<short prompt pointing at .claude/codex-prompt-latest.md>"` — per the 2026-07-04 workflow-rule change, Claude does not invoke it; the user runs it himself.
- **Packets should stay lean:** focused excerpts over full-document dumps; skip `SPEC.md`/`docs/schema-contract.md` entirely for pure client-UI tasks that don't touch PostGIS/GPS/trust/RLS.
- **Discussion-phase cross-referencing pattern:** systematically cross-referencing a phase's design-doc against actual ROADMAP.md scheduling surfaces real "designed but never scheduled" gaps — found two for Phase 3 (Nearby tab, family_mode toggle).
- **Bounded, mechanical UI-checker thresholds vs. established design systems:** `gsd-ui-checker`'s Typography (max 4 sizes/2 weights) and Spacing (standard {4,8,16,24,32,48,64} set) dimensions are pure numeric checks with no built-in exception path — if a project's shipped design system already exceeds them, re-running the checker after "fixing" it will BLOCK again with the same numbers. The correct move is a documented, user-approved exception recorded in the phase's CONTEXT.md (not a revision-loop grind), since token counts are structural facts, not something a revision pass changes.

## Human Checkpoints (none currently known)
- [ ] Phase 3 execution has 3 device-verification checkpoints per the plans (03-03, 03-04, 03-05) — not yet reached.

## Recovery Instructions
1. Read `AGENTS.md` → `docs/context-router.md` (new 2026-07-05 lean-routing convention) → `.planning/STATE.md`.
2. Read this file for full Phase 3 planning history if resuming mid-execution or investigating a planning decision.
3. Read `.planning/phases/03-read-path-map/03-0{1..5}-PLAN.md` before executing any wave — start with `03-01` (wave 1, no deps).
4. Run `/gsd:execute-phase 3`. Execution method already confirmed: Metaswarm orchestrated.

## Test Suite State (as of last commit, `bc9a52b`/`b413be8`/`d159219` — no app code changed since; Phase 3 execution has not started)
- 25 suites, 200 tests, 100% coverage on all `src/features/**`
- jest@29.7.0 pinned; 0 typecheck errors; 0 lint errors (27 pre-existing `unicode-bom` warnings, unrelated)
