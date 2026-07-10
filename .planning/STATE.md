---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
last_updated: "2026-07-10"
last_activity: 2026-07-10
progress:
  total_phases: 12
  completed_phases: 5
  total_plans: 19
  completed_plans: 19
  percent: 42
---

## Roadmap Evolution

- 2026-07-01 — Phase 3: added `family_mode`/`access_sensitivity` RPC-layer filter requirement (closes a gap between Phase 1.5's UI spec and Phase 3's success criteria). Source: `.planning/roadmap-app-store-audit-2026-07-01.md`.
- 2026-07-01 — Phase 4: added `access_sensitivity` field to `submit_location` scope. Source: same audit.
- 2026-07-01 — Phase 5: added "contribution verified" push notification success criterion. Source: same audit.
- 2026-07-01 — Phase 7: added `report_user` RPC and "report fixed" push notification. Closes the Apple 1.2 / Play UGC report/block-user gap identified as LAUNCH-BLOCKING in the audit. Source: same audit.
- 2026-07-01 — Phase 8: added save/favorite-location requirement and plan 08-04. Source: same audit.
- 2026-07-04 — Phase 3: added Nearby list-view tab (accessible alt to map, designed in Phase 1.5 but never scheduled into any phase) and a `family_mode` Settings toggle (the RPC-layer filter Phase 3 builds had no UI to ever activate it) — both folded into new plan 03-04. Source: `03-CONTEXT.md` discussion, two systematic cross-reference passes.
- 2026-07-07 — Phase 3 executed (all 5 plans, 3 waves fully autonomous + 1 wave with deferred device checkpoints). Cross-AI review (Antigravity + Codex, 7 findings) resolved pre-execution; internal code review found 2 more criticals (CR-01 null-viewport crash, CR-02 D-08 chill_spot violation) post-execution, both fixed and pushed live. VERIFICATION.md: 12/13 must-haves, pgTAP-execution gap accepted as a tracked override (no Docker in this environment) — see pending todo. 7 device-UAT items deferred by design, not gaps.
- 2026-07-07 — Phase 4 discuss-phase started. 1 of 4 selected gray areas complete (Non-building locations — closes the 2026-07-05/06 open PROJECT.md design question: no new location_type field, free-text description replaces street address when none exists, GPS fix is always the canonical coordinate source). Checkpoint saved: `.planning/phases/04-gps-service-submission/04-DISCUSS-CHECKPOINT.json`. Superseded by the 2026-07-09 Phase 4 closure update in `.beads/context/execution-state.md`.
- 2026-07-09 - Phase 4 code/review gate closed after final review-fix commit `bf93a37` (`fix phase 4 review findings`). Antigravity and Codex both APPROVE the 32-file queue; `.claude/review-queue.txt` is empty. GSD `progress` still reports Phase 04 as `Needs Review` only because `04-VERIFICATION.md` honestly remains `status: human_needed` for two deferred device-UAT walkthroughs.
- 2026-07-09 - Phase 5 readiness audit created at `.planning/phases/05-trust-engine-verification/05-READINESS.md`. It reconciles Phase 4's staging model with the trust-engine roadmap and identifies eight discussion gates: pending-candidate discovery, pre-publication event modeling, the unmeasurable 48-hour no-flag route, numeric confidence authority, trust/decay formulas, missing push infrastructure, the personal-impact metric definition, and discarded accessibility selections.
- 2026-07-09 - Codex contingency orchestration documented in `docs/codex-model-routing.md`: Sol/high is the default orchestrator while Claude is rate-limited; Terra/Luna are bounded delegates; max/ultra are task-specific; the independent Antigravity + Codex review gate remains mandatory.
- 2026-07-09 - Whole-project pre-Phase-5 audit saved at `.planning/project-audit-2026-07-09.md` and stale-info scan refreshed. At audit time, Phase 5 executable planning waited on the Phase 3 PostGIS fix, verification-event write hardening, clean lint/Jest exit, schema/source-document reconciliation, and the Phase 5 decision worksheet. This dated condition is historical and superseded by the 2026-07-10 entry below.
- 2026-07-09 - Claude recovery handoff saved at `.planning/CLAUDE-HANDOFF-2026-07-09.md` with the authoritative read order, exact P0 remediation sequence, verification evidence, review state, worktree safety notes, and Phase 5 decisions that must not be guessed.
- 2026-07-09 - Global `artifact-qa-gate` Codex skill upgraded for GPT-5.6 Sol and Gotta Go: risk-scaled evidence ladder, scope/persistence controls, delegated-work verification, failed/non-exiting command handling, completion contract, and a progressively loaded Gotta Go QA profile. Skill validation passed; the global skill is outside this repo's review queue.
- 2026-07-10 - Pre-Phase-5 P0 remediation batch (49 files) COMMITTED as `c5f4f7b` after fresh Round 8 Antigravity + Codex APPROVE, both bound to an independently-verified `scope_hash` (`sha256:87b008d0...`). Covers: PostGIS schema-qualification fix + full legacy-RPC retirement (live); verification_events direct-insert policy removal (live) + client-role ACL lockdown migration `20260710121534` (committed, still undeployed pending separate push authorization); clean verification baseline (46/46 suites, 389/389 tests, 100% coverage); GPS-provider/location-detail recovery UX fixes; removal of the orphaned `useDeniedLocationState` hook; and a new `scope_hash` fingerprinting mechanism in the review-gate hook binding reviewer approvals to exact staged bytes. `.claude/review-queue.txt` cleared. Next action: separately authorized ACL migration deploy/live-verify, then item 4 authority-doc refresh, then Phase 5 discussion gates.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260704-0kt | Harness integrity fix batch: queue-path normalization, Antigravity invocation repair, roster format drift, Stop-hook gating, review-gate wording | 2026-07-04 | b413be8 | [260704-0kt-harness-integrity-fix-batch-queue-path-n](./quick/260704-0kt-harness-integrity-fix-batch-queue-path-n/) |

## Accumulated Context

### Pending Todos

- [Non-comparative engagement and novelty ideas](../todos/pending/2026-07-06-non-comparative-engagement-and-novelty-ideas.md) — dopamine/retention mechanic ideas (discovery log, private streaks, gut-health trivia, quiet aggregate social proof, self-facing badges) compatible with the standing anti-comparative-gamification decision; not yet scoped to a phase.
- [Run pgTAP suite on Docker-capable machine](../todos/pending/2026-07-07-run-pgtap-suite-on-docker-capable-machine.md) — Phase 3's 24-assertion pgTAP suite and Phase 4's two 21-assertion pgTAP suites have never executed (no Docker here); accepted as a tracked override, but must run before trusting the SQL/RPC foundation Phase 5 builds on.

### Pending Device UAT (Phase 3)

7 device-verification items deferred by design from Phase 3's 5 plans (Mapbox rendering/gestures, RPC-failure banner, Nearby screen-reader pass, family_mode end-to-end + display-name preservation, filter AND-logic/session-persist, denied-GPS fallback) — full steps in `.planning/phases/03-read-path-map/03-VERIFICATION.md` § Human Verification Required.

### Pending Device UAT (Phase 4)

2 device-verification items deferred by design from Phase 4: SubmitFlow real GPS/permission/mock-location walkthrough, plus pending-pin/withdraw/code-update device walkthrough. Full steps live in `.planning/phases/04-gps-service-submission/04-HUMAN-UAT.md` and `.planning/phases/04-gps-service-submission/04-VERIFICATION.md`.

Last activity: 2026-07-10
