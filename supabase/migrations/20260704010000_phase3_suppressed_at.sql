-- Phase 3 (03-01 Task 1) — locations.suppressed_at moderation column (2026-07-04)
--
-- Adds the fourth moderation flag (suppressed_at) that Phase 3's three read RPCs
-- filter on, rebuilds the partial GiST index so the moderation-filtered spatial
-- search stays index-backed, updates the public SELECT RLS policy, and REVOKES
-- direct base-table SELECT from anon/authenticated so the SECURITY DEFINER RPCs
-- (Task 2) become the ONLY read path.
--
-- Why the base-table revoke (plan-checker finding, 2026-07-05):
--   locations_select_public previously granted anon/authenticated a direct
--   `.from('locations').select('*')` with NO access_sensitivity/family_mode filter
--   and NO column restriction — a caller could bypass all three new RPCs and read
--   access_instructions (the door PIN) + shadowban_status directly, defeating every
--   protection Task 2 builds. This project fixed the identical bug class twice
--   before (ratings → 20260624000002_ratings_privacy_fix.sql; availability_flags →
--   20260519030000_fix_rls.sql) using the same remedy: revoke base-table SELECT
--   from both roles, force all reads through a safe SECURITY DEFINER function.

-- ─── 1. Add the suppressed_at column (nullable, no default) ───────────────────
alter table public.locations
  add column suppressed_at timestamptz;

-- ─── 2. Rebuild the moderation-filtered partial GiST index ────────────────────
-- Existing definition (remote_schema.sql:78-80):
--   gist(coordinates) where deleted_at is null and shadowban_status = false
-- Extend the partial predicate with `and suppressed_at is null` so the four-clause
-- moderation search remains index-backed (no seq scan per pan/zoom).
drop index if exists idx_locations_coordinates_active;
create index idx_locations_coordinates_active
  on public.locations using gist (coordinates)
  where deleted_at is null
    and shadowban_status = false
    and suppressed_at is null;

-- ─── 3. Update the public SELECT RLS policy (belt-and-suspenders) ─────────────
-- Keep the policy's USING clause aligned with the four-clause moderation filter
-- even though the base-table SELECT revoke below makes it moot for anon/authenticated.
drop policy if exists "locations_select_public" on public.locations;
create policy "locations_select_public"
  on public.locations for select
  using (
    deleted_at is null
    and shadowban_status = false
    and suppressed_at is null
  );

-- ─── 4. Revoke direct base-table SELECT — force all reads through the RPCs ─────
-- After this, a direct PostgREST `.from('locations').select()` returns
-- permission-denied / zero rows for both roles. The three Task 2 RPCs are
-- SECURITY DEFINER (run as owner, bypass RLS) and remain the sole read path.
revoke select on public.locations from anon;
revoke select on public.locations from authenticated;
