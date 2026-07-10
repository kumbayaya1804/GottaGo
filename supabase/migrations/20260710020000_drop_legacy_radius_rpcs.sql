-- Codex CRITICAL finding on the P0 remediation batch (2026-07-10) — retire the
-- two legacy Phase 1 radius RPCs instead of repairing them.
--
-- 20260710010000_phase3_postgis_schema_qualification_fix.sql schema-qualified
-- `get_locations_in_radius` and `count_locations_within` alongside the Phase 3
-- search RPCs. That was the wrong disposition for these two: they predate the
-- Phase 3 read-model hardening and were never updated to it —
--   * `get_locations_in_radius` returns `setof public.locations` via `l.*`:
--     the FULL row, which today includes access_instructions,
--     pending_access_code, pending_code_proposed_by, shadowban_status, and
--     suppressed_at. As a SECURITY DEFINER function granted to anon and
--     authenticated it bypasses the base-table SELECT revocation
--     (20260704010000) that exists precisely to keep those columns private.
--   * Both functions also omit the `suppressed_at is null` moderation clause
--     and the server-side family_mode filter that every Phase 3 RPC applies.
--
-- Until 20260710010000 they were dormant in production — the unqualified
-- PostGIS references made every call raise 42704, so they leaked nothing.
-- Repairing them turned a broken-but-harmless surface into an active
-- exfiltration path. This migration removes it.
--
-- DROP (not just REVOKE): no app code has ever called either function from a
-- production build (`grep -rn "get_locations_in_radius\|count_locations_within"
-- app/src` returns zero matches outside generated types), they were broken at
-- runtime in production from creation until 2026-07-10, and the Phase 3 RPCs
-- (search_locations_bbox / search_locations_nearby / get_location_detail) are
-- their complete, hardened replacements. Dropping removes the surface outright
-- and prevents a future accidental re-grant; anything that someday needs a
-- radius count must be built against the Phase 3 read-model rules
-- (explicit public column list, four-clause moderation filter, server-side
-- family_mode).

drop function if exists public.get_locations_in_radius(
  numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
);

drop function if exists public.count_locations_within(numeric, numeric, numeric);
