-- Whole-project audit P0-1 fix (2026-07-09 audit, remediated 2026-07-10) — schema-
-- qualify every bare PostGIS type/function/operator reference inside SECURITY
-- DEFINER functions that run under `set search_path = public`.
--
-- PostGIS is installed in the `extensions` schema on this project (verified live),
-- not `public`. A function body that runs with `search_path = public` cannot
-- resolve bare `geography`/`geometry` types, `st_*` functions, or the `&&`/`<->`
-- operators — `extensions` is never implicitly searched the way `pg_catalog` is.
-- This was silently masked in local/CLI sessions that happen to have a wider
-- search_path, but fails at actual call time in production. Confirmed live before
-- this fix (2026-07-10): `select * from public.search_locations_bbox(...)`,
-- `search_locations_nearby(...)`, and `count_locations_within(...)` all raised
-- `42704: type "geometry"/"geography" does not exist` — i.e. THE MAP'S ENTIRE PIN
-- SEARCH PATH WAS BROKEN IN PRODUCTION, not just a latent risk.
--
-- This mirrors the fix already applied to Phase 4's submission RPCs in
-- 20260707020000_phase4_submission_staging.sql (extensions.st_setsrid /
-- extensions.st_makepoint / extensions.st_x / extensions.st_y / extensions.geography).
-- This migration applies the identical convention to the five functions the audit
-- and a full grep of every SECURITY DEFINER migration found still using bare
-- references, `create or replace`-ing each to its current (latest) body:
--
--   search_locations_bbox     (latest body: 20260707010000 chill_spot null-include fix)
--   search_locations_nearby   (latest body: 20260707010000 chill_spot null-include fix)
--   get_location_detail       (latest body: 20260704010002, unchanged since)
--   get_locations_in_radius   (latest body: 20260624000002 ratings privacy fix;
--                              superseded by search_locations_* for current client
--                              use per `grep -rn "get_locations_in_radius" app/src`
--                              returning zero matches, but still live, still
--                              granted to anon/authenticated, and still broken —
--                              fixed rather than left as a dead but callable trap)
--   count_locations_within    (latest body: 20260624000002 ratings privacy fix;
--                              same legacy/unused-but-live status as above)
--
-- No query logic changes: filter semantics, moderation clauses, D-08 null-include
-- behavior, and grants are byte-for-byte identical to each function's current
-- body. Only type casts (`::extensions.geography`, `::extensions.geometry`),
-- function calls (`extensions.st_y`, `extensions.st_x`, `extensions.st_distance`,
-- `extensions.st_dwithin`, `extensions.st_setsrid`, `extensions.st_makepoint`,
-- `extensions.st_makeenvelope`), and operators (`OPERATOR(extensions.&&)`,
-- `OPERATOR(extensions.<->)`) are qualified. `OPERATOR(schema.op)` is required
-- because bare infix operator symbols resolve via search_path exactly like
-- function names do — confirmed live that `&&` and `<->` for geography/geometry
-- are defined in `extensions`, not `pg_catalog` (which alone is always implicit).

