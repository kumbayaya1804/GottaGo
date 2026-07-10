-- Codex CRITICAL remediation coverage (2026-07-10) — prove the legacy Phase 1
-- radius RPCs are gone and the hardened Phase 3 read surface still stands.
-- Run locally with:  supabase test db   (requires Docker — tracked override this env)
--
-- 20260710020000_drop_legacy_radius_rpcs.sql drops `get_locations_in_radius`
-- (SECURITY DEFINER, returned `setof public.locations` = full row including
-- access_instructions / pending_access_code / shadowban_status, granted to anon)
-- and `count_locations_within` (ignored suppressed_at). This suite asserts the
-- deprecated surface no longer exists under ANY signature — so no grant, RLS
-- nuance, or search_path detail can matter — and that the three Phase 3
-- replacement RPCs remain present.

begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- The deprecated functions are gone entirely (any-signature check).
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_locations_in_radius'),
  0,
  'get_locations_in_radius no longer exists in public under any signature');

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'count_locations_within'),
  0,
  'count_locations_within no longer exists in public under any signature');

-- The hardened Phase 3 read RPCs are still the (only) location read surface.
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'search_locations_bbox'),
  'search_locations_bbox still exists');

select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'search_locations_nearby'),
  'search_locations_nearby still exists');

select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'get_location_detail'),
  'get_location_detail still exists');

select * from finish();
rollback;
