-- Phase 4 (04-01 Task 1) — pgTAP correctness suite for the submission write path
-- Run locally with:  supabase test db   (requires Docker — tracked override this env)
--
-- Covers the three submission-lifecycle SECURITY DEFINER RPCs added in
-- 20260707020000_phase4_submission_staging.sql:
--   submit_location             — server-side GPS validation + pending staging insert
--   get_my_pending_submissions  — auth.uid()-scoped pending pins
--   withdraw_submission         — owner-only DELETE of a pending row
--
-- Asserts (RESEARCH §Validation Architecture → Test Map):
--   (a) submit_location stages exactly one submissions row: status='pending',
--       confirmation_count=1, coordinates NOT NULL, and NO locations row is linked
--   (b/c/d) mocked=true / accuracy>50 / age>60 each raise the SAME generic
--       'gps rejected' error (SC7 — reason never echoed)
--   (e) access_sensitivity stages the literal 'sensitive' when passed, NULL by default
--   (f) anonymous submit_location / withdraw_submission raise 'not authenticated';
--       anonymous get_my_pending_submissions returns zero rows
--   (g) get_my_pending_submissions is caller-scoped: user A sees their own pending
--       rows, user B sees none of user A's
--   (i) withdraw_submission deletes ONLY the caller's own pending row (non-owner no-op)
--   (j) withdraw never introduces a status='withdrawn' value (DELETE, not status flip)
--
-- Two auth.users fixtures (A/B) fire handle_new_user → provision public.users.
-- The suite never writes a locations row — pending data must be provable in
-- `submissions` alone (Option A, RESEARCH §Pattern 1).

begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- ─── Fixtures: two authenticated test users ──────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000',
        'a0000000-0000-0000-0000-000000000001',
        'authenticated', 'authenticated', 'phase4-userA@example.com'),
       ('00000000-0000-0000-0000-000000000000',
        'a0000000-0000-0000-0000-000000000002',
        'authenticated', 'authenticated', 'phase4-userB@example.com');

-- ═══ Section 1. submit_location stages a pending submission (User A) ══════════
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

-- Submit #1: valid sample, access_sensitivity = 'sensitive'
create temp table sub_a1 as
  select public.submit_location(
    'Test Cafe', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot',
    p_access_sensitivity => 'sensitive') as id;

select is(
  (select status from public.submissions where id = (select id from sub_a1)),
  'pending',
  'submit_location stages status=pending');

select is(
  (select confirmation_count from public.submissions where id = (select id from sub_a1)),
  1,
  'submit_location stages confirmation_count=1 (creator-initial event)');

select ok(
  (select coordinates is not null from public.submissions where id = (select id from sub_a1)),
  'submit_location stages a non-null geography coordinate');

select is(
  (select count(*) from public.submissions
     where id = (select id from sub_a1) and location_id is not null),
  0::bigint,
  'submit_location creates NO linked locations row (pending stays off locations)');

select is(
  (select access_sensitivity from public.submissions where id = (select id from sub_a1)),
  'sensitive',
  'submit_location stages the literal access_sensitivity = sensitive');

-- Submit #2: valid sample, access_sensitivity omitted → must stage NULL
create temp table sub_a2 as
  select public.submit_location(
    'No Sensitivity Spot', 44.06, -123.10, 15::numeric, false, now(), 'public_facility') as id;

select is(
  (select access_sensitivity from public.submissions where id = (select id from sub_a2)),
  null::text,
  'submit_location stages NULL access_sensitivity by default (never a made-up value)');

-- ═══ Section 2. GPS validation — single generic 'gps rejected' error (SC7) ════
select throws_ok(
  $$ select public.submit_location('Mock', 44.05, -123.09, 10::numeric, true, now(), 'chill_spot') $$,
  'P0001', 'gps rejected',
  'submit_location rejects mocked=true with the generic gps rejected error');

