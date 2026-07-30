-- Phase 3 code-review fix (2026-07-07) — CR-02
--
-- 20260704010002_phase3_search_rpcs.sql's `filter_chill_spot` clause used strict
-- equality (`l.chill_spot = true`), which violates this project's own documented
-- D-08 null-include contract: a location with unknown/missing chill_spot data
-- must be INCLUDED when the filter is active, not silently excluded. Since
-- `chill_spot` is a nullable boolean, `NULL = true` evaluates to NULL (falsy in
-- a WHERE clause), so rows with no chill_spot data disappeared the moment a
-- user turned the Chill Spot filter on — the exact class of bug D-08 exists to
-- prevent, and the same pattern already correctly applied to `filter_open_now`
-- in the very same functions.
--
-- Fix: replace `l.chill_spot = true` with `l.chill_spot is not false` (null
-- survives, matching filter_open_now's `is_open_now is not false` pattern) in
-- both search_locations_bbox (both antimeridian branches) and
-- search_locations_nearby. Signatures are unchanged — create or replace in
-- place, re-issue the same grants for clarity (idempotent).

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
