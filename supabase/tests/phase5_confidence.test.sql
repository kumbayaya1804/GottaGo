-- Phase 5 (05-02 Task 3) — pgTAP suite for the numeric confidence authority (D-53/54/55).
-- Run locally with:  supabase test db --local     (requires Docker)
--
-- RED until 20260731000100_phase5_confidence_numeric.sql creates the objects below.
-- BLOCKING pre-push gate for Phase 5 — this suite may NOT reuse the Phase 3/4
-- unexecuted-pgTAP carry-forward override.
--
-- Unlike phase5_verify_publish.test.sql, this file mutates NO global app_config row
-- and opens no second session, so plain `supabase test db --local` is correct here.
--
-- Covers:
--   (a) locations.confidence_value exists, is numeric, and enforces the 0..100 CHECK.
--   (b) confidence_tier_for() derives High/Medium/Low from the live app_config
--       cutoffs, including both exact boundaries and the NULL passthrough.
--   (c) The Task-1 backfill mapping round-trips: High->85, Medium->55, Low->20, and
--       NULL stays NULL (the D-08 null-include behavior-preservation requirement).
--   (d) All THREE public readers return the helper-derived tier from confidence_value
--       and no longer read the legacy text column.
--   (e) filter_high_conf keeps its D-08 null-include escape on the numeric column.
--   (f) A newly published location starts MID-tier (D-55), not at the maximum.
--   (g) The fixed-empty-search_path contract holds for confidence_tier_for.

begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- ─── Fixtures ────────────────────────────────────────────────────────────────
-- Inserted as the table owner (RLS/ACL bypassed) — this suite tests derivation
-- logic, not the ACL surface.
insert into public.locations (id, name, coordinates, confidence_value, verification_count)
values
  ('c0000000-0000-0000-0000-000000000001', 'CONF High',   extensions.st_setsrid(extensions.st_makepoint(-123.10, 44.10), 4326)::extensions.geography, 85, 5),
  ('c0000000-0000-0000-0000-000000000002', 'CONF Medium', extensions.st_setsrid(extensions.st_makepoint(-123.11, 44.10), 4326)::extensions.geography, 55, 3),
  ('c0000000-0000-0000-0000-000000000003', 'CONF Low',    extensions.st_setsrid(extensions.st_makepoint(-123.12, 44.10), 4326)::extensions.geography, 20, 1),
  ('c0000000-0000-0000-0000-000000000004', 'CONF Null',   extensions.st_setsrid(extensions.st_makepoint(-123.13, 44.10), 4326)::extensions.geography, null, 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- (a) The numeric authority column + its range CHECK
-- ═══════════════════════════════════════════════════════════════════════════════
select has_column('public', 'locations', 'confidence_value',
  'locations.confidence_value exists (D-53 numeric authority)');

select col_type_is('public', 'locations', 'confidence_value', 'numeric',
  'confidence_value is numeric — never a text tier label (Pitfall 2)');

select throws_ok(
  $$insert into public.locations (name, coordinates, confidence_value)
    values ('CONF over', extensions.st_setsrid(extensions.st_makepoint(-123.2, 44.2), 4326)::extensions.geography, 100.1)$$,
  '23514',
  null,
  'confidence_value > 100 violates the 0..100 CHECK');

select throws_ok(
  $$insert into public.locations (name, coordinates, confidence_value)
    values ('CONF under', extensions.st_setsrid(extensions.st_makepoint(-123.2, 44.2), 4326)::extensions.geography, -0.1)$$,
  '23514',
  null,
  'confidence_value < 0 violates the 0..100 CHECK');

select lives_ok(
  $$insert into public.locations (name, coordinates, confidence_value)
    values ('CONF bound0', extensions.st_setsrid(extensions.st_makepoint(-123.21, 44.2), 4326)::extensions.geography, 0)$$,
  'confidence_value = 0 is inside the CHECK (inclusive lower bound)');

select lives_ok(
  $$insert into public.locations (name, coordinates, confidence_value)
    values ('CONF bound100', extensions.st_setsrid(extensions.st_makepoint(-123.22, 44.2), 4326)::extensions.geography, 100)$$,
  'confidence_value = 100 is inside the CHECK (inclusive upper bound)');

select lives_ok(
  $$insert into public.locations (name, coordinates, confidence_value)
    values ('CONF nullok', extensions.st_setsrid(extensions.st_makepoint(-123.23, 44.2), 4326)::extensions.geography, null)$$,
  'confidence_value NULL is allowed — "no confidence data yet"');

-- ═══════════════════════════════════════════════════════════════════════════════
-- (b) confidence_tier_for() derivation, including exact boundaries
-- ═══════════════════════════════════════════════════════════════════════════════
-- Task-1-locked cutoffs: High >= 70, Medium >= 40, Low < 40.
select is(public.confidence_tier_for(85),   'High',   'value 85 derives High');
select is(public.confidence_tier_for(70),   'High',   'exact high threshold (70) derives High — boundary is inclusive');
select is(public.confidence_tier_for(69.9), 'Medium', 'just below the high threshold derives Medium');
select is(public.confidence_tier_for(55),   'Medium', 'value 55 derives Medium');
select is(public.confidence_tier_for(40),   'Medium', 'exact medium threshold (40) derives Medium — boundary is inclusive');
select is(public.confidence_tier_for(39.9), 'Low',    'just below the medium threshold derives Low');
select is(public.confidence_tier_for(0),    'Low',    'value 0 derives Low');
select is(public.confidence_tier_for(null), null,     'NULL confidence derives a NULL tier, never a fabricated label');

-- ═══════════════════════════════════════════════════════════════════════════════
-- (c) Backfill mapping round-trips (Task-1-locked)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Each backfilled numeric must derive back to the tier label it was mapped from,
-- otherwise the migration silently reclassifies live rows.
select is(public.confidence_tier_for(85), 'High',   'backfill High->85 round-trips to High');
select is(public.confidence_tier_for(55), 'Medium', 'backfill Medium->55 round-trips to Medium');
select is(public.confidence_tier_for(20), 'Low',    'backfill Low->20 round-trips to Low');

-- Codex REQUEST CHANGES (round 1, real finding): the three assertions above only
-- exercise confidence_tier_for()'s DERIVATION ladder — they never prove the
-- migration's own BACKFILL UPDATE (20260731000100_phase5_confidence_numeric.sql
-- Section 2) actually maps legacy rows correctly. Every fixture above is inserted
-- with confidence_value ALREADY populated, so the backfill statement itself is
-- never exercised by this suite; corrupting or removing it would leave this file
-- green. Fixed by re-running the migration's exact backfill statement (verbatim —
-- MUST be kept byte-identical to the migration's Section 2 UPDATE; the guard
-- clause `where confidence_value is null` is what makes this safe to re-run here,
-- the same property that makes the live migration itself idempotent) against
-- FRESH synthetic legacy-shaped rows: confidence_value NULL, with the pre-Phase-5
-- text tier columns set exactly as a real pre-migration row would have been.
insert into public.locations (id, name, coordinates, confidence_value, confidence_tier, confidence_score, verification_count)
values
  ('c0000000-0000-0000-0000-00000000000a', 'CONF legacy High',   extensions.st_setsrid(extensions.st_makepoint(-123.30, 44.10), 4326)::extensions.geography, null, 'High',   null, 1),
  ('c0000000-0000-0000-0000-00000000000b', 'CONF legacy Medium', extensions.st_setsrid(extensions.st_makepoint(-123.31, 44.10), 4326)::extensions.geography, null, 'Medium', null, 1),
  ('c0000000-0000-0000-0000-00000000000c', 'CONF legacy Low',    extensions.st_setsrid(extensions.st_makepoint(-123.32, 44.10), 4326)::extensions.geography, null, 'Low',    null, 1),
  ('c0000000-0000-0000-0000-00000000000d', 'CONF legacy score-fallback', extensions.st_setsrid(extensions.st_makepoint(-123.33, 44.10), 4326)::extensions.geography, null, null, 'High', 1),
  ('c0000000-0000-0000-0000-00000000000e', 'CONF legacy unrecognized',   extensions.st_setsrid(extensions.st_makepoint(-123.34, 44.10), 4326)::extensions.geography, null, 'Extreme', null, 1),
  ('c0000000-0000-0000-0000-00000000000f', 'CONF legacy both-null',      extensions.st_setsrid(extensions.st_makepoint(-123.35, 44.10), 4326)::extensions.geography, null, null,     null, 1);

