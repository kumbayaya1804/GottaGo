-- Gotta Go seed data
-- app_config thresholds are seeded in numbered migrations (20260519020000_fix_schema.sql,
-- 20260704010001_phase3_max_pins_config.sql), NOT here.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 3 (03-01 Task 3) — DEV-ONLY seed locations (D-31)
-- ═══════════════════════════════════════════════════════════════════════════════
-- DEV-ONLY GUARD: this file is loaded ONLY on local `supabase db reset`
-- (config.toml [db.seed] sql_paths = ["./seed.sql"]). It is NEVER applied by
-- `supabase db push`, so these fake rows can never reach the production project
-- (Pitfall 6). No numbered migration contains any location INSERT.
--
-- ~15 fake published locations centered on Eugene, OR (~44.05, -123.09; Claude's
-- discretion per D-31, matching the project Eugene density note) plus deliberate
-- moderation / null-data / antimeridian fixtures for the pgTAP suite:
--   05 → access_sensitivity = 'sensitive'  (family_mode exclusion fixture; A2 sentinel)
--   06 → suppressed_at = now()             (moderation exclusion fixture)
--   07 → shadowban_status = true           (moderation exclusion fixture)
--   08 → deleted_at = now()                (moderation exclusion fixture)
--   09 → no tags                           (D-08 wheelchair/changing null-include)
--   10 → confidence_tier = null            (D-08 high_conf null-include)
--   11 → is_open_now = null                (D-08 open_now null-include)
--   12 → tags accessibility=wheelchair + amenity=changing_table (positive filter match)
--   13/14 → straddle longitude 180 (lng 179.9 / -179.9)  (antimeridian fixtures)

insert into public.locations
  (id, name, coordinates, policy_tag, access_sensitivity, hours, is_open_now,
   confidence_tier, verification_count, last_verified_at, chill_spot,
   suppressed_at, shadowban_status, deleted_at)
values
  ('10000000-0000-0000-0000-000000000001', 'Eugene Public Library',
   st_setsrid(st_makepoint(-123.0930, 44.0521), 4326)::geography,
   'chill_spot', null, '{"mon":"10-18","tue":"10-18"}'::jsonb, true,
   'High', 14, now() - interval '3 days', true, null, false, null),

  ('10000000-0000-0000-0000-000000000002', 'Whiteaker Neighborhood Bar',
   st_setsrid(st_makepoint(-123.1085, 44.0575), 4326)::geography,
   'chill_spot', null, null, true,
   'Medium', 6, now() - interval '10 days', true, null, false, null),

  ('10000000-0000-0000-0000-000000000003', 'UO Erb Memorial Union',
   st_setsrid(st_makepoint(-123.0680, 44.0455), 4326)::geography,
   'public_facility', null, null, true,
   'High', 20, now() - interval '1 day', false, null, false, null),

  ('10000000-0000-0000-0000-000000000004', 'Fifth Street Public Market',
   st_setsrid(st_makepoint(-123.0952, 44.0490), 4326)::geography,
   'purchase_required', null, null, false,
   'Medium', 4, now() - interval '20 days', false, null, false, null),

  -- 05: SENSITIVE — hidden from family_mode=true callers only
  ('10000000-0000-0000-0000-000000000005', 'Shelter Care Restroom',
   st_setsrid(st_makepoint(-123.0902, 44.0538), 4326)::geography,
   'public_facility', 'sensitive', null, true,
   'Low', 2, now() - interval '30 days', false, null, false, null),

  -- 06: SUPPRESSED — hidden from every public RPC
  ('10000000-0000-0000-0000-000000000006', 'Suppressed Gas Station',
   st_setsrid(st_makepoint(-123.0870, 44.0500), 4326)::geography,
   'code_required', null, null, true,
   'Low', 1, now() - interval '40 days', false, now(), false, null),

  -- 07: SHADOWBANNED — hidden from every public RPC
  ('10000000-0000-0000-0000-000000000007', 'Shadowbanned Diner',
   st_setsrid(st_makepoint(-123.0995, 44.0560), 4326)::geography,
   'chill_spot', null, null, true,
   'Medium', 3, now() - interval '5 days', true, null, true, null),

  -- 08: DELETED — hidden from every public RPC
  ('10000000-0000-0000-0000-000000000008', 'Deleted Cafe',
   st_setsrid(st_makepoint(-123.1010, 44.0480), 4326)::geography,
   'chill_spot', null, null, true,
   'Medium', 3, now() - interval '2 days', true, null, false, now()),

  -- 09: NO TAGS — included under active wheelchair/changing filters (D-08)
  ('10000000-0000-0000-0000-000000000009', 'No-Tags Corner Store',
   st_setsrid(st_makepoint(-123.0888, 44.0510), 4326)::geography,
   'purchase_required', null, null, true,
   'High', 8, now() - interval '6 days', false, null, false, null),

  -- 10: NULL confidence_tier — included under active high_conf filter (D-08)
  ('10000000-0000-0000-0000-000000000010', 'Null-Confidence Park Restroom',
   st_setsrid(st_makepoint(-123.0925, 44.0470), 4326)::geography,
   'public_facility', null, null, true,
   null, 5, now() - interval '15 days', false, null, false, null),

  -- 11: NULL is_open_now — included under active open_now filter (D-08)
  ('10000000-0000-0000-0000-000000000011', 'Null-Open Trailhead Facility',
   st_setsrid(st_makepoint(-123.0840, 44.0600), 4326)::geography,
   'public_facility', null, null, null,
   'Medium', 4, now() - interval '8 days', false, null, false, null),

  -- 12: has accessibility=wheelchair + amenity=changing_table tags (positive match)
  ('10000000-0000-0000-0000-000000000012', 'Wheelchair Community Center',
   st_setsrid(st_makepoint(-123.0960, 44.0545), 4326)::geography,
   'public_facility', null, null, true,
   'High', 12, now() - interval '4 days', false, null, false, null),

  -- 13/14: ANTIMERIDIAN — straddle longitude 180 (far from Eugene, lat ~0.1)
  ('10000000-0000-0000-0000-000000000013', 'Antimeridian East Rest Stop',
   st_setsrid(st_makepoint(179.9000, 0.1000), 4326)::geography,
   'public_facility', null, null, true,
   'Medium', 3, now() - interval '9 days', false, null, false, null),

  ('10000000-0000-0000-0000-000000000014', 'Antimeridian West Rest Stop',
   st_setsrid(st_makepoint(-179.9000, 0.1000), 4326)::geography,
   'public_facility', null, null, true,
   'Medium', 3, now() - interval '9 days', false, null, false, null),

  ('10000000-0000-0000-0000-000000000015', 'Downtown Plaza Restroom',
   st_setsrid(st_makepoint(-123.0912, 44.0525), 4326)::geography,
   'chill_spot', null, null, true,
   'Low', 2, now() - interval '12 days', true, null, false, null);

-- Tags for row 12 (positive wheelchair + changing-table filter match).
insert into public.tags (location_id, key, value) values
  ('10000000-0000-0000-0000-000000000012', 'accessibility', 'wheelchair'),
  ('10000000-0000-0000-0000-000000000012', 'amenity',       'changing_table');
