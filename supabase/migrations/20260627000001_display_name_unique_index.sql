-- Phase 2: Auth & Profiles — Wave 0 (2026-06-27)
--
-- Adds a case-insensitive unique index on public.users.display_name so that
-- "Alice", "alice", and "ALICE" are treated as the same name at the database level.
--
-- Live gap closed: display_name is currently nullable text with no uniqueness
-- constraint — impersonation via case variation is possible without this index.
--
-- Design decisions (LOCKED per 02-CONTEXT.md §5 + §10):
--   - lower(display_name) index: NULLs remain distinct (unset display_names don't
--     conflict with each other), preserving the Phase 1 user rows that have
--     display_name = NULL until update_profile is called post-signup.
--   - ratings.unique(user_id, location_id) is unaffected — NULLs are distinct
--     in Postgres unique indexes, so no existing constraint is violated.
--
-- Mitigates: T-02-05 — display_name impersonation via case variation.

-- ─── 1. Case-insensitive unique index on display_name ────────────────────────
create unique index if not exists users_display_name_lower_uniq
  on public.users (lower(display_name));
