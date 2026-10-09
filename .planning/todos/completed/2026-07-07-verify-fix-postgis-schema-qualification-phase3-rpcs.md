---
created: 2026-07-07T17:45:00Z
title: Verify and fix PostGIS schema-qualification bug in Phase 3's shipped RPCs
area: database
priority: high
files:
  - supabase/migrations/20260704010002_phase3_search_rpcs.sql (search_locations_bbox, search_locations_nearby, get_location_detail)
  - supabase/migrations/20260707010000_phase3_chill_spot_null_include_fix.sql
  - supabase/migrations/20260707020000_phase4_submission_staging.sql (Phase 4's fixed version — reference pattern)
---

## Problem

While pushing Phase 4's `04-01` migration, `supabase db push` failed with:

```
ERROR: type "geography" does not exist (SQLSTATE 42704)
```

Root cause, confirmed via direct SQL against the live project (Supabase MCP `execute_sql`, project `ebmzhjmmtmldhrojkdqw`):

- The `postgis` extension is installed in the `extensions` schema, not `public`.
- Session/role defaults (`postgres`, `supabase_admin`) have `search_path` including `extensions`, so ad-hoc queries and the Supabase MCP `apply_migration`/`execute_sql` tools resolve `geography`/`geometry`/`st_*` fine.
- BUT any session with `search_path` explicitly restricted to `public` — confirmed for both `supabase db push`'s migration-application session AND for any `plpgsql` function declaring `set search_path = public` (this project's own SECURITY DEFINER convention, used everywhere) — does **NOT** resolve those PostGIS types/functions by bare name. Verified directly:
  ```sql
  set search_path = public;
  select 'geography'::regtype;        -- ERROR: type "geography" does not exist
  select 'extensions.geography'::regtype;  -- OK
  select st_makepoint(1,2);           -- ERROR: function st_makepoint(integer, integer) does not exist
  select extensions.st_makepoint(1,2);     -- OK
  ```

Fixed in Phase 4's `04-01` migration by schema-qualifying every reference (`extensions.geography`, `extensions.geometry`, `extensions.st_setsrid`, `extensions.st_makepoint`, `extensions.st_x`, `extensions.st_y`).

**Phase 3's already-shipped RPCs have the identical bare-reference pattern:**
- `search_locations_bbox` — `set search_path = public`, uses bare `st_makeenvelope(...)::geography` and `coordinates::geometry` casts.
- `search_locations_nearby` — same pattern, plus `st_setsrid(st_makepoint(...), 4326)::geography` for distance ordering.
- `get_location_detail` — `set search_path = public`, likely has similar distance-calc casts (not yet individually confirmed).

Since these were likely deployed via the Supabase MCP `apply_migration` tool (whose connection has `extensions` on its default search_path) rather than `supabase db push`, `CREATE FUNCTION` succeeded — but plpgsql function bodies aren't validated until first invocation, and the function's own `set search_path = public` clause governs search_path *at call time*, not the deploying session's search_path. **This means these RPCs may be silently broken at runtime right now**, and nothing has caught it: Phase 3's pgTAP suite has never executed (tracked in a separate todo, no Docker), and the 7 device-UAT items (which would exercise these RPCs against real GPS coordinates) are still pending.

## Solution

1. Confirm the bug reproduces: query the live DB directly (Supabase MCP `execute_sql`) calling `search_locations_bbox`/`search_locations_nearby`/`get_location_detail` with real-ish arguments and check whether they actually throw `type "geography" does not exist` / `function st_makepoint(...) does not exist` at runtime, or whether some other mechanism (e.g., an implicit extension search_path override at the database level not caught by the role-config check) saves them.
2. If confirmed broken: write a fix migration schema-qualifying every bare PostGIS type/function reference in the three RPCs (mirror the fix already applied in `supabase/migrations/20260707020000_phase4_submission_staging.sql`), following this project's existing fix-migration pattern (see `20260707010000_phase3_chill_spot_null_include_fix.sql` for precedent).
3. Get fresh, explicit user authorization before pushing the fix live (same rule as every other live push in this project).
4. Re-run this same direct-SQL verification against the fixed RPCs to confirm resolution.
5. Also check any other `set search_path = public` functions across the whole schema for the same bare-reference pattern (grep for `st_[a-z]+\(` and `::geography`/`::geometry` inside `set search_path = public` function bodies) — this could be a systemic issue beyond just the three Phase 3 read RPCs.
