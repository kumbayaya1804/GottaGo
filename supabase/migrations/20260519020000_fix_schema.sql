-- Fix migration: schema corrections applied on top of remote baseline
--
-- 1. app_config: add description column, anon SELECT policy, D-01 threshold rows
-- 2. verification_events: replace gps_lat/gps_lon numeric with PostGIS geography column
--    (schema-contract.md: "GPS coordinates in PostGIS geometry/geography columns only")

-- ─── app_config fixes ─────────────────────────────────────────────────────────

-- Add description column (was missing from remote; needed for operational clarity)
alter table app_config add column description text;

-- Anon SELECT: client needs verify_radius_m and other thresholds for UX feedback
-- The existing app_config_service_only policy restricts ALL operations to service_role,
-- which blocks the anon role from reading config. We add a separate anon SELECT.
create policy "app_config_select_anon"
  on app_config for select
  using (true);

-- Seed D-01 locked threshold values (CONTEXT.md decision D-01 — do not alter)
-- submission_publish_threshold already exists; these 6 are additive.
insert into app_config (key, value, description) values
  ('max_accuracy_m',            '50',   'GPS accuracy threshold for submission and verification'),
  ('verify_radius_m',           '100',  'Physical presence window in meters for verification'),
  ('max_gps_age_s',             '60',   'Maximum age of GPS fix in seconds at time of submission'),
  ('decay_half_life_days',      '30',   'Confidence score half-life for exponential decay'),
  ('confidence_floor',          '0.05', 'Minimum confidence score — locations never decay to zero'),
  ('report_suppress_threshold', '4',    'Number of matching reports to auto-suppress a location');

-- ─── verification_events GPS fix ──────────────────────────────────────────────
-- schema-contract.md: GPS coordinates must live in PostGIS geography columns, not raw numerics.
-- No rows exist in verification_events currently — clean migration with no backfill needed.

-- Add PostGIS geography column for GPS position at time of verification
alter table verification_events
  add column gps_location geography(Point, 4326);

-- Backfill from gps_lat/gps_lon for any future rows added before this migration deploys
-- (no-op if table is empty, which it currently is)
update verification_events
  set gps_location = st_makepoint(gps_lon, gps_lat)::geography
  where gps_lat is not null and gps_lon is not null;

-- Drop the raw numeric columns now that gps_location captures this data
alter table verification_events
  drop column gps_lat,
  drop column gps_lon;

-- Spatial index on verification GPS positions (useful for proximity fraud detection)
create index idx_verification_events_gps_location
  on verification_events using gist (gps_location);
