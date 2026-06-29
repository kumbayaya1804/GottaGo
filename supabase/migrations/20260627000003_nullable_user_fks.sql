-- Phase 2: Auth & Profiles — Wave 0 (2026-06-27)
--
-- Addresses CONTEXT §6 (account deletion) + Pitfall 3 (FK blocker):
--
-- The 7 FK columns below are currently NOT NULL with no ON DELETE action,
-- which means deleting a user from auth.users is BLOCKED by Postgres RESTRICT
-- (the default). This violates GDPR right-to-erasure (T-02-DEL-FK) and makes
-- the delete_account() RPC in migration 20260627000004 impossible.
--
-- Fix: drop NOT NULL + re-add each FK as ON DELETE SET NULL so deleting a user
-- anonymizes their community contributions instead of blocking the deletion.
-- ratings.unique(user_id, location_id) is unaffected — NULLs are distinct in
-- Postgres unique indexes.

-- ─── 1. submissions.submitter_id ─────────────────────────────────────────────
alter table submissions alter column submitter_id drop not null;
alter table submissions drop constraint submissions_submitter_id_fkey;
alter table submissions
  add constraint submissions_submitter_id_fkey
  foreign key (submitter_id) references users(id) on delete set null;

-- ─── 2. ratings.user_id ──────────────────────────────────────────────────────
alter table ratings alter column user_id drop not null;
alter table ratings drop constraint ratings_user_id_fkey;
alter table ratings
  add constraint ratings_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;

-- ─── 3. trust_events.user_id ─────────────────────────────────────────────────
alter table trust_events alter column user_id drop not null;
alter table trust_events drop constraint trust_events_user_id_fkey;
alter table trust_events
  add constraint trust_events_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;

-- ─── 4. verification_events.user_id ──────────────────────────────────────────
alter table verification_events alter column user_id drop not null;
alter table verification_events drop constraint verification_events_user_id_fkey;
alter table verification_events
  add constraint verification_events_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;

-- ─── 5. reports.user_id ──────────────────────────────────────────────────────
alter table reports alter column user_id drop not null;
alter table reports drop constraint reports_user_id_fkey;
alter table reports
  add constraint reports_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;

-- ─── 6. failure_events.user_id ───────────────────────────────────────────────
alter table failure_events alter column user_id drop not null;
alter table failure_events drop constraint failure_events_user_id_fkey;
alter table failure_events
  add constraint failure_events_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;

-- ─── 7. availability_flags.reporter_id ───────────────────────────────────────
alter table availability_flags alter column reporter_id drop not null;
alter table availability_flags drop constraint availability_flags_reporter_id_fkey;
alter table availability_flags
  add constraint availability_flags_reporter_id_fkey
  foreign key (reporter_id) references users(id) on delete set null;
