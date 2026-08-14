-- Phase 5 (05-02 Task 2a) — numeric confidence authority on public.locations (D-53),
-- backfilled from the legacy text tiers, with every public reader deriving its
-- display label from the numeric column through an app_config-aware helper.
-- (2026-07-31)
--
-- Section 1 — locations.confidence_value numeric + 0..100 CHECK (the authority).
-- Section 2 — backfill from the legacy text tiers (Task-1-locked mapping).
-- Section 3 — confidence_tier_for(numeric) helper (single tier-derivation definition).
-- Section 4 — deprecate the legacy text columns (comments only; no drop).
-- Section 5 — rewrite the three public readers to derive the tier from the numeric.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY A HELPER AND NOT A GENERATED COLUMN (Pitfall 2)
-- ─────────────────────────────────────────────────────────────────────────────
-- D-54 requires the tier cutoffs to be app_config-tunable. A PostgreSQL generated
-- column expression must be IMMUTABLE and cannot query another table, so an
-- "app_config-backed generated confidence_tier" is impossible by construction. This
-- migration therefore does NOT promise one: confidence_value is a plain writable
-- numeric authority, and the tier is derived at READ time by
-- public.confidence_tier_for(), which reads the live thresholds.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SOURCE OF THE REWRITTEN READER BODIES — READ THIS BEFORE EDITING
-- ─────────────────────────────────────────────────────────────────────────────
-- The three reader bodies in Section 5 are copied from the LATEST shipped versions in
-- 20260730000000_fix_ambiguous_id_in_search_rpcs.sql — NOT from 20260704010002
-- (original) and NOT from 20260710010000 (PostGIS qualification pass). Both older
-- files carry the `column reference "id" is ambiguous` defect (SQLSTATE 42702) that
-- broke every AUTHENTICATED caller of these RPCs for 26 days; it propagated precisely
-- because each remediation copied the previous body forward. Starting from the wrong
-- file here would silently reintroduce a fixed production outage.
--
-- Preserved verbatim from that latest body: the alias-qualified family_mode lookup
-- (`from public.users u where u.id = auth.uid()`), the D-08 null-include filters
-- including `chill_spot is not false` (from 20260707010000), the extensions.-qualified
-- PostGIS calls and OPERATOR(extensions.&&) / OPERATOR(extensions.<->) forms, the
-- four-clause moderation filter, the explicit public-safe column lists, and the grants.
--
-- ONLY the confidence handling changes, in exactly three places per reader:
--   (a) SELECT list — `l.confidence_tier` becomes
--       `public.confidence_tier_for(l.confidence_value)`; the OUTPUT COLUMN NAME and
--       type (confidence_tier text) are unchanged, so no client contract breaks.
--   (b) filter_high_conf — `l.confidence_tier is null or l.confidence_tier = 'High'`
--       becomes `l.confidence_value is null or confidence_tier_for(...) = 'High'`.
--       The D-08 null-include escape is PRESERVED: a location with no confidence data
--       is still INCLUDED when the filter is active, never hidden.
--   (c) ORDER BY — the `case l.confidence_tier when 'High' then 3 ...` ladder becomes
--       `l.confidence_value desc nulls last`. This orders on the numeric authority
--       (finer-grained than three buckets) and never orders on TEXT (Pitfall 2).
--       `nulls last` reproduces the old ladder's `else 0` placement for null tiers.
--
-- PERFORMANCE NOTE: confidence_tier_for() is called per returned row and performs two
-- primary-key lookups against the ~14-row app_config table (fully cached, single
-- page). It is deliberately NOT inlined into each reader as duplicated threshold
-- logic: a second copy of the cutoff ladder is exactly the kind of duplicate that has
-- drifted in this codebase before. One definition, read at most 200 times per
-- viewport query, is the correct trade. (A `SET search_path` clause also blocks
-- PostgreSQL's SQL-function inlining, but the hardening contract takes precedence.)

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 1 — locations.confidence_value: the single writable confidence authority
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.locations
  add column if not exists confidence_value numeric;

alter table public.locations
  drop constraint if exists locations_confidence_value_range;
alter table public.locations
  add constraint locations_confidence_value_range
  check (confidence_value is null or (confidence_value >= 0 and confidence_value <= 100));

comment on column public.locations.confidence_value is
  'Canonical numeric confidence, 0-100 (D-53). The SINGLE writable authority. NULL means "no confidence data yet" and is treated as null-include by the D-08 filters. Display tiers are derived at read time via public.confidence_tier_for(); never threshold or order on the legacy text columns (Pitfall 2).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 2 — backfill from the legacy text tiers (Task-1-locked mapping)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mapping locked at the 05-02 Task 1 decision checkpoint. Each value sits mid-band
-- for the Task-1 cutoffs (High >= 70, Medium >= 40, Low < 40), so every backfilled
-- row round-trips back to the tier label it came from:
--
--   'High'   -> 85   (>= 70            -> 'High')
--   'Medium' -> 55   (>= 40 and < 70   -> 'Medium')
--   'Low'    -> 20   (< 40             -> 'Low')
--   NULL / unrecognized -> NULL (left as-is; see below)
--
-- NULL MUST STAY NULL. Phase 3's readers treat a null tier as PASSING the
-- filter_high_conf filter (`... or l.confidence_tier is null or ... = 'High'`, the
-- D-08 null-include rule). Backfilling null-tier rows to a numeric Medium would flip
-- them from INCLUDED to EXCLUDED under that filter — a live behavior regression on
-- existing production rows. Section 5's rewritten filter keeps the same null-include
-- escape on confidence_value, so null -> null is behavior-preserving end to end.
--
-- confidence_tier is preferred as the source; confidence_score (also a text tier
-- label per docs/schema-contract.md:77) is the fallback when tier is absent.
-- Guarded by `confidence_value is null` so a re-run never overwrites live values.
--
-- Codex round-2 finding: phase5_confidence.test.sql keeps a verbatim copy of this
-- statement to test the actual backfill mapping (fixtures inserted post-migration
-- can't otherwise exercise it). The BACKFILL-STATEMENT-BEGIN/END markers below let
-- supabase/scripts/verify-confidence-backfill-binding.test.js extract and diff both
-- copies byte-for-byte and fail loudly the moment they diverge — an executable
-- binding, not just a comment asking future editors to keep them in sync by hand.
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 3 — confidence_tier_for(): the single tier-derivation definition
-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER so the derivation is identical for anon and authenticated callers
-- regardless of any future app_config RLS change. STABLE (reads only). Fixed-empty
-- search_path with every object schema-qualified, per the Phase 5 hardening contract.
-- Fallbacks match the Task-1-locked values seeded in 20260731000000; they are
-- defensive only, never an independent source of truth.
create or replace function public.confidence_tier_for(p_value numeric)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when p_value is null then null
    when p_value >= coalesce(
           (select c.value::numeric from public.app_config c where c.key = 'confidence_high_threshold'), 70)
      then 'High'
    when p_value >= coalesce(
           (select c.value::numeric from public.app_config c where c.key = 'confidence_medium_threshold'), 40)
      then 'Medium'
    else 'Low'
  end;
$$;

comment on function public.confidence_tier_for(numeric) is
  'Derives the High/Medium/Low display label from locations.confidence_value using the live app_config cutoffs (D-54). The ONLY tier-derivation definition — public readers call this rather than re-implementing the ladder.';

revoke execute on function public.confidence_tier_for(numeric) from public;
grant  execute on function public.confidence_tier_for(numeric) to anon;
grant  execute on function public.confidence_tier_for(numeric) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 4 — deprecate the legacy text columns (documented, not dropped)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Not dropped: unreviewed readers may still reference them, and dropping a column is
-- irreversible on a live database. They are now NON-AUTHORITATIVE and must not be
-- written, thresholded, or ordered on. The separate public.confidence_scores table is
-- likewise NOT the authority (D-53) and is deliberately untouched by this migration.
comment on column public.locations.confidence_tier is
  'DEPRECATED / NON-AUTHORITATIVE as of Phase 5 (D-53). Legacy text tier label. Superseded by confidence_value + public.confidence_tier_for(). Retained only for rollback safety; do not write, threshold, or order on it.';

comment on column public.locations.confidence_score is
  'DEPRECATED / NON-AUTHORITATIVE as of Phase 5 (D-53). Legacy text tier label (never a number, despite the name — Pitfall 2). Superseded by confidence_value. Do not write, threshold, or order on it.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 5 — public readers derive the tier from confidence_value
-- ═══════════════════════════════════════════════════════════════════════════════
-- Bodies copied from 20260730000000 (the LATEST, ambiguity-fixed versions).
-- See the header for the exact three-point diff applied to each.

-- ─── (a) search_locations_bbox ───────────────────────────────────────────────
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
           public.confidence_tier_for(l.confidence_value) as confidence_tier,
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
      and (not filter_high_conf
           or l.confidence_value is null
           or public.confidence_tier_for(l.confidence_value) = 'High')
    order by l.confidence_value desc nulls last,
             l.verification_count desc
    limit least(max_pins, v_max_pins);
  else
    return query
    select l.id,
           l.name,
           extensions.st_y(l.coordinates::extensions.geometry)::double precision as lat,
           extensions.st_x(l.coordinates::extensions.geometry)::double precision as lng,
           l.policy_tag,
           public.confidence_tier_for(l.confidence_value) as confidence_tier,
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
      and (not filter_high_conf
           or l.confidence_value is null
           or public.confidence_tier_for(l.confidence_value) = 'High')
    order by l.confidence_value desc nulls last,
             l.verification_count desc
    limit least(max_pins, v_max_pins);
  end if;
end;
$$;

revoke execute on function public.search_locations_bbox(numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean,boolean,integer) from public;
grant  execute on function public.search_locations_bbox(numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean,boolean,integer) to anon;
grant  execute on function public.search_locations_bbox(numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean,boolean,integer) to authenticated;

-- ─── (b) search_locations_nearby ─────────────────────────────────────────────
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
         public.confidence_tier_for(l.confidence_value) as confidence_tier,
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
    and (not filter_high_conf
         or l.confidence_value is null
         or public.confidence_tier_for(l.confidence_value) = 'High')
  order by l.coordinates OPERATOR(extensions.<->) extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography
  limit result_limit;
end;
$$;

revoke execute on function public.search_locations_nearby(numeric,numeric,integer,boolean,boolean,boolean,boolean,boolean) from public;
grant  execute on function public.search_locations_nearby(numeric,numeric,integer,boolean,boolean,boolean,boolean,boolean) to anon;
grant  execute on function public.search_locations_nearby(numeric,numeric,integer,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- ─── (c) get_location_detail ─────────────────────────────────────────────────
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
         public.confidence_tier_for(l.confidence_value) as confidence_tier,
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
