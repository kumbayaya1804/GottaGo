-- Phase 1 Antigravity REQUEST CHANGES fix (2026-06-24)
--
-- Addresses findings from Antigravity review of 000000_block_fixes.sql:
--
-- MAJOR (000000:37): revoke on ratings was anon-only. Authenticated users could
-- still query the base ratings table directly and recover user_id (rater identity),
-- defeating the privacy fix. Both roles must be revoked.
--
-- MINOR (000000:99,126): ST_Point without explicit SRID is inconsistent with the
-- pattern documented in 000001's WR-01 note. Recreate both functions using
-- ST_SetSRID(ST_MakePoint(...), 4326)::geography for SRID explicitness.

-- ─── 1. Revoke base-table SELECT from authenticated ──────────────────────────
revoke select on ratings from authenticated;

-- ─── 2. Recreate get_locations_in_radius with explicit SRID ──────────────────
create or replace function get_locations_in_radius(
  user_lat              numeric,
  user_lng              numeric,
  radius_m              numeric  default 5000,
  filter_open_now       boolean  default false,
  filter_chill_spot     boolean  default false,
  filter_wheelchair     boolean  default false,
  filter_changing       boolean  default false,
  filter_no_purchase    boolean  default false,
  filter_gender_neutral boolean  default false,
  filter_high_conf      boolean  default false
)
returns setof locations
language sql
security definer
stable
set search_path = public
as $$
  select l.*
  from locations l
  where l.deleted_at is null
    and l.shadowban_status = false
    and st_dwithin(
          l.coordinates::geography,
          st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
          radius_m
        )
    and (not filter_open_now     or l.is_open_now = true)
    and (not filter_chill_spot   or l.chill_spot = true)
    and (not filter_wheelchair   or exists (
           select 1 from tags t
           where t.location_id = l.id
             and t.key = 'accessibility' and t.value = 'wheelchair'
         ))
    and (not filter_changing     or exists (
           select 1 from tags t
           where t.location_id = l.id
             and t.key = 'amenity' and t.value = 'changing_table'
         ))
    and (not filter_no_purchase  or exists (
           select 1 from tags t
           where t.location_id = l.id
             and t.key = 'purchase_required' and t.value = 'false'
         ))
    and (not filter_gender_neutral or exists (
           select 1 from tags t
           where t.location_id = l.id
             and t.key = 'gender' and t.value = 'neutral'
         ))
    and (not filter_high_conf    or l.confidence_tier = 'High')
  order by l.coordinates::geography <-> st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography;
$$;

grant execute on function get_locations_in_radius(
  numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to anon;
grant execute on function get_locations_in_radius(
  numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to authenticated;

-- ─── 3. Recreate count_locations_within with explicit SRID ───────────────────
create or replace function count_locations_within(
  p_lat      numeric,
  p_lon      numeric,
  p_radius_m numeric default 5000
)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)
  from locations
  where deleted_at is null
    and shadowban_status = false
    and st_dwithin(
          coordinates::geography,
          st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography,
          p_radius_m
        );
$$;

grant execute on function count_locations_within(numeric, numeric, numeric) to anon;
grant execute on function count_locations_within(numeric, numeric, numeric) to authenticated;
