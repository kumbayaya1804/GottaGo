---
phase: 05-trust-engine-verification
plan: 02
subsystem: database
tags: [postgres, trust-engine, confidence, app-config, checkpoint, decision-gate]

# Dependency graph
requires:
  - phase: 05-trust-engine-verification
    plan: 01
    provides: verification_events event model, private.verification_rate_limits, submission_tags, raw_gps_purge_after column
provides: []   # NOTHING SHIPPED — halted at Task 1's blocking decision checkpoint before any migration was written
affects:
  - "05-02 Tasks 2-5 (blocked on the Task 1 reply)"
  - "05-06 (raw_gps_retention_days seed + legacy NULL-deadline backfill depends on the value locked here)"
  - "06 (confidence decay job consumes the confidence scale locked here — see Finding 2 scale conflict)"

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Halted at Task 1 (checkpoint:decision, gate=blocking) — the plan's FIRST task. Zero migrations written, per Task 1's explicit 'Do NOT write these values into any migration until the user replies.'"
  - "Three substantive defects/conflicts found in the plan's own drafted defaults while grounding the draft; all three are surfaced for the user's decision rather than silently patched."

requirements-completed: []

# Metrics
duration: partial (halted at Task 1 blocking decision checkpoint)
completed: 2026-07-31
---

# Phase 5 Plan 02: Trust Engine Core Summary

**Halted at Task 1 — the plan's first task is a blocking decision checkpoint that locks the trust delta table, confidence scale, and decay constants. No migration was written, because Task 1 forbids writing these values before the user replies. Grounding the draft against the live schema surfaced three real defects in the plan's own recommended defaults, including a silent weight-0 dead zone that would permanently burn a verifier's one-shot slot.**

## Status: CHECKPOINT — stopped at Task 1 (BLOCKING decision gate)

Plan 05-02's task list opens with a `checkpoint:decision gate="blocking"` task. Its action is explicit:

> Present the drafted trust action_type/delta table ... **Do NOT write these values into any migration until the user replies. PAUSE for the decision.**

and its acceptance criteria require:

> The drafted delta table ... **were presented before any migration hardcoded them.**
> **Execution paused until the user replied**; migrations use the reply's locked values.

`.planning/config.json` confirms `workflow.auto_advance: false` and `workflow._auto_chain_active: false`, so auto-mode checkpoint auto-selection does **not** apply — blocking checkpoints stop execution. The orchestrator's dispatch brief independently reinforced this: *"Present your draft clearly and STOP for a response; do not lock values in yourself."*

Tasks 2-5 all consume the Task-1-locked values (Task 2 seeds them into `app_config`; Task 3 bakes the deltas, the decay spans, and the `raw_gps_retention_days` coalesce fallback into `verify_location`; Task 4 depends on Task 3; Task 5 is the second blocking checkpoint). **No task in this plan is reachable without the Task 1 reply.** Consequently zero `supabase/**`, `app/**`, or `docs/**` files were created or modified.

## Performance

- **Tasks:** 0 of 5 executed. Halted at Task 1 (blocking decision gate, first task in the plan).
- **Files created:** 1 (this SUMMARY.md). No migrations, no pgTAP suites, no app changes.

## Accomplishments

No implementation — but the checkpoint draft was **grounded against the live schema and shipped migrations rather than restated from the plan text**, which is what surfaced the three findings below. Verification performed:

- Enumerated the complete live `app_config` key set across all three seeding migrations (`20260519010000_remote_schema.sql` L432, `20260519020000_fix_schema.sql` L21, `20260704010001_phase3_max_pins_config.sql` L13) and confirmed **none of the eight proposed new keys collide**.
- Confirmed `verification_events.weight numeric not null` (`20260519010000_remote_schema.sql` L173) — the plan's explicit `weight = 0` requirement for the `creator_claim` evidence row is correct and load-bearing.
- Confirmed `users.trust_score integer default 9` with **no** `NOT NULL` (`docs/schema-contract.md` L48) — the plan's `coalesce(trust_score, 9)` clamp requirement is correct.
- Confirmed the exact 12-argument `submit_location` signature the plan drops matches the live definition byte-for-byte (`20260708000000_phase4_code_review_fixes.sql` L201-213), and that it currently carries `set search_path = public` (L219) — so the plan's hardening-to-`''` requirement is real, not hypothetical.
- Confirmed `submit_location` uses `max_accuracy_m` as a **hard reject** (L214-216: `p_accuracy_m > v_max_accuracy` → `raise 'gps rejected'`), which is what exposed Finding 1.
- Confirmed the Phase 3 search RPCs' null-tier handling (`20260704010002_phase3_search_rpcs.sql` L117, L152: `l.confidence_tier is null or l.confidence_tier = 'High'`) — null-tier rows currently **pass** the high-confidence filter, which constrains the backfill (Finding 3).

