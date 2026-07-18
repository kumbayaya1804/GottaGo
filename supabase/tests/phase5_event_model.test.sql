-- Phase 5 (05-01 Task 1) — pgTAP correctness suite for the event-model evolution.
-- Run locally with:  supabase test db --local   (requires Docker — tracked override this env)
--
-- RED until 20260717120000_phase5_event_model.sql creates the objects below. This
-- suite is a BLOCKING pre-push gate for Phase 5 (05-01 Task 5); it must run green on a
-- Docker-capable or isolated non-production environment before the live `supabase db push`.
--
-- Covers (must-haves, 05-01-PLAN.md):
--   (a) verification_events_target_exactly_one CHECK — exactly one of
--       submission_id / location_id may be non-null (num_nonnulls = 1).
--   (b) verification_events_user_submission_uniq — a user cannot record two counted
--       events for the same pending submission (D-43).
--   (c) the 2026-07-10 client-write lockdown survives: a direct `authenticated`
--       INSERT still raises 42501 (mirror phase4_submit §7 / phase5prep lockdown).
--   (d) submissions.status accepts 'cancelled' (D-58) and 'expired' (D-59) after the
--       CHECK alter, and still rejects an unknown value.
--   (e) submission_tags accepts only the two keys changing_table / wheelchair (D-62/63).
--   (f) delete_account() purges the RAW coordinate (gps_location) for the deleting
--       user while PRESERVING derived evidence (distance_from_location_meters,
--       gps_accuracy_m, weight) — D-41 purge + D-40 preserve. gps_lat/gps_lon do NOT
--       exist live (dropped by 20260519020000), so they are never asserted.
--   (g) WR-04 regression: withdraw_submission on a zero-row ownership/status match
--       still raises 'submission not available'.
--   (h) D-58 event-aware withdraw: an unverified pending row hard-deletes; a row that
--       already has a verification event moves to 'cancelled' (row + event retained).
--   (i) fixed-empty-search_path contract: delete_account and withdraw_submission both
--       pin an empty search_path in proconfig (not the inherited public / public,auth).
--
-- Fixtures: three auth.users (A/B/C) fire handle_new_user → provision public.users.
-- Setup rows are inserted as the table owner (RLS/ACL bypassed); the lockdown check
-- is the ONLY section that switches to `set local role authenticated`.

begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- ─── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'authenticated', 'authenticated', 'phase5-eventA@example.com'),
       ('00000000-0000-0000-0000-000000000000',
        'bbbbbbbb-0000-0000-0000-000000000002',
        'authenticated', 'authenticated', 'phase5-eventB@example.com'),
       ('00000000-0000-0000-0000-000000000000',
        'cccccccc-0000-0000-0000-000000000003',
        'authenticated', 'authenticated', 'phase5-eventC@example.com');

-- A published location (valid geography) — the location-linked event target.
insert into public.locations (id, name, coordinates)
values ('dddddddd-0000-0000-0000-000000000001', 'Event Model Test Location',
        extensions.st_setsrid(extensions.st_makepoint(-123.09, 44.05), 4326)::extensions.geography);

-- Pending submissions owned by A (submission-linked event targets + lifecycle rows).
insert into public.submissions (id, submitter_id, status, confirmation_count, name)
values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', 1, 'SUB1 exactly-one'),
       ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', 1, 'SUB2 uniqueness'),
       ('11111111-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', 1, 'SUB_WR wr-04'),
       ('11111111-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', 1, 'SUB_UNV unverified'),
       ('11111111-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', 1, 'SUB_VER verified'),
       ('11111111-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', 1, 'SUB_STAT lifecycle');

-- ═══ Section 1. exactly-one target CHECK (D-39) ══════════════════════════════
select throws_ok(
  $$ insert into public.verification_events
       (submission_id, location_id, user_id, distance_from_location_meters, weight, event_type)
     values ('11111111-0000-0000-0000-000000000001',
             'dddddddd-0000-0000-0000-000000000001',
             'aaaaaaaa-0000-0000-0000-000000000001', 10, 1.0, 'confirm') $$,
  '23514', null,
  'verification_events_target_exactly_one rejects a row with BOTH submission_id and location_id');

select throws_ok(
  $$ insert into public.verification_events
       (submission_id, location_id, user_id, distance_from_location_meters, weight, event_type)
     values (null, null,
             'aaaaaaaa-0000-0000-0000-000000000001', 10, 1.0, 'confirm') $$,
  '23514', null,
  'verification_events_target_exactly_one rejects a row with NEITHER submission_id nor location_id');

