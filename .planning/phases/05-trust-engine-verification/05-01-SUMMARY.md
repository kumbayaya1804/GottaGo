---
phase: 05-trust-engine-verification
plan: 01
subsystem: database
tags: [postgres, pgtap, postgis, supabase, rls, security-definer, verification-events]

# Dependency graph
requires:
  - phase: 04-gps-service-submission
    provides: submissions staging table, submit_location/get_my_pending_submissions/withdraw_submission RPCs, verification_events client-write lockdown
provides:
  - "verification_events polymorphic event model (submission_id OR location_id, exactly-one CHECK, per-user-per-submission uniqueness)"
  - "submissions lifecycle CHECK extended with 'cancelled' (D-58)"
  - "submission_tags staging table (changing_table/wheelchair, D-62/D-63)"
  - "private.verification_rate_limits schema + table for discovery/verify cooldown state (D-36)"
  - "delete_account() hardened to purge raw GPS coordinate (D-41) while preserving derived evidence (D-40), search_path='' hardened"
  - "withdraw_submission() rewritten event-aware (D-58) with WR-04 zero-row raise preserved, search_path='' hardened"
  - "search_pending_submissions_nearby RPC (500m discovery, D-37 result cap, no identity leak) + partial GiST index"
  - "pgTAP suites: phase5_event_model.test.sql (25 assertions), phase5_discovery.test.sql (16 assertions)"
