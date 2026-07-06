# Phase 3 — Plan 03-01 Summary

**Completed:** 2026-07-06
**Plan:** DB read path — RPCs, moderation column, dev seed, pgTAP suite
**Status:** ALL TASKS COMPLETE — live push done — 03-02 may begin

---

## Commits

| SHA | Description |
|-----|-------------|
| `0e9d76b` | feat(03-01): add locations.suppressed_at + rebuild moderation index + max_pins config |
| `5172db7` | feat(03-01): add three read RPCs + extend update_profile with family_mode |
| `2e698e0` | test(03-01): dev seed + pgTAP read-path suite + regenerated database types (interim) |
| (this session) | fix: migration history reconciliation (see below) + authoritative type regeneration |

---

## Migrations Applied (live — project `ebmzhjmmtmldhrojkdqw`)

| Migration | Name | Status |
|-----------|------|--------|
| 20260704010000 | phase3_suppressed_at | ✓ Applied |
| 20260704010001 | phase3_max_pins_config | ✓ Applied |
| 20260704010002 | phase3_search_rpcs | ✓ Applied |
| 20260704010003 | phase3_family_mode_rpc | ✓ Applied |

**Migration history drift discovered and reconciled during this push:** remote had 5 tracking-table entries (`20260628201030`, `20260628201111`, `20260628201202`, `20260629165253`, `20260629165317`) with no corresponding local file — traced to Phase 2's SQL having been applied directly via the Supabase MCP tool in a prior session, then later captured into properly-named local files (`20260627000000`–`04`) that were never actually pushed via the CLI. Reconciled by: (1) `supabase migration repair --status reverted` on the 5 orphan entries (bookkeeping only, no schema change), (2) a real `supabase db push --include-all` that re-ran all 5 Phase 2 files (idempotent — `drop trigger if exists`/`create or replace`/`create index if not exists`; one `NOTICE: relation already exists, skipping` on the unique index, no errors) plus the 4 Phase 3 files fresh. Local and remote migration history now match exactly (16/16). This drift was pre-existing and unrelated to Phase 3 — flagging here since it blocked this plan's push and future phases should be aware the CLI/MCP-applied-migration reconciliation pattern can recur.

---

## RPC Signatures

```sql
search_locations_bbox(
  min_lng numeric, min_lat numeric, max_lng numeric, max_lat numeric,
  filter_open_now boolean default false, filter_chill_spot boolean default false,
  filter_wheelchair boolean default false, filter_changing boolean default false,
  filter_high_conf boolean default false, max_pins integer default 200
) returns table (id uuid, name text, lat float8, lng float8, policy_tag text,
  confidence_tier text, verification_count int, last_verified_at timestamptz,
  is_open_now bool, chill_spot bool)

search_locations_nearby(
  user_lat numeric, user_lng numeric, result_limit integer default 20,
  <same filter params as bbox>
) returns <same columns> + distance_m float8

get_location_detail(
  location_id uuid, user_lat numeric default null, user_lng numeric default null
) returns (id, name, address, lat, lng, policy_tag, confidence_tier, verification_count,
  last_verified_at, is_open_now, chill_spot, hours jsonb, distance_m float8)
-- distance_m is null when user_lat/user_lng are omitted; NO access_instructions field ever returned.

update_profile(
  new_display_name text default null, new_family_mode boolean default null
) returns void
-- Both args optional; body uses coalesce() on both columns — a family-mode-only call
-- leaves display_name untouched (this was the shared Antigravity+Codex review finding).
```

Grants: all three read RPCs → `anon` + `authenticated`. `update_profile` → `authenticated` only (revoked from `public` + `anon`).

**Security fix applied beyond the plan's original scope (caught by gsd-plan-checker, not either external reviewer):** `revoke select on public.locations from anon;` and `...from authenticated;` — the base table's `locations_select_public` RLS policy previously allowed direct `.from('locations').select()` calls to bypass all three RPCs' protections (including the access-code column and the family_mode filter). This project had already fixed the identical bug class on `ratings` and `availability_flags`; `locations` now gets the same treatment. All location reads must go through the RPCs.

---

## Seed Fixtures (`supabase/seed.sql` — dev/local only, loaded on `db reset`, never on `db push`)

~15 fake locations centered near Eugene, OR (lat ~44.05, lng ~-123.09), including deliberate moderation/edge-case fixtures:
- One row with `access_sensitivity = 'sensitive'` (**the exact sentinel value** — comment-tagged `A2 sentinel` in seed.sql, row `05`) for family_mode-exclusion testing
- One `suppressed_at = now()` row, one `shadowban_status = true` row, one `deleted_at = now()` row
- Null-tag / null-confidence_tier / null-is_open_now rows (D-08 null-include testing)
- A longitude-180-straddling pair (antimeridian test case)

---

## pgTAP Suite (`supabase/tests/phase3_read_rpcs.test.sql`)

21 assertions across 10 correctness properties: four-clause moderation exclusion, family_mode exclusion, access-code omission, nearest-N distance ordering, config-driven pin cap (`app_config.max_pins_per_viewport` read server-side + `least()` clamp), D-08 null-include (3 sub-cases), `get_location_detail` distance_m source, antimeridian crossing (no exception + correct rows), `update_profile` coalesce (family-mode-only vs display-name-only calls), and base-table SELECT denial for both `anon`/`authenticated`.

## ⚠️ pgTAP Suite NOT YET EXECUTED — Docker Unavailable in This Environment

`supabase test db --local` requires a local Postgres via `supabase start`/`db reset` (which is also how `seed.sql` gets loaded — by design, never against the live project). This environment has no Docker CLI installed at all, so the local stack cannot be started here. **The pgTAP suite has been written and reviewed for correctness (SQL patterns verified against the plan's required fixes) but has NOT been executed.** Before treating Wave 1 as fully verified, run on a machine with Docker Desktop installed:

```bash
supabase start
supabase db reset   # loads migrations + seed.sql
supabase test db --local
```

Report any failures back before proceeding further, or treat this as a standing gap to close before Phase 3's final verification.

---

## database.types.ts

Regenerated authoritatively via `supabase gen types typescript --linked` against the live post-push schema (replacing the executor's earlier interim hand-written version). Confirmed present: `search_locations_bbox`, `search_locations_nearby`, `get_location_detail` (with `user_lat`/`user_lng` args + `distance_m` return), `suppressed_at`. `cd app && npx tsc --noEmit` passes clean.

---

## What 03-02 Starts With

- Three read RPCs live and callable: `search_locations_bbox`, `search_locations_nearby`, `get_location_detail`
- `update_profile` extended with optional `family_mode` (existing Phase 2 display-name-only call sites unaffected)
- `app_config.max_pins_per_viewport` = 200, server-enforced
- `locations.suppressed_at` column + rebuilt GiST index + base-table SELECT lockdown live
- `app/src/lib/database.types.ts` authoritative and current
- **Outstanding:** pgTAP suite needs a Docker-capable environment to actually execute (see above)