select lives_ok(
  $$ insert into public.verification_events
       (submission_id, location_id, user_id, distance_from_location_meters, weight, event_type)
     values ('11111111-0000-0000-0000-000000000001', null,
             'aaaaaaaa-0000-0000-0000-000000000001', 10, 1.0, 'confirm') $$,
  'verification_events accepts a row with exactly one target (submission_id only)');

-- ═══ Section 2. per-user-per-submission uniqueness (D-43) ═════════════════════
select lives_ok(
  $$ insert into public.verification_events
       (submission_id, location_id, user_id, distance_from_location_meters, weight, event_type)
     values ('11111111-0000-0000-0000-000000000002', null,
             'bbbbbbbb-0000-0000-0000-000000000002', 12, 1.0, 'confirm') $$,
  'verification_events accepts a first event for (user B, SUB2)');

select throws_ok(
  $$ insert into public.verification_events
       (submission_id, location_id, user_id, distance_from_location_meters, weight, event_type)
     values ('11111111-0000-0000-0000-000000000002', null,
             'bbbbbbbb-0000-0000-0000-000000000002', 13, 1.0, 'confirm') $$,
  '23505', null,
  'verification_events_user_submission_uniq rejects a second event for the same (user, submission)');

-- ═══ Section 3. client-write lockdown regression (2026-07-10) ════════════════
select ok(not has_table_privilege('authenticated', 'public.verification_events', 'INSERT'),
  'authenticated has no direct INSERT privilege on verification_events (lockdown preserved)');

