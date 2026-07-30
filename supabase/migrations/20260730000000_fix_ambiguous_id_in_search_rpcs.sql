-- Live defect fix (2026-07-30) — `column reference "id" is ambiguous` (SQLSTATE 42702)
-- in the three PL/pgSQL search RPCs.
--
-- DEFECT
-- ------
-- search_locations_bbox, search_locations_nearby, and get_location_detail all
-- declare `returns table (id uuid, ...)`. In PL/pgSQL, every RETURNS TABLE output
-- column is implicitly declared as a variable visible throughout the function body.
-- Each function's family_mode lookup was written unqualified:
--
--     select family_mode into v_family from public.users where id = auth.uid();
--
-- so `id` matches BOTH the implicit output-column variable and public.users.id.
-- Under `plpgsql.variable_conflict = error` — PostgreSQL's default, confirmed set
-- to `error` on the live project — this raises at RUNTIME, not at create time,
-- which is why every migration applied cleanly while the functions were broken.
--
-- BLAST RADIUS
-- ------------
-- The failing statement sits inside `if auth.uid() is not null then ... end if`,
-- so ANONYMOUS callers were unaffected and the map's public read path kept working.
-- Every AUTHENTICATED caller of these three RPCs got the exception instead of
-- results — i.e. map viewport search, Nearby list, and location detail were broken
-- for signed-in users only. Live since 20260704010002 shipped (2026-07-04); the
-- 20260710010000 PostGIS fix rewrote these same bodies but carried the defect
-- forward unchanged, so it survived that remediation.
--
-- WHY IT WAS NEVER CAUGHT
-- -----------------------
-- supabase/tests/phase3_read_rpcs.test.sql covers exactly this path but had never
-- been executed — no Docker-capable environment existed in this project until
-- 2026-07-29. Its first-ever run (CI run 30521939613) failed 19/22 subtests on this
-- defect. Independently reproduced against the LIVE database on 2026-07-30 with a
-- read-only, self-aborting DO block that set request.jwt.claims and called
-- search_locations_bbox: SQLSTATE 42702, same DETAIL/CONTEXT as CI.
--
-- FIX
-- ---
-- Alias-qualify the lookup so neither name can be read as the implicit variable:
--
--     select u.family_mode into v_family from public.users u where u.id = auth.uid();
--
-- Chosen over `#variable_conflict use_column`, which would flip resolution semantics
-- for the entire function body rather than disambiguating the one real collision.
--
-- SCOPE / RELATIONSHIP TO THE HISTORICAL MIGRATIONS
-- -------------------------------------------------
-- The identical one-line fix is also applied at point of origin in
-- 20260704010002_phase3_search_rpcs.sql, 20260707010000_phase3_chill_spot_null_include_fix.sql,
-- and 20260710010000_phase3_postgis_schema_qualification_fix.sql, so a from-scratch
-- replay is correct at every intermediate step and the defect cannot be copy-pasted
-- forward again (it propagated through all three files exactly that way). Those
-- migrations are already recorded applied on live and are never re-executed, so this
-- forward migration is what actually repairs the live database.
--
-- The function bodies below are byte-identical to the corrected
-- 20260710010000 bodies — same PostGIS schema qualification, same moderation
-- filters, same D-08 null-include semantics, same grants. Only the family_mode
-- lookup line differs from what is currently live.
--
-- get_locations_in_radius and count_locations_within are deliberately NOT recreated
-- here: 20260710020000 / 20260710030000 dropped them, and this migration must not
-- resurrect a retired, publicly-granted RPC.

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
    select u.family_mode into v_family from public.users u where u.id = auth.uid();
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
    select u.family_mode into v_family from public.users u where u.id = auth.uid();
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
    select u.family_mode into v_family from public.users u where u.id = auth.uid();
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
