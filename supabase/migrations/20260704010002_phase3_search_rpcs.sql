-- Phase 3 (03-01 Task 2) — the three SECURITY DEFINER read RPCs (2026-07-04)
--
--   search_locations_bbox     — viewport pin search (index-friendly envelope cast,
--                                antimeridian split, D-08 null-include filters,
--                                config-driven server-authoritative pin cap)
--   search_locations_nearby   — nearest-N by ST_Distance meters (<-> KNN order)
--   get_location_detail       — single public-safe row + server-computed distance_m
--
-- All three are the SOLE read path for public.locations (base-table SELECT was
-- revoked from anon/authenticated in 20260704010000). Each:
--   * runs SECURITY DEFINER STABLE with set search_path = public + schema-qualified
--     refs (Pattern 5 hardening);
--   * reads the caller's family_mode server-side via auth.uid() — never a parameter
--     (Pitfall 3), so a modified client cannot spoof it to reveal sensitive rows;
--   * ends in the four-clause moderation filter
--       deleted_at is null AND suppressed_at is null AND shadowban_status = false
--     plus (not v_family or access_sensitivity is distinct from 'sensitive');
--   * returns an EXPLICIT public column list — never `setof locations` / `select l.*`
--     and never access_instructions / shadowban_status / deleted_at / suppressed_at
--     (T-03-01 info-disclosure mitigation; OQ-3: access_instructions omitted until Phase 8).
--
-- Filter conventions mirror get_locations_in_radius (20260624000002) tag vocab
-- (accessibility/wheelchair, amenity/changing_table) but DIVERGE in three reviewed ways:
--   (a) D-08 null-include: a row with missing underlying data is INCLUDED when the
--       filter is active, never hidden (Antigravity MAJOR) — so the plain
--       `(not filter_x or <match>)` is replaced with an explicit "no data" escape branch;
--   (b) bbox uses the INDEX-FRIENDLY envelope cast (column left raw geography, envelope
--       cast to geography) — NOT `coordinates::geometry && ...` which casts the indexed
--       column and forces a seq scan every pan/zoom (Antigravity MAJOR);
--   (c) pin-cap ordering uses CASE confidence_tier / verification_count — never
--       confidence_score (TEXT, Pitfall 2).

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
  -- Server-side family_mode read (never a client param — Pitfall 3).
  if auth.uid() is not null then
    select family_mode into v_family from public.users where id = auth.uid();
  end if;
  v_family := coalesce(v_family, false);

  -- Server-authoritative pin cap from app_config (Codex MEDIUM / D-32).
  select value::integer into v_max_pins from public.app_config where key = 'max_pins_per_viewport';
  v_max_pins := coalesce(v_max_pins, 200);

  if min_lng > max_lng then
    -- Antimeridian crossing (viewport panned across longitude 180): st_makeenvelope
    -- raises when xmin > xmax, so split into two envelopes and union the predicate
    -- (Antigravity MAJOR). Envelope cast to geography; coordinates left raw so the
    -- GiST index is used on both branches.
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
      and (not filter_chill_spot or l.chill_spot = true)
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
    -- Normal (non-crossing) viewport: single envelope, column left raw for the index.
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
      and (not filter_chill_spot or l.chill_spot = true)
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
-- (b) search_locations_nearby — nearest-N by ST_Distance meters (REQ-EMERGENCY / SC4)
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
    and (not filter_chill_spot or l.chill_spot = true)
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
-- (c) get_location_detail — single public-safe row + server-computed distance_m
-- ═══════════════════════════════════════════════════════════════════════════════
-- user_lat/user_lng are OPTIONAL (null defaults): anon callers that omit them still
-- get the row (distance_m null). When supplied, distance_m is computed with the SAME
-- ST_Distance expression as search_locations_nearby — this is the SINGLE server-side
-- source of the LocationDetail peek-tier distance; the client never fabricates it.
-- access_instructions / shadowban_status / deleted_at / suppressed_at are NEVER returned.
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
