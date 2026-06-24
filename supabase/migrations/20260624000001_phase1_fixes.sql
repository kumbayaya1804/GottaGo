-- Phase 1 cleanup fixes — addresses Codex REQUEST CHANGES (2026-06-24)
--
-- 1. locations.shadowban_status: backfill NULLs, add NOT NULL constraint
--    Fix: CR-03 — get_locations_in_radius and count_locations_within used
--    `shadowban_status = false`, which silently excluded NULL-status rows.
--    After this migration, = false is safe; no function changes needed.
--
-- 2. users.shadowban_status: same treatment for consistency.
--    The availability_flags_public view checks u.shadowban_status = true;
--    NULL there treated as "not banned" (correct), but NOT NULL makes intent
--    explicit and removes any future ambiguity.
--
-- Note on WR-01 (fix_schema.sql:40 ST_MakePoint without SRID): that migration
-- ran against an empty verification_events table — no data corruption occurred.
-- The correct form for future migrations is:
--   ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
-- No corrective data action is needed here; this is a pattern reminder only.

-- ─── 1. locations.shadowban_status: backfill + NOT NULL ──────────────────────
update locations
  set shadowban_status = false
  where shadowban_status is null;

alter table locations
  alter column shadowban_status set not null;

-- ─── 2. users.shadowban_status: backfill + NOT NULL ──────────────────────────
update users
  set shadowban_status = false
  where shadowban_status is null;

alter table users
  alter column shadowban_status set not null;
