-- Phase 3 (03-01 Task 3) — pgTAP correctness suite for the read path
-- Run locally with:  supabase test db
--
-- Asserts, against the local `supabase db reset` seed fixtures (supabase/seed.sql):
--   1  moderation exclusion — suppressed/shadowbanned/deleted rows absent from bbox + nearby
--   2  family_mode exclusion — sensitive visible to anon, hidden from family_mode=true caller
--   3  access-code omission — get_location_detail exposes no access_instructions column
--   4  nearest-N ordering — search_locations_nearby ascending by distance_m
--   5  config-driven pin cap — bbox clamps to app_config.max_pins_per_viewport server-side
--   6  D-08 null-include — null open_now / null confidence_tier / no-tag rows survive active filters
--   7  detail distance source — distance_m non-null with coords, null without
--   8  antimeridian — min_lng > max_lng raises no exception, returns both sides of lng 180
--   9  update_profile coalesce — family-mode-only call never nulls display_name (and vice versa)
--   10 base-table SELECT denied — anon + authenticated cannot .select() locations directly
--
-- Eugene bbox used throughout: (-123.15, 44.03) .. (-123.05, 44.07) — covers seed rows 01-12,15.

begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- ─── Fixture: a family_mode=true authenticated test user ─────────────────────
-- Inserting into auth.users fires the on_auth_user_created trigger, which provisions
-- the public.users row (id+email). We then flip family_mode on for tests #2/#9.
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000',
        'a0000000-0000-0000-0000-000000000001',
        'authenticated', 'authenticated', 'phase3-seedtest@example.com');
update public.users
  set family_mode = true, display_name = 'InitialName'
  where id = 'a0000000-0000-0000-0000-000000000001';

-- ═══ 1. Moderation exclusion (suppressed / shadowbanned / deleted) ═══════════
select is(
  (select count(*) from public.search_locations_bbox(-123.15, 44.03, -123.05, 44.07)
     where id in ('10000000-0000-0000-0000-000000000006',   -- suppressed
                  '10000000-0000-0000-0000-000000000007',   -- shadowbanned
                  '10000000-0000-0000-0000-000000000008')), -- deleted
  0::bigint,
  'search_locations_bbox excludes suppressed/shadowbanned/deleted rows');

select is(
  (select count(*) from public.search_locations_nearby(44.0521, -123.0930, 50)
     where id in ('10000000-0000-0000-0000-000000000006',
                  '10000000-0000-0000-0000-000000000007',
                  '10000000-0000-0000-0000-000000000008')),
  0::bigint,
  'search_locations_nearby excludes suppressed/shadowbanned/deleted rows');

-- ═══ 2. family_mode exclusion of access_sensitivity = 'sensitive' ════════════
select is(
  (select count(*) from public.search_locations_bbox(-123.15, 44.03, -123.05, 44.07)
     where id = '10000000-0000-0000-0000-000000000005'),
  1::bigint,
  'anon / family_mode=false caller SEES access_sensitivity=sensitive rows');

select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
select is(
  (select count(*) from public.search_locations_bbox(-123.15, 44.03, -123.05, 44.07)
     where id = '10000000-0000-0000-0000-000000000005'),
  0::bigint,
  'family_mode=true caller CANNOT see access_sensitivity=sensitive rows (server-side via auth.uid())');
select set_config('request.jwt.claims', '', true);

-- ═══ 3. get_location_detail never exposes access_instructions ════════════════
select throws_ok(
  $$ select access_instructions from public.get_location_detail('10000000-0000-0000-0000-000000000001') $$,
  '42703',
  null,
  'get_location_detail exposes no access_instructions column (undefined_column)');

-- ═══ 4. search_locations_nearby orders ascending by distance_m ═══════════════
select ok(
  (
    select coalesce(bool_and(distance_m >= prev_dm), true)
    from (
      select distance_m, lag(distance_m) over (order by rn) as prev_dm
      from (
        select distance_m, row_number() over () as rn
        from public.search_locations_nearby(44.0521, -123.0930, 20)
      ) s
    ) t
    where prev_dm is not null
  ),
  'search_locations_nearby returns rows ordered by ascending distance_m');

-- ═══ 5. Pin cap is read server-side from app_config (not just the passed arg) ═
update public.app_config set value = '2' where key = 'max_pins_per_viewport';
select is(
  (select count(*) from public.search_locations_bbox(
     -123.15, 44.03, -123.05, 44.07, false, false, false, false, false, 200)),
  2::bigint,
  'bbox clamps to app_config max_pins (=2) server-side; client max_pins=200 cannot exceed it');
