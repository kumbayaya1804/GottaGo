---
created: 2026-07-07T08:50:50Z
title: Run pgTAP suite on Docker-capable machine
area: database
files:
  - supabase/tests/phase3_read_rpcs.test.sql
  - supabase/tests/phase4_submit.test.sql
  - supabase/tests/phase4_access_code.test.sql
  - .planning/phases/03-read-path-map/03-VERIFICATION.md (accepted override)
  - .planning/phases/04-gps-service-submission/04-VERIFICATION.md (accepted override)
---

## Resolved (2026-08-01)

Docker became available in this environment. Ran the full inherited Phase 3/4 + all
Phase 5 pgTAP suite via `node supabase/scripts/run-isolated-db-suite.js` (the
disposable-instance isolated runner, required for suites that commit a real
concurrency-sensitive `app_config` mutation) — `phase3_read_rpcs.test.sql`,
`phase4_submit.test.sql`, and `phase4_access_code.test.sql` all ran for real and
passed cleanly as part of a 246/246 (later 253/253) full-suite result, run
repeatedly to confirm stability. This first-ever real execution also surfaced and
fixed 5 previously-undiscovered defects elsewhere in the Phase 5 suites (see
`.planning/STATE.md`'s 2026-08-01 entries for full detail) — none in the Phase 3/4
suites this todo specifically tracked, which passed with no fixes needed.

## Problem

`supabase/tests/phase3_read_rpcs.test.sql` (24 assertions across 10 correctness properties: four-clause moderation, family_mode exclusion, access-code omission, nearest-N ordering, config-driven pin cap, D-08 null-include incl. the CR-02 chill_spot fix, detail distance source, antimeridian handling, update_profile coalesce, base-table SELECT denial) has never executed against a real Postgres/PostGIS instance in any session across Phase 3's lifecycle — this dev environment has no Docker CLI, and `supabase test db --local` requires `supabase start`/`db reset`.

All properties were independently verified correct by direct SQL reading across two review passes (pre-execution cross-AI review + post-execution code review), and the code-review pass did catch one real bug this way (CR-02, chill_spot null-include violation, since fixed). But static reading is not a substitute for a passing test run — accepted as a tracked override in `03-VERIFICATION.md` (2026-07-07) specifically so this isn't silently forgotten before Phase 4 builds more RPCs on top of this same read path.

## Phase 4 Update (2026-07-09)

Phase 4 added two more pgTAP suites that are also statically verified but not Docker-executed in this environment:

- `supabase/tests/phase4_submit.test.sql` - `select plan(21)` and 21 counted assertions.
- `supabase/tests/phase4_access_code.test.sql` - `select plan(21)` and 21 counted assertions.

These cover `submit_location`, `get_my_pending_submissions`, `withdraw_submission`, direct `submissions` INSERT denial, and the access-code stage/confirm/read path including the Codex review-fix input validation cases. They remain a tracked override in `04-VERIFICATION.md` until run on a Docker-capable machine.

## Solution

On any machine with Docker Desktop installed and running:

```bash
cd "path/to/Gotta Go"
supabase start
supabase db reset   # applies all migrations + loads supabase/seed.sql
supabase test db --local
```

Expected minimum coverage from this todo:

- Phase 3 read RPC suite: 24 assertions.
- Phase 4 submit/pending/withdraw suite: 21 assertions.
- Phase 4 access-code suite: 21 assertions.

If any assertion fails, treat it as a release-blocking SQL/RPC regression to fix immediately before Phase 5 relies further on these paths. Pay particular attention to the Phase 3 CR-02 case (`chill_spot is not false`) and the Phase 4 Codex review-fix cases (direct insert denial, blank/overlong door code rejection, trim-before-stage behavior).
