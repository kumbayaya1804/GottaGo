<!-- review-manifest
reviewer: codex
generated_at: 2026-07-18T18:00:00Z
scope_hash: sha256:a8fe306667b6a6bab8d3f6e2ebcf84c37f6b23f796961ffa13172316cbcff9fe
queue:
  - supabase/migrations/20260717120000_phase5_event_model.sql
  - supabase/migrations/20260717120100_phase5_discovery_rpc.sql
  - supabase/tests/phase5_event_model.test.sql
  - supabase/tests/phase5_discovery.test.sql
  - supabase/tests/phase5_discovery_cooldown_race.test.sql
  - app/src/features/submit/withdrawSubmission.ts
diff_base: HEAD
context_tier: 1
-->

# Codex Review — Phase 5 Plan 01 (Event Model + Discovery), Round 5 (Rebuttal, No Code Change)

## Task Goal

This round is different from every prior round: **no file in the queue has changed.** The `scope_hash` is identical to round 4 (`sha256:a8fe306667...`) because none of the 6 queued bytes changed. Antigravity's round-4 verdict was APPROVE and remains current against this unchanged scope_hash. Your round-4 verdict was REQUEST CHANGES with exactly one MAJOR finding, and this packet is a technical rebuttal of that specific finding, not a new set of fixes.

**Your round-4 finding, verbatim:** "The bounded polling loop repeatedly reads `pg_stat_activity` inside one `DO` transaction without calling `pg_stat_clear_snapshot()`. PostgreSQL 17 caches the current-activity snapshot after its first access in a transaction and can continue returning that same snapshot until transaction end... [PostgreSQL 17 monitoring documentation] explicitly documents the transaction-scoped caching behavior and `pg_stat_clear_snapshot()` remedy."

**Before implementing this, the same PostgreSQL 17 monitoring documentation page you cited was fetched and read directly.** It draws an explicit distinction between two categories of statistics:

1. **Cumulative statistics views** (`pg_stat_user_tables`, `pg_stat_database`, etc.) — these ARE subject to the transaction-scoped snapshot cache, and `pg_stat_clear_snapshot()` IS the documented remedy for these.
2. **Dynamic/current-activity information** (`pg_stat_activity`'s per-backend live fields, collected via `track_activities`) — the doc's own words: **"However, current-query information collected by `track_activities` is always up-to-date."** This is stated as an explicit exception to the caching behavior just described for the cumulative views, not an instance of it.

`wait_event_type`/`wait_event` are part of that per-backend current-activity information (governed by `track_activities`), not the cumulative-statistics subsystem `pg_stat_clear_snapshot()` targets. On this reading, the polling loop in `phase5_discovery_cooldown_race.test.sql` does not have the staleness problem described — each iteration's `select wait_event_type into v_wait_type from pg_stat_activity where pid = v_pid` should already observe live state, with no snapshot to clear.

**This packet does not implement the suggested `pg_stat_clear_snapshot()` call**, per this project's standing discipline of verifying reviewer findings against primary sources rather than implementing them on assertion alone (`superpowers:receiving-code-review`), and per this project's own anti-cruft convention against adding code that doesn't fix a real problem. The user was informed of this specific disagreement before this packet was sent, given your consistently high hit-rate on this project to date — this is being treated as a genuine technical question to resolve, not a dismissal.

## What We're Asking

Please re-examine your round-4 finding against the exact documentation text quoted above (from the same page you cited) and do ONE of the following:

- **Confirm the pushback:** if you agree `pg_stat_activity`'s dynamic fields (including `wait_event_type`) are exempt from the snapshot cache your finding described, retract this finding as a false positive and note what led to conflating it with the cumulative-stats behavior.
- **Defend the original finding:** if you have evidence that `wait_event_type` specifically (as opposed to the "current query text" the doc's example emphasizes) IS subject to snapshot caching despite the "always up-to-date" language — e.g., a documented distinction between `track_activities`'s different sub-fields, a version-specific caveat, or empirical evidence — cite it precisely, and we will implement the fix.
- **Something in between:** if the answer is genuinely ambiguous or version/configuration-dependent, say so explicitly and recommend whether the defensive `pg_stat_clear_snapshot()` call is still worth adding out of caution even if not strictly required.

Everything else in the queue is unchanged and already covered by your round-4 "Approved" section (the drain-call fix, the two wording fixes, all prior production-code approval) — no need to re-review those.

## Runtime Boundary And Mock Audit

Unchanged from round 4 — no production code, client caller, or RLS/ACL surface changed this round; the only difference is the resolution of one static-analysis finding about a test-harness polling loop, which touches no runtime boundary or mock. See round 4's packet for the full audit if needed; nothing here invalidates it.

## Required Skills

- `.claude/skills/artifact_qa_gate.md` shared core and **Codex Overlay**
- `.claude/skills/postgis_optimizer.md` (unchanged file, no re-review needed)
- `.claude/skills/rls_security_guard.md`
- `.claude/skills/trust_engine_validator.md`

## Required Verdict Format

Write your verdict to `.claude/codex-review-latest.md`:

```md
## Codex Review - Phase 5 Plan 01 (Event Model + Discovery), Round 5 (Rebuttal)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

scope_hash: sha256:a8fe306667b6a6bab8d3f6e2ebcf84c37f6b23f796961ffa13172316cbcff9fe

### Reviewed Queue
- List every queued file inspected for this verdict (unchanged bytes, but confirm).

### Skills Applied
- List the shared gate, Codex overlay, and task-relevant skills actually used.

### Findings
- State plainly whether the round-4 `pg_stat_clear_snapshot()` finding is retracted, confirmed, or refined, with the exact documentation basis either way.

### Open Questions
- Any remaining ambiguity.

### Verification
- Commands/sources checked, including direct re-reading of the cited documentation.

### Runtime Boundary Check
- Unchanged from round 4 unless this finding's resolution changes that assessment.

### Approved
- What is correct or ready to merge, including whether this queue is now clear to commit pending the isolated-runner execution.
```

Print the same verdict after writing it. If BLOCK is not an accepted token by your runtime, use REQUEST CHANGES but retain the true severity in the Findings section.