affects: ["05-02 (verify_location + atomic publish depends on this event model and rate-limit table)", "05-06 (raw-GPS purge routine depends on raw_gps_purge_after column added here)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 5 fixed-empty search_path contract (set search_path = '' + full schema qualification) applied to recreated privileged RPCs (delete_account, withdraw_submission), not only newly-named ones"
    - "extensions.-qualified PostGIS idiom including OPERATOR(extensions.<->) for KNN ordering under search_path=''"
    - "D-37 result cap idiom: greatest(1, least(coalesce(result_limit, 10), 10)) — never a bare least()"
    - "private schema (not Data-API exposed) for server-only rate-limit state, revoked from anon/authenticated as defense in depth"

key-files:
  created:
    - supabase/tests/phase5_event_model.test.sql
    - supabase/tests/phase5_discovery.test.sql
    - supabase/migrations/20260717120000_phase5_event_model.sql
    - supabase/migrations/20260717120100_phase5_discovery_rpc.sql
  modified: []

key-decisions:
  - "Followed the plan's TDD-style Wave 0 RED-first structure: Task 1 authored both pgTAP suites before Tasks 2-3 created the schema objects they test."
  - "verification_events_target_exactly_one CHECK and verification_events_user_submission_uniq partial unique index implement D-39/D-43 exactly as specified; no deviation."
  - "withdraw_submission rewritten to lock the owned pending submission first (SELECT ... FOR UPDATE), then branch: cancel-if-event-exists (D-58) vs hard-delete-if-unverified, preserving the WR-04 zero-row 'submission not available' raise."
  - "delete_account and withdraw_submission both hardened from their inherited public/public,auth search_path to the Phase 5 fixed-empty '' contract, with every referenced object schema-qualified (public.*, auth.*)."
  - "Discovery RPC coalesces discovery_radius_m to 500 and verify_cooldown_s to 3 since those app_config keys are not seeded until 05-02 — matches the documented '05-02 not yet run' dependency, not a gap in this plan."

requirements-completed: []  # Task 5 (live push) is BLOCKED — nothing is live yet; requirements are not yet satisfiable in production.

# Metrics
duration: partial (checkpoint reached; live-push authorization pending)
completed: 2026-07-17
---

# Phase 5 Plan 01: Event Model + Discovery Foundation Summary

**Polymorphic verification_events event model (D-39/D-43), event-aware withdraw + hardened delete_account, and a rate-limited 500m pending-candidate discovery RPC — migrations and pgTAP authored, live push BLOCKED pending human authorization and the project's mandatory Antigravity + Codex review gate.**

## Status: CHECKPOINT — stopped at Task 5 (BLOCKING live-push checkpoint)

Per the plan's `autonomous: false` frontmatter and Task 5's `type="checkpoint:human-verify" gate="blocking"`, execution stopped before any `supabase db push`. Tasks 1-3 are fully implemented (RED tests + GREEN schema objects). Task 4 (`supabase gen types`) cannot run until Task 5's live push applies the migrations. **No `supabase db push` was attempted.**

This worktree's project (`CLAUDE.md`, `docs/agent-harness.md`) additionally requires every `supabase/**` change to carry both an Antigravity APPROVE and a Codex APPROVE, enforced by a local pre-commit hook (`.claude/hooks/check-review-artifacts.js`) that blocks staging `supabase/**` files without a matching `.claude/review-queue.txt` entry and fresh APPROVE-verdict artifacts. That review loop is orchestrator-owned (`Claude writes packets. The user runs reviewers.`) — this executor did not attempt to generate review packets, invoke Antigravity/Codex, or bypass the hook (`REVIEW_GATE_ALLOW_UNREVIEWED=1` was NOT used). All four `supabase/**` files below are left **uncommitted** in this worktree for the orchestrator to stage and drive through that review loop.

## Performance

- **Tasks:** 3 of 5 fully implemented (Task 1 RED tests, Task 2 event-model migration, Task 3 discovery RPC migration); Task 4 blocked on Task 5; Task 5 halted per checkpoint protocol.
- **Files created:** 4 (2 pgTAP suites, 2 migrations) — all uncommitted.

## Accomplishments

- **Task 1 (RED):** Authored `supabase/tests/phase5_event_model.test.sql` (25 pgTAP assertions) and `supabase/tests/phase5_discovery.test.sql` (16 pgTAP assertions) covering every must-have: exactly-one target CHECK, per-user-per-submission uniqueness, 42501 lockdown regression, cancelled/expired lifecycle, submission_tags key CHECK, delete_account raw-coord-purge-vs-derived-preserve, WR-04 zero-row raise, D-58 event-aware withdraw, empty-search_path proconfig catalog assertions, 500m radius inclusion/exclusion, D-37 result cap across null/zero/negative/oversized/in-bounds `result_limit`, no-identity-leak column-shape check, and per-user discovery cooldown allowed/denied paths.
- **Task 2 (GREEN — event model):** `supabase/migrations/20260717120000_phase5_event_model.sql` adds the polymorphic `submission_id` column + drops `location_id` NOT NULL + `verification_events_target_exactly_one` CHECK (D-39); adds `gps_accuracy_m`/`captured_at`/`raw_gps_purge_after` audit columns (D-40, forward-referencing the 05-02/05-06 retention-window and backfill dependency); adds `verification_events_user_submission_uniq` partial unique index (D-43); extends `submissions.status` CHECK with `'cancelled'` (D-58); creates the `submission_tags` staging table with an exactly-two-key CHECK, owner-scoped RLS, and no client insert grant (D-62/D-63); preserves the 2026-07-10 verification_events client-write lockdown byte-for-byte (no new grants); rewrites `delete_account()` to purge `gps_location` for the deleting user while preserving `distance_from_location_meters`/`gps_accuracy_m`/`weight` (D-41/D-40) and hardens it to `set search_path = ''`; rewrites `withdraw_submission()` to lock the owned pending row first, cancel (not hard-delete) when a verification event exists (D-58), preserve the WR-04 zero-row raise, and hardens it to `set search_path = ''`; creates the `private` schema and `private.verification_rate_limits` table (D-36), revoked from anon/authenticated.
- **Task 3 (GREEN — discovery):** `supabase/migrations/20260717120100_phase5_discovery_rpc.sql` defines `search_pending_submissions_nearby(user_lat, user_lng, result_limit default 10)` as `security definer volatile set search_path=''`: auth-gates to zero rows for anon callers, atomically claims `last_discovery_at` in `private.verification_rate_limits` before querying (so a cooldown-denied call still consumes the cooldown, D-36), reads `discovery_radius_m` with a `coalesce(..., 500)` fallback (never `verify_radius_m`), excludes own submissions and already-verified submissions via `NOT EXISTS`, filters to `status='pending' AND expires_at > now()`, orders by KNN (`OPERATOR(extensions.<->)`), and caps results via `greatest(1, least(coalesce(result_limit, 10), 10))`. Adds a partial GiST index on `submissions(coordinates) WHERE status='pending'` (query keeps `expires_at > now()` since index predicates cannot reference `now()`). Grant triple: revoked from public/anon, granted only to authenticated.

## Task Commits

**None of the 4 files above are committed.** Every `supabase/**` path is subject to this project's mandatory dual-reviewer gate (`docs/agent-harness.md`, `CLAUDE.md` "Current Reviewer Contract"), enforced by `.claude/hooks/check-review-artifacts.js`. An initial `git commit` attempt for the Task 1 test files was rejected by that hook (`BLOCKED: staged file(s) match review-required paths but are missing from .claude/review-queue.txt`) — this executor did not retry with the `REVIEW_GATE_ALLOW_UNREVIEWED=1` escape hatch, since that hatch is explicitly reserved for "explicit user approval only" and no such approval was given to this executor directly. The orchestrator owns staging, review-packet generation, and the eventual commit(s) for these files per the project's reviewer contract.

This SUMMARY.md itself is committed separately (see Self-Check below) because `.planning/phases/**` does not match the hook's review-required path patterns (`app/`, `supabase/`, `docs/`, specific `.claude/` paths, and root policy docs) and this executor's own harness instructions mandate committing SUMMARY.md before returning, to avoid permanent loss if the worktree is force-removed.

## Files Created/Modified (uncommitted, in worktree)

- `supabase/tests/phase5_event_model.test.sql` — pgTAP RED suite, 25 assertions (event model, lockdown, delete_account, withdraw_submission, search_path hardening)
- `supabase/tests/phase5_discovery.test.sql` — pgTAP RED suite, 16 assertions (discovery exclusions, result cap, cooldown, no-leak)
- `supabase/migrations/20260717120000_phase5_event_model.sql` — event-model evolution migration (9 sections, see Accomplishments)
- `supabase/migrations/20260717120100_phase5_discovery_rpc.sql` — discovery RPC + partial GiST index

## Decisions Made

- Test fixture user/submission UUIDs use deterministic hex patterns (e.g. `aaaaaaaa-0000-0000-0000-000000000001`) rather than `gen_random_uuid()` so cross-referencing assertions (ownership, event linkage) stay readable and stable across reruns within the same transaction/rollback.
- The KNN ordering operator required explicit `OPERATOR(extensions.<->)` qualification (not bare `<->`) because the discovery RPC uses `set search_path = ''` — this was caught and fixed during self-review before the automated verify grep would have missed it (the grep only checks for the presence of `st_dwithin`/`discovery_radius_m`/etc., not operator qualification correctness). See Deviations below.
- `discovery_radius_m`/`verify_cooldown_s` app_config keys are intentionally NOT seeded by this plan (05-02 seeds them per `05-PATTERNS.md`); the RPC's `coalesce(..., 500)` / `coalesce(..., 3)` fallbacks match the values 05-02 will seed, so the RPC is fully functional standalone before 05-02 runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment text in the event-model migration referenced the literal string `gps_lat`, tripping the migration's own verify grep**
- **Found during:** Task 2 self-verification (`! grep -q "gps_lat" ...`)
- **Issue:** Two explanatory comments used the literal column names `gps_lat`/`gps_lon` to describe why they are no longer referenced (they were dropped by an earlier migration). The plan's own automated verify step forbids the literal substring `gps_lat` anywhere in the file, including comments, to prevent any accidental reintroduction.
- **Fix:** Reworded both comments to say "the original raw numeric lat/lon columns" instead of naming the dropped columns literally.
- **Files modified:** `supabase/migrations/20260717120000_phase5_event_model.sql`
- **Verification:** Re-ran the exact automated verify command from the plan; all six grep conditions now pass (`TASK2_VERIFY_PASS`).

**2. [Rule 1 - Bug] Bare `<->` KNN operator would not resolve under `set search_path = ''`**
- **Found during:** Task 3 self-review, cross-checked against `20260710010000_phase3_postgis_schema_qualification_fix.sql`'s documented `OPERATOR(schema.op)` requirement
- **Issue:** The discovery RPC's `ORDER BY` clause used the bare `<->` operator. Because PostGIS is installed in the `extensions` schema (not `public`) and this function sets `search_path = ''`, an unqualified infix operator symbol would fail to resolve at call time (`operator does not exist`), exactly the class of bug the 2026-07-10 whole-project PostGIS-qualification remediation fixed for the Phase 3 search RPCs.
- **Fix:** Replaced `s.coordinates <-> ...` with `s.coordinates OPERATOR(extensions.<->) ...`, matching the proven qualified idiom.
- **Files modified:** `supabase/migrations/20260717120100_phase5_discovery_rpc.sql`
- **Verification:** Re-ran the plan's automated verify grep (still passes) and a manual scan for any remaining unqualified `st_*`/`geography`/`geometry`/operator references (none found).

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs caught during self-review before any live execution was possible in this environment).
**Impact on plan:** Both fixes are required for the migration to actually work when pushed; no scope creep, no plan-text changes needed.