## Findings — three defects in the plan's own drafted defaults

These are presented for decision, not silently patched, because they change values the checkpoint exists to lock.

### Finding 1 (blocking, correctness) — the drafted accuracy constants create a silent weight-0 dead zone

The plan's `draft-defaults` option proposes:
- Hard accuracy reject: `accuracy_floor_m = 100`
- Accuracy decay span: `max_accuracy_m = 50`

With RESEARCH.md Pattern 3's `accuracy_decay = greatest(0, 1 - accuracy_m / accuracy_span)`:

| accuracy_m | passes hard reject (≤100)? | accuracy_decay (span 50) | resulting weight |
|---|---|---|---|
| 0-49 | yes | 0.02 - 1.0 | positive |
| **50-100** | **yes** | **exactly 0** | **exactly 0** |
| >100 | no (rejected) | — | no event |

Any verification with GPS accuracy in **[50, 100]** is *accepted* (`accepted: true`) but carries weight exactly 0. Because of D-43's `verification_events_user_submission_uniq` index, that user can **never retry on that submission** — Task 3 step 7's duplicate-conflict path returns `{accepted:true}` with no side effect. The user sees success, contributes nothing, earns no `verification_given_nonzero`, no `trust_multiplier` ramp, and has permanently burned their one slot. The outcome is byte-identical to a shadowbanned user's event. This is materially **worse than a rejection**, which at least permits a retry with a better fix.

The proximity pair is well-formed by contrast — gate (`verify_radius_m=100`) is *tighter* than span (`discovery_radius_m=500`), so admitted `proximity_decay ∈ [0.8, 1.0]`, never zero. The accuracy pair is inverted: gate (100) is *looser* than span (50).

Second problem: reusing `max_accuracy_m` as a decay span **semantically overloads a live key**. It currently means "hard reject" in `submit_location`. An admin loosening it to 80 to accept more submissions would silently widen the verification decay curve, making mid-accuracy verifications count *more* — a coupled, non-obvious effect across two different RPCs.

Third problem: as drafted, verification accepts sloppier GPS (100m) than submission does (50m). Verification is the fraud-sensitive physical-presence proof; it should not have the looser bar.

**Recommended:** introduce a dedicated `accuracy_decay_span_m = 100` and set `accuracy_floor_m = 50`, mirroring the proximity design (gate strictly tighter than span). Admitted accuracies ∈ [0, 50] → `accuracy_decay ∈ [0.5, 1.0]`, never zero, and the verification bar matches `submit_location`'s existing 50m bar. `max_accuracy_m` is left untouched as `submit_location`'s hard reject. Note this sets the floor at 50m rather than D-46's parenthetical "e.g. ~100m" example — D-46's value is explicitly an example and these constants are Claude's Discretion per CONTEXT.md, but it is a deviation the user should confirm. Options B and C in the checkpoint message preserve 100m if preferred.

### Finding 2 (cross-phase, non-blocking for this plan) — `confidence_floor = 0.05` is on a different scale than the proposed 0-100 confidence

`confidence_floor = 0.05` is already seeded, described as *"Minimum confidence score — locations never decay to zero"* — clearly a 0-1 scale. The draft locks `confidence_value` as **0-100**. Phase 6's decay job consumes `confidence_floor`; on a 0-100 scale a floor of 0.05 is effectively zero (0.05%), defeating the "never decay to zero" guarantee. Task 2 is explicitly forbidden from altering `confidence_floor`, so the clean fix is a new key. Surfaced here because the **scale is being locked at this checkpoint** and Phase 6 inherits it.

### Finding 3 (backfill correctness) — NULL `confidence_tier` must backfill to NULL, not to a mid value

Phase 3's search RPCs treat a null tier as *passing* the high-confidence filter (`not filter_high_conf or l.confidence_tier is null or l.confidence_tier = 'High'`). Backfilling null-tier locations to a numeric Medium would flip them from included to **excluded** under `filter_high_conf` — a live behavior regression on existing rows. Backfill must map `NULL → NULL`. Proposed tier values round-trip stably through the thresholds (High→85, Medium→55, Low→20).

