-- Phase 3 (03-01 Task 1) — max_pins_per_viewport app_config row (2026-07-04)
--
-- D-32: the ~200-pin-per-viewport cap is an admin-tunable app_config value, not a
-- hardcoded constant — consistent with the Phase 1 tunables (max_accuracy_m,
-- verify_radius_m, decay_half_life_days, ...). search_locations_bbox (Task 2) reads
-- this row server-side and clamps its effective LIMIT via least(max_pins, cap) so a
-- client-supplied max_pins can only narrow, never exceed this value.
--
-- value is TEXT to match the existing app_config convention (numerics stored as
-- strings). The anon SELECT policy app_config_select_anon already exists
-- (20260519020000_fix_schema.sql) — no new grant is needed.

insert into public.app_config (key, value, description) values
  ('max_pins_per_viewport', '200', 'Max locations returned per bbox/viewport query (D-32, admin-tunable)');
