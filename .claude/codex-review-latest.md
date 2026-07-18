## Codex Review - Phase 5 Plan 01 (Event Model + Discovery), Round 5 (Rebuttal)

**VERDICT: APPROVE**

scope_hash: sha256:a8fe306667b6a6bab8d3f6e2ebcf84c37f6b23f796961ffa13172316cbcff9fe

### Reviewed Queue

- `supabase/migrations/20260717120000_phase5_event_model.sql`
- `supabase/migrations/20260717120100_phase5_discovery_rpc.sql`
- `supabase/tests/phase5_event_model.test.sql`
- `supabase/tests/phase5_discovery.test.sql`
- `supabase/tests/phase5_discovery_cooldown_race.test.sql`
- `app/src/features/submit/withdrawSubmission.ts`

### Skills Applied

- Global Codex `artifact-qa-gate` skill and its Gotta Go QA profile.
- Repository `.claude/skills/artifact_qa_gate.md` shared core and **Codex Overlay**.
- Repository `.claude/skills/postgis_optimizer.md`.
- Repository `.claude/skills/rls_security_guard.md`.
- Repository `.claude/skills/trust_engine_validator.md`.
- Installed Supabase skill and Supabase Postgres Best Practices locking guidance.
- No Superpowers skill is exposed in this Codex session, so none is claimed as applied.

### Findings

- **Round 4 finding retracted as a false positive.** The conclusion of the rebuttal is correct for the exact field used by the test: PostgreSQL 17 does not serve `pg_stat_activity.wait_event_type` from the transaction-cached backend-activity snapshot. In `pg_stat_get_activity()`, PostgreSQL first uses a cached `LocalPgBackendStatus` entry for fields such as state and query text, but then obtains the target backend's live `PGPROC` and reads `proc->wait_event_info` with `UINT32_ACCESS_ONCE` to derive `wait_event_type` and `wait_event`. Each execution of the polling query therefore samples the current wait-event value; `pg_stat_clear_snapshot()` is not required for this field.
- My Round 4 reasoning conflated the cached `PgBackendStatus`/current-query snapshot with the separately read live `PGPROC.wait_event_info`. The documentation's transaction-snapshot warning does apply to accumulated statistics and several activity fields, but the PostgreSQL 17 source makes the wait-event exception explicit. Adding `pg_stat_clear_snapshot()` here would be defensive-looking cruft rather than a fix for the observed field.
- The packet's broad statement that dynamic/current-activity fields are categorically exempt is slightly overgeneralized: PostgreSQL's own documentation also says current-query information for all sessions can remain fixed within a transaction. That nuance does not change this verdict because the only polled value is `wait_event_type`, whose live read path is unambiguous in the implementation.

### Open Questions

- None about the disputed snapshot behavior. Runtime execution of the pgTAP suites remains a separate pre-push gate, not an unresolved code-review finding.

### Verification

- `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash` exited 0 and reproduced `sha256:a8fe306667b6a6bab8d3f6e2ebcf84c37f6b23f796961ffa13172316cbcff9fe`, confirming the six queued staged byte streams are unchanged from Round 4.
- `git diff --cached --check` and `git diff --check` exited 0.
- The review queue contains the six manifest paths. The staged index additionally contains the review-gate-excluded `.planning/phases/05-trust-engine-verification/05-01-PLAN.md`; its controlling pre-push language was reconfirmed.
- All six queued files were inspected and their material roles reconfirmed. No queued byte changed between Round 4 and this rebuttal.
- PostgreSQL 17 monitoring documentation was reread directly. It distinguishes dynamic activity from cumulative statistics, says current activity is collected without cumulative-statistics lag, and separately documents transaction-level snapshots for accumulated/current-query information: [PostgreSQL 17 monitoring statistics](https://www.postgresql.org/docs/17/monitoring-stats.html).
- PostgreSQL 17 source was inspected to resolve that documentation-level ambiguity. `pg_stat_get_activity()` gets a live `PGPROC` and reads `proc->wait_event_info` directly for each result construction: [PostgreSQL 17 `pgstatfuncs.c`](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/adt/pgstatfuncs.c#L2861-L2902). The backend activity snapshot code separately confirms that `PgBackendStatus` is copied once per transaction: [PostgreSQL 17 `backend_status.c`](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/activity/backend_status.c#L3376-L3423).
- `node --test supabase/scripts/run-isolated-db-suite.test.js` exited 0: all 24 runner unit tests passed.
- `npm.cmd test -- --runInBand --runTestsByPath "src/features/submit/__tests__/withdrawSubmission.test.ts"` exited 0: 1 suite and 3 tests passed.
- The required isolated command `node supabase/scripts/run-isolated-db-suite.js supabase/tests/phase5_discovery_cooldown_race.test.sql` still exited 1 before database startup because the runner could not resolve the installed Supabase CLI executable/JS entry from `PATH`. `supabase.cmd --version` reports 2.107.0; `docker` and `psql` remain unavailable. No pgTAP database assertion executed.
- The current Supabase breaking-change/changelog index was checked; no platform change alters PostgreSQL 17's wait-event read path or this verdict.
- Not run: live migration, live ACL inspection, `EXPLAIN`, live push, or any pgTAP database assertion.

### Runtime Boundary Check

- The Round 4 production-code assessment remains unchanged: the discovery claim's `FOR UPDATE` path serializes competing callers before reading the prior timestamp, and every allowed or denied attempt advances the claim with `clock_timestamp()`.
- The race harness's overlap observation is statically sound. B's backend pid is known before polling; each loop execution reads B's live `PGPROC.wait_event_info`; observing `wait_event_type = 'Lock'` proves the real RPC is blocked while A holds the competing row lock.
- The dblink lifecycle remains correctly drained: each asynchronous connection has one send followed by its result read and the required terminating empty-result read before reuse or disconnect.
- The harness has still never executed against PostgreSQL on this host. Static approval resolves the false-positive snapshot objection but does not substitute for the plan's required isolated database run.
- The client wrapper remains comment-only and its focused mocked tests pass; those mocks do not exercise the database lock, dblink, RLS, or ACL boundary.

### Approved

- The Round 4 `pg_stat_clear_snapshot()` requirement is withdrawn. No code change is needed for `wait_event_type` freshness.
- All earlier fixes remain approved: valid UUID fixtures, non-row-returning JWT setup, deterministic manual-lock/real-RPC handshake, full dblink result draining, correct no-override wording, and reconciled three-suite plan descriptions.
- The unchanged event-model migration, discovery RPC migration, all three pgTAP files, PostGIS/RLS/ACL boundaries, and client comment are approved for the current staged scope.
- The Codex review gate is clear for committing these unchanged bytes; Antigravity's Round 4 approval remains bound to the same scope hash. This does **not** authorize or clear a live database push.
- Before Phase 5 Task 5 or any live push, the plan still requires successful execution of the regular Phase 5 pgTAP suites plus `phase5_discovery_cooldown_race.test.sql` through the isolated runner on a Docker-capable or isolated non-production PostgreSQL environment, followed by explicit human authorization for the push.