select set_config('request.jwt.claims',
  json_build_object('sub','bbbbbbbb-0000-0000-0000-000000000002','role','authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$ insert into public.verification_events
       (location_id, user_id, distance_from_location_meters, weight, event_type)
     values ('dddddddd-0000-0000-0000-000000000001',
             'bbbbbbbb-0000-0000-0000-000000000002', 5, 1.0, 'confirm') $$,
  '42501', null,
  'a direct authenticated INSERT into verification_events still raises 42501 (lockdown intact)');
reset role;
select set_config('request.jwt.claims', '', true);

-- ═══ Section 4. submissions.status lifecycle CHECK (D-58 cancelled / D-59 expired) ═
select lives_ok(
  $$ update public.submissions set status = 'cancelled'
       where id = '11111111-0000-0000-0000-000000000006' $$,
  'submissions.status accepts cancelled after the CHECK alter (D-58)');

select lives_ok(
  $$ update public.submissions set status = 'expired'
       where id = '11111111-0000-0000-0000-000000000006' $$,
  'submissions.status accepts expired (D-59)');

select throws_ok(
  $$ update public.submissions set status = 'withdrawn'
       where id = '11111111-0000-0000-0000-000000000006' $$,
  '23514', null,
  'submissions.status still rejects an unknown value (no withdrawn status introduced)');

-- restore SUB_STAT to pending for any later assumptions
update public.submissions set status = 'pending' where id = '11111111-0000-0000-0000-000000000006';

-- ═══ Section 5. submission_tags key CHECK — exactly two keys (D-62/63) ════════
select lives_ok(
  $$ insert into public.submission_tags (submission_id, key, value)
     values ('11111111-0000-0000-0000-000000000001', 'changing_table', 'true') $$,
  'submission_tags accepts key changing_table');

select lives_ok(
  $$ insert into public.submission_tags (submission_id, key, value)
     values ('11111111-0000-0000-0000-000000000001', 'wheelchair', 'true') $$,
  'submission_tags accepts key wheelchair');

select throws_ok(
  $$ insert into public.submission_tags (submission_id, key, value)
     values ('11111111-0000-0000-0000-000000000001', 'elevator', 'true') $$,
  '23514', null,
  'submission_tags rejects any third key (only changing_table / wheelchair allowed)');

-- ═══ Section 6. delete_account raw-coord purge vs derived-evidence preserve ════
-- Seed a location-linked event for user C carrying raw GPS + derived evidence.
insert into public.verification_events
  (id, submission_id, location_id, user_id,
   gps_location, distance_from_location_meters, gps_accuracy_m, weight, event_type)
values
  ('eeeeeeee-0000-0000-0000-000000000001', null,
   'dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003',
   extensions.st_setsrid(extensions.st_makepoint(-123.09, 44.05), 4326)::extensions.geography,
   12.5, 8, 1.0, 'confirm');

select set_config('request.jwt.claims',
  json_build_object('sub','cccccccc-0000-0000-0000-000000000003','role','authenticated')::text, true);
select public.delete_account();
select set_config('request.jwt.claims', '', true);

select ok(
  (select gps_location is null from public.verification_events
     where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'delete_account nulls the raw coordinate gps_location (D-41 purge)');

select is(
  (select distance_from_location_meters from public.verification_events
     where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  12.5::numeric,
  'delete_account PRESERVES distance_from_location_meters (D-40 derived evidence)');

select is(
  (select gps_accuracy_m from public.verification_events
     where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  8::numeric,
  'delete_account PRESERVES gps_accuracy_m (D-40 derived evidence)');

select is(
  (select weight from public.verification_events
     where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  1.0::numeric,
  'delete_account PRESERVES weight (D-40 derived evidence)');

select ok(
  (select user_id is null from public.verification_events
     where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'delete_account anonymizes user_id (existing account-deletion policy)');

-- ═══ Section 7. WR-04 regression — zero-row match still raises ════════════════
select set_config('request.jwt.claims',
  json_build_object('sub','bbbbbbbb-0000-0000-0000-000000000002','role','authenticated')::text, true);
select throws_ok(
  $$ select public.withdraw_submission('11111111-0000-0000-0000-000000000003') $$,
  'P0001', 'submission not available',
  'withdraw_submission by a non-owner (zero-row match) still raises submission not available (WR-04)');
select is(
  (select count(*) from public.submissions where id = '11111111-0000-0000-0000-000000000003'),
  1::bigint,
  'withdraw_submission by a non-owner leaves the pending row intact');

-- ═══ Section 8. D-58 event-aware withdraw ════════════════════════════════════
-- Give SUB_VER a verification event (user B) so withdrawal must cancel, not delete.
insert into public.verification_events
  (submission_id, location_id, user_id, distance_from_location_meters, weight, event_type)
values ('11111111-0000-0000-0000-000000000005', null,
        'bbbbbbbb-0000-0000-0000-000000000002', 20, 1.0, 'confirm');

-- Owner A withdraws an UNVERIFIED pending row → hard delete (as if never submitted).
select set_config('request.jwt.claims',
  json_build_object('sub','aaaaaaaa-0000-0000-0000-000000000001','role','authenticated')::text, true);
select public.withdraw_submission('11111111-0000-0000-0000-000000000004');
select is(
  (select count(*) from public.submissions where id = '11111111-0000-0000-0000-000000000004'),
  0::bigint,
  'withdraw_submission hard-deletes an UNVERIFIED pending row (no event exists)');

-- Owner A withdraws a submission that already has an event → move to cancelled.
select public.withdraw_submission('11111111-0000-0000-0000-000000000005');
select is(
  (select status from public.submissions where id = '11111111-0000-0000-0000-000000000005'),
  'cancelled',
  'withdraw_submission moves a VERIFIED submission to cancelled (D-58, row retained)');
select is(
  (select count(*) from public.verification_events
     where submission_id = '11111111-0000-0000-0000-000000000005'),
  1::bigint,
  'withdraw_submission retains the immutable verification event on cancellation (D-58)');
select set_config('request.jwt.claims', '', true);

-- ═══ Section 9. fixed-empty search_path contract on recreated privileged RPCs ══
select is(
  (select btrim((regexp_match(cfg, '^search_path=(.*)$'))[1], '"')
     from pg_proc p, unnest(coalesce(p.proconfig, '{}')) cfg
    where p.proname = 'delete_account' and p.pronamespace = 'public'::regnamespace
      and cfg like 'search_path=%'),
  '',
  'delete_account pins an empty search_path (Phase 5 fixed-empty contract, not public,auth)');

select is(
  (select btrim((regexp_match(cfg, '^search_path=(.*)$'))[1], '"')
     from pg_proc p, unnest(coalesce(p.proconfig, '{}')) cfg
    where p.proname = 'withdraw_submission' and p.pronamespace = 'public'::regnamespace
      and cfg like 'search_path=%'),
  '',
  'withdraw_submission pins an empty search_path (Phase 5 fixed-empty contract, not public)');

select * from finish();
rollback;