## Issues Encountered

- **Review-gate conflict (not a deviation, a hard project constraint):** Attempting to commit Task 1's two test files was blocked by `.claude/hooks/check-review-artifacts.js` (`BLOCKED: staged file(s) match review-required paths but are missing from .claude/review-queue.txt`). This is expected, correct behavior per `CLAUDE.md`'s "No commit without APPROVE from both Antigravity and Codex" hard constraint and `docs/agent-harness.md`'s reviewer contract — not a bug to fix. Per orchestrator instruction, all `supabase/**` work is left uncommitted in this worktree for the orchestrator to stage and route through the Antigravity + Codex review loop centrally. This executor did not generate review packets, did not invoke Antigravity/Codex, and did not use the `REVIEW_GATE_ALLOW_UNREVIEWED=1` escape hatch.
- **No Docker/live Postgres available in this environment:** Both pgTAP suites are structurally authored and self-reviewed line-by-line against the live schema facts documented in the plan's `<interfaces>` block, but could not actually be executed (`supabase test db`) here. Per the plan, this is a BLOCKING pre-push gate — Task 5 requires a clean `supabase test db` run (inherited Phase 3/4 suites + these two new suites) on a Docker-capable or isolated non-production environment BEFORE any live push, in addition to the dual-reviewer APPROVE gate.

