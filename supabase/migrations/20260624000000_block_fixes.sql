-- Block fixes: RLS security hardening + missing DB objects
-- Addresses Antigravity BLOCK verdict on Phase 1 retrospective review (2026-06-24).
--
-- Apply to remote:
--   supabase db push (applies to linked remote project)
-- Or mark as applied if RLS fixes were already made via Studio:
--   supabase migration repair --status applied 20260624000000
--
-- NOTE: respect_signal_90d view, get_locations_in_radius, and count_locations_within
-- already exist on the live remote (TypeScript types were generated from them).
-- create or replace / drop if exists make these idempotent on re-run.

-- ─── 1. locations: remove bypass-submissions insert policy ───────────────────
-- locations_insert_auth let any authenticated user INSERT directly to locations,
-- bypassing the submissions table and the 2-verification publication gate entirely.
-- All location creation must go through submissions → verification → RPC publish path.
drop policy if exists "locations_insert_auth" on locations;

-- ─── 2. submissions: remove unconstrained self-update policy ─────────────────
-- submissions_update_own let users UPDATE any column of their own submission,
-- including status (→ 'published') and confirmation_count. State transitions must
-- go through service-role or SECURITY DEFINER RPCs only.
drop policy if exists "submissions_update_own" on submissions;

-- ─── 3. ratings: remove rater identity exposure ──────────────────────────────
-- ratings_select_public used (true), exposing user_id (rater identity) to anyone.
-- Rater identity is PII and must not be public per SPEC.md privacy rules.
drop policy if exists "ratings_select_public" on ratings;

-- Authenticated users retain access to their own ratings (for display/editing).
create policy "ratings_select_own"
  on ratings for select
  using (auth.uid() = user_id);

-- Revoke base-table SELECT from anon so user_id cannot be reached without auth.
-- Authenticated keeps SELECT via implicit Supabase grant + ratings_select_own RLS.
revoke select on ratings from anon;

-- Public-safe view: aggregate rating data without rater identity.
drop view if exists ratings_public;

create view ratings_public as
  select id, location_id, cleanliness, accessibility, convenience,
         review_text, created_at, updated_at
  from ratings;

comment on view ratings_public is
  'Public read path for ratings. Excludes user_id to prevent rater identity exposure. '
  'Use for aggregate/display queries; use base table with RLS for own-row reads/mutations.';

grant select on ratings_public to anon;
grant select on ratings_public to authenticated;

-- ─── 4. respect_signal_90d view ──────────────────────────────────────────────
-- Defined in database.types.ts (generated from live schema) but absent from
-- migration files — any fresh local db push would be missing this object.
-- Phase 6 upgrades this to a MATERIALIZED VIEW with CONCURRENT refresh.
create or replace view respect_signal_90d as
  select
    location_id,
    sum(weight)::numeric as total_weight,
    count(*)::bigint     as event_count
  from respect_signal_log
  where "timestamp" > now() - interval '90 days'
  group by location_id;

grant select on respect_signal_90d to anon;
grant select on respect_signal_90d to authenticated;

-- ─── 5. get_locations_in_radius SECURITY DEFINER function ────────────────────
-- Defined in database.types.ts but absent from migration files.
-- Filters deleted/shadowbanned server-side. Optional tag-based filters via
-- existence subqueries against the tags table.
-- Phase 3 will add search_locations_bbox and search_locations_nearby as the
-- primary map search RPCs; this function is the proximity search foundation.
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
    and extensions.st_dwithin(
          l.coordinates::extensions.geography,
          extensions.st_point(user_lng, user_lat)::extensions.geography,
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
  order by l.coordinates::extensions.geography OPERATOR(extensions.<->) extensions.st_point(user_lng, user_lat)::extensions.geography;
$$;

grant execute on function get_locations_in_radius(
  numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to anon;
grant execute on function get_locations_in_radius(
  numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to authenticated;

-- ─── 6. count_locations_within SECURITY DEFINER function ─────────────────────
-- Defined in database.types.ts but absent from migration files.
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
    and extensions.st_dwithin(
          coordinates::extensions.geography,
          extensions.st_point(p_lon, p_lat)::extensions.geography,
          p_radius_m
        );
$$;

grant execute on function count_locations_within(numeric, numeric, numeric) to anon;
grant execute on function count_locations_within(numeric, numeric, numeric) to authenticated;
