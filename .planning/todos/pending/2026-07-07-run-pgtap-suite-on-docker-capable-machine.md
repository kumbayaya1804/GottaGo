---
created: 2026-07-07T08:50:50Z
title: Run pgTAP suite on Docker-capable machine
area: database
files:
  - supabase/tests/phase3_read_rpcs.test.sql
  - .planning/phases/03-read-path-map/03-VERIFICATION.md (accepted override)
---

## Problem

`supabase/tests/phase3_read_rpcs.test.sql` (24 assertions across 10 correctness properties: four-clause moderation, family_mode exclusion, access-code omission, nearest-N ordering, config-driven pin cap, D-08 null-include incl. the CR-02 chill_spot fix, detail distance source, antimeridian handling, update_profile coalesce, base-table SELECT denial) has never executed against a real Postgres/PostGIS instance in any session across Phase 3's lifecycle — this dev environment has no Docker CLI, and `supabase test db --local` requires `supabase start`/`db reset`.

All properties were independently verified correct by direct SQL reading across two review passes (pre-execution cross-AI review + post-execution code review), and the code-review pass did catch one real bug this way (CR-02, chill_spot null-include violation, since fixed). But static reading is not a substitute for a passing test run — accepted as a tracked override in `03-VERIFICATION.md` (2026-07-07) specifically so this isn't silently forgotten before Phase 4 builds more RPCs on top of this same read path.

## Solution

On any machine with Docker Desktop installed and running:

```bash
cd "path/to/Gotta Go"
supabase start
supabase db reset   # applies all migrations + loads supabase/seed.sql
supabase test db --local
```

If any assertion fails, treat it as a Phase 3 regression to fix immediately — do not let Phase 4 build on top of an unverified read-path foundation. Pay particular attention to the CR-02 case (test lines ~127-131, `chill_spot is not false`) since it's the newest addition and has the least real-world mileage.