## User Setup Required

None yet — Task 5 (the live push) has not run. Once authorized, the live push requires `SUPABASE_ACCESS_TOKEN` sourced from `~/.supabase-gsd-token` (already documented in this project's setup; not sourced or referenced by this executor).

## Next Phase Readiness

**Not ready to proceed to 05-02 yet.** Blocking items before Task 5 (and therefore before 05-02, which depends on `private.verification_rate_limits` and the event model existing live):

1. Run `supabase test db` (inherited Phase 3/4 suites + `phase5_event_model.test.sql` + `phase5_discovery.test.sql`) on a Docker-capable or isolated non-production environment — must pass clean.
2. Route the 4 uncommitted `supabase/**` files through this project's Antigravity + Codex review loop (packets → both APPROVE) per `docs/agent-harness.md`.
3. Commit the reviewed files.
4. Obtain explicit human authorization for the live `supabase db push` (Task 5's checkpoint).
5. Run Task 4 (`supabase gen types typescript`) against the live schema to regenerate `app/src/lib/database.types.ts`.

Once those complete, `search_pending_submissions_nearby` and `private.verification_rate_limits` are the foundation 05-02's `verify_location` + atomic-publish RPC builds on directly.

---
*Phase: 05-trust-engine-verification*
*Plan: 01*
*Status: checkpoint (Task 5 blocked pending live-push authorization + review gate)*