-- ═══════════════════════════════════════════════════════════════════════════════
-- (a) search_locations_bbox
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.search_locations_bbox(
  min_lng           numeric,
  min_lat           numeric,
  max_lng           numeric,
  max_lat           numeric,
  filter_open_now   boolean default false,
  filter_chill_spot boolean default false,
  filter_wheelchair boolean default false,
  filter_changing   boolean default false,
  filter_high_conf  boolean default false,
  max_pins          integer default 200
)
returns table (
  id                 uuid,
  name               text,
  lat                double precision,
  lng                double precision,
  policy_tag         text,
  confidence_tier    text,
  verification_count integer,
  last_verified_at   timestamptz,
  is_open_now        boolean,
  chill_spot         boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_family   boolean := false;
  v_max_pins integer;
begin
  if auth.uid() is not null then
    select family_mode into v_family from public.users where id = auth.uid();
  end if;
  v_family := coalesce(v_family, false);

  select value::integer into v_max_pins from public.app_config where key = 'max_pins_per_viewport';
  v_max_pins := coalesce(v_max_pins, 200);

  if min_lng > max_lng then
    return query
    select l.id,
           l.name,
           extensions.st_y(l.coordinates::extensions.geometry)::double precision as lat,
           extensions.st_x(l.coordinates::extensions.geometry)::double precision as lng,
           l.policy_tag,
           l.confidence_tier,
           l.verification_count,
           l.last_verified_at,
           l.is_open_now,
           l.chill_spot
    from public.locations l
    where (
            l.coordinates OPERATOR(extensions.&&) extensions.st_makeenvelope(min_lng, min_lat, 180, max_lat, 4326)::extensions.geography
            or
            l.coordinates OPERATOR(extensions.&&) extensions.st_makeenvelope(-180, min_lat, max_lng, max_lat, 4326)::extensions.geography
          )
      and l.deleted_at is null
      and l.suppressed_at is null
      and l.shadowban_status = false
      and (not v_family or l.access_sensitivity is distinct from 'sensitive')
      and (not filter_open_now or l.is_open_now is not false)
      and (not filter_chill_spot or l.chill_spot is not false)
      and (not filter_wheelchair
           or not exists (select 1 from public.tags t
                          where t.location_id = l.id and t.key = 'accessibility')
           or exists (select 1 from public.tags t
                      where t.location_id = l.id and t.key = 'accessibility' and t.value = 'wheelchair'))
      and (not filter_changing
           or not exists (select 1 from public.tags t
                          where t.location_id = l.id and t.key = 'amenity')
           or exists (select 1 from public.tags t
                      where t.location_id = l.id and t.key = 'amenity' and t.value = 'changing_table'))
      and (not filter_high_conf or l.confidence_tier is null or l.confidence_tier = 'High')
    order by case l.confidence_tier when 'High' then 3 when 'Medium' then 2 when 'Low' then 1 else 0 end desc,
             l.verification_count desc
    limit least(max_pins, v_max_pins);
  else
    return query
    select l.id,
           l.name,
           extensions.st_y(l.coordinates::extensions.geometry)::double precision as lat,
           extensions.st_x(l.coordinates::extensions.geometry)::double precision as lng,
           l.policy_tag,
           l.confidence_tier,
           l.verification_count,
           l.last_verified_at,
           l.is_open_now,
           l.chill_spot
    from public.locations l
    where l.coordinates OPERATOR(extensions.&&) extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::extensions.geography
      and l.deleted_at is null
      and l.suppressed_at is null
      and l.shadowban_status = false
      and (not v_family or l.access_sensitivity is distinct from 'sensitive')
      and (not filter_open_now or l.is_open_now is not false)
      and (not filter_chill_spot or l.chill_spot is not false)
      and (not filter_wheelchair
           or not exists (select 1 from public.tags t
                          where t.location_id = l.id and t.key = 'accessibility')
           or exists (select 1 from public.tags t
                      where t.location_id = l.id and t.key = 'accessibility' and t.value = 'wheelchair'))
      and (not filter_changing
           or not exists (select 1 from public.tags t
                          where t.location_id = l.id and t.key = 'amenity')
           or exists (select 1 from public.tags t
                      where t.location_id = l.id and t.key = 'amenity' and t.value = 'changing_table'))
      and (not filter_high_conf or l.confidence_tier is null or l.confidence_tier = 'High')
    order by case l.confidence_tier when 'High' then 3 when 'Medium' then 2 when 'Low' then 1 else 0 end desc,
             l.verification_count desc
    limit least(max_pins, v_max_pins);
  end if;
end;
$$;

revoke execute on function public.search_locations_bbox(numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean,boolean,integer) from public;
grant  execute on function public.search_locations_bbox(numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean,boolean,integer) to anon;
grant  execute on function public.search_locations_bbox(numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean,boolean,integer) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- (b) search_locations_nearby
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.search_locations_nearby(
  user_lat          numeric,
  user_lng          numeric,
  result_limit      integer default 20,
  filter_open_now   boolean default false,
  filter_chill_spot boolean default false,
  filter_wheelchair boolean default false,
  filter_changing   boolean default false,
  filter_high_conf  boolean default false
)
returns table (
  id                 uuid,
  name               text,
  lat                double precision,
  lng                double precision,
  policy_tag         text,
  confidence_tier    text,
  verification_count integer,
  last_verified_at   timestamptz,
  is_open_now        boolean,
  chill_spot         boolean,
  distance_m         double precision
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_family boolean := false;
begin
  if auth.uid() is not null then
    select family_mode into v_family from public.users where id = auth.uid();
  end if;
  v_family := coalesce(v_family, false);

  return query
  select l.id,
         l.name,
         extensions.st_y(l.coordinates::extensions.geometry)::double precision as lat,
         extensions.st_x(l.coordinates::extensions.geometry)::double precision as lng,
         l.policy_tag,
         l.confidence_tier,
         l.verification_count,
         l.last_verified_at,
         l.is_open_now,
         l.chill_spot,
         extensions.st_distance(l.coordinates,
                     extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography)::double precision as distance_m
  from public.locations l
  where l.deleted_at is null
    and l.suppressed_at is null
    and l.shadowban_status = false
    and (not v_family or l.access_sensitivity is distinct from 'sensitive')
    and (not filter_open_now or l.is_open_now is not false)
    and (not filter_chill_spot or l.chill_spot is not false)
    and (not filter_wheelchair
         or not exists (select 1 from public.tags t
                        where t.location_id = l.id and t.key = 'accessibility')
         or exists (select 1 from public.tags t
                    where t.location_id = l.id and t.key = 'accessibility' and t.value = 'wheelchair'))
    and (not filter_changing
         or not exists (select 1 from public.tags t
                        where t.location_id = l.id and t.key = 'amenity')
         or exists (select 1 from public.tags t
                    where t.location_id = l.id and t.key = 'amenity' and t.value = 'changing_table'))
    and (not filter_high_conf or l.confidence_tier is null or l.confidence_tier = 'High')
  order by l.coordinates OPERATOR(extensions.<->) extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography
  limit result_limit;
end;
$$;

revoke execute on function public.search_locations_nearby(numeric,numeric,integer,boolean,boolean,boolean,boolean,boolean) from public;
grant  execute on function public.search_locations_nearby(numeric,numeric,integer,boolean,boolean,boolean,boolean,boolean) to anon;
grant  execute on function public.search_locations_nearby(numeric,numeric,integer,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- (c) get_location_detail
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.get_location_detail(location_id uuid, user_lat numeric default null, user_lng numeric default null)
returns table (
  id                 uuid,
  name               text,
  address            text,
  lat                double precision,
  lng                double precision,
  policy_tag         text,
  confidence_tier    text,
  verification_count integer,
  last_verified_at   timestamptz,
  is_open_now        boolean,
  chill_spot         boolean,
  hours              jsonb,
  distance_m         double precision
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_family boolean := false;
begin
  if auth.uid() is not null then
    select family_mode into v_family from public.users where id = auth.uid();
  end if;
  v_family := coalesce(v_family, false);

  return query
  select l.id,
         l.name,
         l.address,
         extensions.st_y(l.coordinates::extensions.geometry)::double precision as lat,
         extensions.st_x(l.coordinates::extensions.geometry)::double precision as lng,
         l.policy_tag,
         l.confidence_tier,
         l.verification_count,
         l.last_verified_at,
         l.is_open_now,
         l.chill_spot,
         l.hours,
         (case
            when user_lat is null or user_lng is null then null
            else extensions.st_distance(l.coordinates,
                             extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography)
          end)::double precision as distance_m
  from public.locations l
  where l.id = location_id
    and l.deleted_at is null
    and l.suppressed_at is null
    and l.shadowban_status = false
    and (not v_family or l.access_sensitivity is distinct from 'sensitive');
end;
$$;

revoke execute on function public.get_location_detail(uuid, numeric, numeric) from public;
grant  execute on function public.get_location_detail(uuid, numeric, numeric) to anon;
grant  execute on function public.get_location_detail(uuid, numeric, numeric) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- (d) get_locations_in_radius — legacy, superseded by search_locations_* for
--     current client use, but still live/granted/broken; fixed rather than left
--     as a dead but callable trap.
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.get_locations_in_radius(
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
returns setof public.locations
language sql
security definer
stable
set search_path = public
as $$
  select l.*
  from public.locations l
  where l.deleted_at is null
    and l.shadowban_status = false
    and extensions.st_dwithin(
          l.coordinates::extensions.geography,
          extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography,
          radius_m
        )
    and (not filter_open_now     or l.is_open_now = true)
    and (not filter_chill_spot   or l.chill_spot = true)
    and (not filter_wheelchair   or exists (
           select 1 from public.tags t
           where t.location_id = l.id
             and t.key = 'accessibility' and t.value = 'wheelchair'
         ))
    and (not filter_changing     or exists (
           select 1 from public.tags t
           where t.location_id = l.id
             and t.key = 'amenity' and t.value = 'changing_table'
         ))
    and (not filter_no_purchase  or exists (
           select 1 from public.tags t
           where t.location_id = l.id
             and t.key = 'purchase_required' and t.value = 'false'
         ))
    and (not filter_gender_neutral or exists (
           select 1 from public.tags t
           where t.location_id = l.id
             and t.key = 'gender' and t.value = 'neutral'
         ))
    and (not filter_high_conf    or l.confidence_tier = 'High')
  order by l.coordinates::extensions.geography OPERATOR(extensions.<->) extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography;
$$;

grant execute on function public.get_locations_in_radius(
  numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to anon;
grant execute on function public.get_locations_in_radius(
  numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- (e) count_locations_within — legacy, same status as (d).
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.count_locations_within(
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
  from public.locations
  where deleted_at is null
    and shadowban_status = false
    and extensions.st_dwithin(
          coordinates::extensions.geography,
          extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography,
          p_radius_m
        );
$$;

grant execute on function public.count_locations_within(numeric, numeric, numeric) to anon;
grant execute on function public.count_locations_within(numeric, numeric, numeric) to authenticated;