## Task Commits

Only this SUMMARY.md is committed. No `supabase/**`, `app/**`, or `docs/**` files exist to commit — none were created, because Task 1 blocks all of them.

The project's dual-reviewer pre-commit gate (`.claude/hooks/check-review-artifacts.js`, patterns `^app/`, `^supabase/`, `^docs/`, `^\.claude/(commands|hooks|skills|tdd-guard)/`, `^\.beads/hooks/`, root policy docs) was inspected and confirmed **not** to cover `.planning/**`, so this commit runs with hooks enabled and no bypass. `REVIEW_GATE_ALLOW_UNREVIEWED` was not used and is in any case rejected for protected paths per the hook's own header comment (L17).

## Files Created/Modified

- `.planning/phases/05-trust-engine-verification/05-02-SUMMARY.md` — this file (committed)

Nothing else. **No complete-but-uncommitted `supabase/**` work exists for the orchestrator to route through review this round** — unlike 05-01, which halted at Task 5 with four finished files pending review. This dispatch halted at Task 1, before any file could legitimately be written.

## Decisions Made

- Did not exercise the "auto-select first option" auto-mode checkpoint path: `auto_advance` and `_auto_chain_active` are both `false` in `.planning/config.json`, and the orchestrator brief explicitly instructed a stop.
- Did not partially execute Task 2(c) (`notification_outbox`), which is the one sub-unit with no dependency on the Task-1 values. Task 2 is a single atomic task with one commit and one review packet; shipping a third of it would fragment the review unit and leave the SUMMARY/review-queue state ambiguous for no schedule gain, since Tasks 2(a)/2(b)/3 remain blocked regardless.
- Surfaced Findings 1-3 as checkpoint decision input rather than auto-fixing under deviation Rule 1/2. Rules 1-3 authorize fixing defects in *implemented* code; these are defects in *proposed constants* that the checkpoint exists specifically to have the user ratify. Patching them silently would defeat the gate.

## Deviations from Plan

None. Execution halted at the plan's first task exactly as that task specifies. No plan text was modified.

## Issues Encountered

- **Task numbering mismatch in the dispatch brief (harmless).** The orchestrator brief refers to the decision checkpoint as "Task 2" and the live push as "Task 5". In `05-02-PLAN.md` the decision checkpoint is **Task 1**; Task 5 matches. The brief's *description* of the checkpoint ("drafts the trust delta table, confidence thresholds, and decay constants") matches plan Task 1 unambiguously, so this is a numbering slip, not a different gate. Flagged so the next dispatch is not written against the wrong index.
- **Dispatch brief success criterion partially unreachable.** The brief lists "All non-blocking-checkpoint tasks executed with TDD discipline". Zero non-blocking tasks are reachable before the Task 1 reply, so this criterion is vacuous for this round. The brief's own terminating condition — *"or reach a blocking checkpoint"* — is the one that applies.

## User Setup Required

None. The next action is a decision reply, not an environment change.

## Next Phase Readiness

1. **User replies to the Task 1 checkpoint** (see the returned checkpoint message for the full draft and the Finding 1 options).
2. A continuation executor writes Tasks 2 and 3 using the locked values — three migrations, the `verify_location` + `submit_location` rewrite, and two pgTAP suites (RED first, per the plan's own RED/GREEN structure).
3. Those `supabase/**` files are left uncommitted for the orchestrator's Antigravity + Codex review loop, per the 05-01 precedent.
4. `phase5_verify_publish.test.sql` **must** run via `node supabase/scripts/run-isolated-db-suite.js`, never plain `supabase test db` — it commits a real global `submission_publish_threshold` mutation that is unsafe against a shared stack.
5. Task 5 (live push) and Task 4 (`gen types`, which depends on the push) follow behind a separate fresh authorization.

## Self-Check: PASSED

- `.planning/phases/05-trust-engine-verification/05-02-SUMMARY.md` — created, verified present.
- No other files claimed as created; `git status` confirms no `supabase/**`, `app/**`, or `docs/**` changes in this worktree.
- No commit hashes claimed for implementation work, because none exists.

---
*Phase: 05-trust-engine-verification*
*Plan: 02*
*Status: HALTED at Task 1 (blocking decision checkpoint) — awaiting user reply on trust deltas, confidence scale/thresholds, and decay constants*