update public.app_config set value = '200' where key = 'max_pins_per_viewport';

-- ═══ 6. D-08 null-include across open_now / confidence / tags ════════════════
select is(
  (select count(*) from public.search_locations_bbox(
     -123.15, 44.03, -123.05, 44.07, true, false, false, false, false)
     where id = '10000000-0000-0000-0000-000000000011'),   -- is_open_now = null
  1::bigint,
  'D-08: null is_open_now row INCLUDED when filter_open_now is active');

select is(
  (select count(*) from public.search_locations_bbox(
     -123.15, 44.03, -123.05, 44.07, false, false, false, false, true)
     where id = '10000000-0000-0000-0000-000000000010'),   -- confidence_tier = null
  1::bigint,
  'D-08: null confidence_tier row INCLUDED when filter_high_conf is active');

select is(
  (select count(*) from public.search_locations_bbox(
     -123.15, 44.03, -123.05, 44.07, false, false, true, false, false)
     where id = '10000000-0000-0000-0000-000000000009'),   -- no tags at all
  1::bigint,
  'D-08: no-tag row INCLUDED when filter_wheelchair is active');

select is(
  (select count(*) from public.search_locations_bbox(
     -123.15, 44.03, -123.05, 44.07, false, false, false, true, false)
     where id = '10000000-0000-0000-0000-000000000009'),   -- no tags at all
  1::bigint,
  'D-08: no-tag row INCLUDED when filter_changing is active');

select is(
  (select count(*) from public.search_locations_bbox(
     -123.15, 44.03, -123.05, 44.07, false, true, false, false, false)
     where id = '10000000-0000-0000-0000-000000000016'),   -- chill_spot = null
  1::bigint,
  'D-08 / CR-02: null chill_spot row INCLUDED when filter_chill_spot is active');

-- ═══ 7. get_location_detail distance_m source ════════════════════════════════
select isnt(
  (select distance_m from public.get_location_detail(
     '10000000-0000-0000-0000-000000000001', 44.0400, -123.0800)),
  null,
  'get_location_detail returns non-null distance_m when user coords are supplied');

select is(
  (select distance_m from public.get_location_detail(
     '10000000-0000-0000-0000-000000000001')),
  null,
  'get_location_detail returns null distance_m when user coords are omitted');

-- ═══ 8. Antimeridian crossing (min_lng > max_lng) ════════════════════════════
select lives_ok(
  $$ select * from public.search_locations_bbox(179, -1, -179, 1) $$,
  'antimeridian-crossing bbox (min_lng > max_lng) raises no exception');

select is(
  (select count(*) from public.search_locations_bbox(179, -1, -179, 1)
     where id in ('10000000-0000-0000-0000-000000000013',   -- lng 179.9
                  '10000000-0000-0000-0000-000000000014')), -- lng -179.9
  2::bigint,
  'antimeridian bbox returns rows on BOTH sides of longitude 180');

-- ═══ 9. update_profile coalesce independence (both reviewers) ════════════════
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

-- family-mode-only call must NOT null display_name
select public.update_profile(new_family_mode := false);
select is(
  (select display_name from public.users where id = 'a0000000-0000-0000-0000-000000000001'),
  'InitialName',
  'update_profile(new_family_mode:=...) leaves display_name unchanged (coalesce)');
select is(
  (select family_mode from public.users where id = 'a0000000-0000-0000-0000-000000000001'),
  false,
  'update_profile(new_family_mode:=false) updates only family_mode');

-- display-name-only call must NOT change family_mode
select public.update_profile(new_display_name := 'RenamedUser');
select is(
  (select family_mode from public.users where id = 'a0000000-0000-0000-0000-000000000001'),
  false,
  'update_profile(new_display_name:=...) leaves family_mode unchanged (coalesce)');
select is(
  (select display_name from public.users where id = 'a0000000-0000-0000-0000-000000000001'),
  'RenamedUser',
  'update_profile(new_display_name:=...) updates only display_name');

select set_config('request.jwt.claims', '', true);

-- ═══ 10. Base-table SELECT on locations denied for anon + authenticated ══════
set local role anon;
select throws_ok(
  $$ select 1 from public.locations limit 1 $$,
  '42501',
  null,
  'anon role cannot SELECT the locations base table directly (RPC-only read path)');
reset role;

set local role authenticated;
select throws_ok(
  $$ select 1 from public.locations limit 1 $$,
  '42501',
  null,
  'authenticated role cannot SELECT the locations base table directly (RPC-only read path)');
reset role;

select * from finish();
rollback;