select throws_ok(
  $$ select public.submit_location('Inaccurate', 44.05, -123.09, 51::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'gps rejected',
  'submit_location rejects accuracy > max_accuracy_m (51 > 50) with the same generic error');

select throws_ok(
  $$ select public.submit_location('Stale', 44.05, -123.09, 10::numeric, false, now() - interval '61 seconds', 'chill_spot') $$,
  'P0001', 'gps rejected',
  'submit_location rejects a fix older than max_gps_age_s (61s > 60s) with the same generic error');

select throws_ok(
  $$ select public.submit_location('FutureDated', 44.05, -123.09, 10::numeric, false, now() + interval '10 seconds', 'chill_spot') $$,
  'P0001', 'gps rejected',
  'submit_location rejects a p_captured_at set in the future beyond the 5s clock-skew allowance (WR-02)');

-- ═══ Section 3. Anonymous callers are rejected (auth gate) ════════════════════
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$ select public.submit_location('Anon', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'not authenticated',
  'submit_location rejects an anonymous caller with not authenticated');

select is(
  (select count(*) from public.get_my_pending_submissions()),
  0::bigint,
  'get_my_pending_submissions returns zero rows for an anonymous caller');

select throws_ok(
  $$ select public.withdraw_submission('00000000-0000-0000-0000-000000000000'::uuid) $$,
  'P0001', 'not authenticated',
  'withdraw_submission rejects an anonymous caller with not authenticated');

-- ═══ Section 4. get_my_pending_submissions is caller-scoped ═══════════════════
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

select is(
  (select count(*) from public.get_my_pending_submissions()),
  2::bigint,
  'get_my_pending_submissions returns only user A''s own two pending rows');

select is(
  (select count(*) from public.get_my_pending_submissions() where id = (select id from sub_a1)),
  1::bigint,
  'get_my_pending_submissions includes the caller''s own pending submission');

select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);

select is(
  (select count(*) from public.get_my_pending_submissions()
     where id in ((select id from sub_a1), (select id from sub_a2))),
  0::bigint,
  'get_my_pending_submissions never returns another user''s pending rows');

-- ═══ Section 5. withdraw_submission is owner-scoped ═══════════════════════════
-- User B (still impersonated) attempts to withdraw user A's row → raises (WR-04 fix:
-- a zero-row match now raises 'submission not available' instead of a silent no-op).
select throws_ok(
  $$ select public.withdraw_submission((select id from sub_a1)) $$,
  'P0001', 'submission not available',
  'withdraw_submission by a non-owner raises submission not available');
select is(
  (select count(*) from public.submissions where id = (select id from sub_a1)),
  1::bigint,
  'withdraw_submission by a non-owner leaves the row intact');

-- User A withdraws their own row → deleted
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
select public.withdraw_submission((select id from sub_a1));
select is(
  (select count(*) from public.submissions where id = (select id from sub_a1)),
  0::bigint,
  'withdraw_submission by the owner deletes the pending row (as if never submitted)');

-- ═══ Section 6. No 'withdrawn' status is ever introduced ══════════════════════
select is(
  (select count(*) from public.submissions where status = 'withdrawn'),
  0::bigint,
  'withdraw never introduces a status=withdrawn value (DELETE, not a status flip)');

-- ═══ Section 7. Direct client INSERT on submissions is denied (2026-07-08 fix) ═
-- The pre-existing `submissions_insert_auth` RLS policy let a signed-in user
-- bypass submit_location's GPS validation entirely via a raw INSERT. Dropped in
-- 20260708010000_phase4_drop_direct_submission_insert.sql. This asserts a real
-- RLS denial under the `authenticated` role (not the SECURITY DEFINER function,
-- which runs as the table owner and is unaffected) — mirrors the existing
-- phase3_read_rpcs.test.sql "base-table access denied" role-switching pattern.
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$ insert into public.submissions (submitter_id, status, confirmation_count, name)
     values ('a0000000-0000-0000-0000-000000000001'::uuid, 'pending', 1, 'Bypass Attempt') $$,
  '42501',
  null,
  'authenticated role cannot INSERT into submissions directly, even self-attributed (RPC-only write path, submit_location is the sole gate)');
reset role;

select set_config('request.jwt.claims', '', true);
select * from finish();
rollback;