-- Verbatim copy of 20260731000100_phase5_confidence_numeric.sql Section 2.
-- Codex round-2 finding: a comment asking editors to keep this in sync by hand
-- is not an executable check. The BACKFILL-STATEMENT-BEGIN/END markers (matching
-- the migration's own) let
-- supabase/scripts/verify-confidence-backfill-binding.test.js extract and diff
-- both copies byte-for-byte, failing loudly the moment they diverge.
-- BACKFILL-STATEMENT-BEGIN
update public.locations
   set confidence_value = case coalesce(confidence_tier, confidence_score)
                            when 'High'   then 85
                            when 'Medium' then 55
                            when 'Low'    then 20
                            else null
                          end
 where confidence_value is null;
-- BACKFILL-STATEMENT-END

select is(
  (select confidence_value from public.locations where id = 'c0000000-0000-0000-0000-00000000000a'),
  85::numeric, 'the backfill UPDATE maps a legacy confidence_tier=High row to confidence_value=85');
select is(
  (select confidence_value from public.locations where id = 'c0000000-0000-0000-0000-00000000000b'),
  55::numeric, 'the backfill UPDATE maps a legacy confidence_tier=Medium row to confidence_value=55');
select is(
  (select confidence_value from public.locations where id = 'c0000000-0000-0000-0000-00000000000c'),
  20::numeric, 'the backfill UPDATE maps a legacy confidence_tier=Low row to confidence_value=20');
select is(
  (select confidence_value from public.locations where id = 'c0000000-0000-0000-0000-00000000000d'),
  85::numeric, 'the backfill UPDATE falls back to confidence_score when confidence_tier is absent');
select is(
  (select confidence_value from public.locations where id = 'c0000000-0000-0000-0000-00000000000e'),
  null, 'the backfill UPDATE maps an unrecognized legacy tier value to NULL, not a guessed default');
select is(
  (select confidence_value from public.locations where id = 'c0000000-0000-0000-0000-00000000000f'),
  null, 'the backfill UPDATE leaves a row with no legacy tier data at all as NULL (D-08 null-include preserved)');

-- The `where confidence_value is null` guard must never overwrite an already-set
-- value — this is what makes the live migration safe to re-run/re-apply. Prove it
-- here by re-running the SAME statement again and confirming the fixture rows
-- from section (a) (already non-null, seeded directly, no legacy tier involved)
-- are untouched.
-- BACKFILL-STATEMENT-RERUN-BEGIN
update public.locations
   set confidence_value = case coalesce(confidence_tier, confidence_score)
                            when 'High'   then 85
                            when 'Medium' then 55
                            when 'Low'    then 20
                            else null
                          end
 where confidence_value is null;
-- BACKFILL-STATEMENT-RERUN-END
select is(
  (select confidence_value from public.locations where id = 'c0000000-0000-0000-0000-000000000001'),
  85::numeric, 'the backfill guard never overwrites an already-populated confidence_value on re-run');

-- ═══════════════════════════════════════════════════════════════════════════════
-- (d) All three public readers derive the tier from the numeric column
-- ═══════════════════════════════════════════════════════════════════════════════
-- Each fixture row has confidence_value set but its LEGACY text columns left NULL.
-- A reader still sourcing confidence_tier from the text column would return NULL
-- here, so a non-null 'High' proves the derivation path is actually wired.
select is(
  (select l.confidence_tier
     from public.get_location_detail('c0000000-0000-0000-0000-000000000001') l),
  'High',
  'get_location_detail derives the tier from confidence_value, not the legacy text column');

select is(
  (select b.confidence_tier
     from public.search_locations_bbox(-123.20, 44.05, -123.05, 44.15) b
    where b.id = 'c0000000-0000-0000-0000-000000000002'),
  'Medium',
  'search_locations_bbox derives the tier from confidence_value');

select is(
  (select n.confidence_tier
     from public.search_locations_nearby(44.10, -123.12, 50) n
    where n.id = 'c0000000-0000-0000-0000-000000000003'),
  'Low',
  'search_locations_nearby derives the tier from confidence_value');

-- ═══════════════════════════════════════════════════════════════════════════════
-- (e) filter_high_conf keeps the D-08 null-include escape on the NUMERIC column
-- ═══════════════════════════════════════════════════════════════════════════════
-- This is the behavior-preservation guard for the backfill's NULL -> NULL rule. If
-- null-confidence rows were backfilled to a mid value, or the filter dropped its null
-- escape, this row would vanish from a high-confidence search — a live regression.
select is(
  (select count(*)::integer
     from public.search_locations_bbox(-123.20, 44.05, -123.05, 44.15,
                                       false, false, false, false, true) b
    where b.id = 'c0000000-0000-0000-0000-000000000004'),
  1,
  'a NULL-confidence location is INCLUDED under filter_high_conf (D-08 null-include preserved)');

select is(
  (select count(*)::integer
     from public.search_locations_bbox(-123.20, 44.05, -123.05, 44.15,
                                       false, false, false, false, true) b
    where b.id = 'c0000000-0000-0000-0000-000000000003'),
  0,
  'a Low-confidence location is EXCLUDED under filter_high_conf');

select is(
  (select count(*)::integer
     from public.search_locations_bbox(-123.20, 44.05, -123.05, 44.15,
                                       false, false, false, false, true) b
    where b.id = 'c0000000-0000-0000-0000-000000000001'),
  1,
  'a High-confidence location is INCLUDED under filter_high_conf');

-- ═══════════════════════════════════════════════════════════════════════════════
-- (f) D-55 mid-tier publish start
-- ═══════════════════════════════════════════════════════════════════════════════
-- The seeded start must be strictly below the High cutoff — a freshly published
-- location has real but minimal evidence and must still have headroom to rise.
select ok(
  (select c.value::numeric from public.app_config c where c.key = 'confidence_publish_start')
    < (select c.value::numeric from public.app_config c where c.key = 'confidence_high_threshold'),
  'confidence_publish_start is strictly below the High cutoff (D-55 mid-tier, not maximum)');

select is(
  public.confidence_tier_for(
    (select c.value::numeric from public.app_config c where c.key = 'confidence_publish_start')),
  'Medium',
  'the publish-start value derives the MID tier');

-- ═══════════════════════════════════════════════════════════════════════════════
-- (g) Phase 5 fixed-empty-search_path contract
-- ═══════════════════════════════════════════════════════════════════════════════
select is(
  (select p.proconfig
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'confidence_tier_for'),
  array['search_path=""'],
  'confidence_tier_for pins a fixed EMPTY search_path (Phase 5 hardening contract)');

-- The three recreated public readers are SECURITY DEFINER too. They already qualify every
-- table, PostGIS function, and operator, so they must pin the same fixed EMPTY path.
select is(
  (select p.proconfig
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_locations_bbox'),
  array['search_path=""'],
  'search_locations_bbox pins a fixed EMPTY search_path');
select is(
  (select p.proconfig
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_locations_nearby'),
  array['search_path=""'],
  'search_locations_nearby pins a fixed EMPTY search_path');
select is(
  (select p.proconfig
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_location_detail'),
  array['search_path=""'],
  'get_location_detail pins a fixed EMPTY search_path');

select finish();
rollback;
