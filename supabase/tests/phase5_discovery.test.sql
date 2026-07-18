-- Phase 5 (05-01 Task 1) — pgTAP correctness suite for pending-candidate discovery.
-- Run locally with:  supabase test db --local   (requires Docker — tracked override this env)
--
-- RED until 20260717120100_phase5_discovery_rpc.sql creates search_pending_submissions_nearby
-- (and 20260717120000_phase5_event_model.sql creates private.verification_rate_limits +
-- verification_events.submission_id). BLOCKING pre-push gate for Phase 5 (05-01 Task 5).
--
-- Covers (must-haves, 05-01-PLAN.md):
--   (a) returns a pending submission within the 500m discovery radius.
--   (b) excludes the caller's OWN submissions (submitter_id = auth.uid()).
--   (c) excludes a submission the caller already recorded a verification event for.
--   (d) excludes non-pending / expired rows.
--   (e) the D-37 result cap is enforced for EVERY result_limit input: null → 10 (never
--       unbounded), zero / negative → 1 (never degenerate), oversized → 10, in-bounds
--       passes through. >10 candidates are seeded in range to make each case provable.
--   (f) the return shape leaks NO submitter_id / access code / timing tip / coordinates.
--   (g) the per-user discovery cooldown: a second call inside the window returns no
--       candidate data and STILL advances last_discovery_at (the atomic claim is not
--       skipped on denial), and a call after the window succeeds again (VOLATILE state).
--   (h) an anonymous caller receives zero rows.
--
-- Discovery cooldown is reset between "allowed" scenarios by deleting the caller's
-- private.verification_rate_limits row (owner-only); the "after cooldown" case
-- backdates last_discovery_at deterministically instead of sleeping. The claim itself
-- uses clock_timestamp() (real elapsed time), not now() (frozen for this whole file's
-- wrapping transaction), which is what makes the "denied call still advances the
-- claim" assertion provable here at all.
--
-- True cross-session concurrency (two truly overlapping calls racing the same row
-- lock) cannot be proven inside this single wrapped transaction — see the dedicated
-- supabase/tests/phase5_discovery_cooldown_race.test.sql, which uses dblink and MUST
-- run via the disposable-instance isolated runner, never plain `supabase test db`.
--
-- Base point: 44.05, -123.09. In-range fixtures sit within ~250m; the far fixture is
-- ~1.1km out. discovery_radius_m is not seeded by 05-01 — the RPC coalesces to 500.

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ─── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000',
        'aaaaaaaa-0000-0000-0000-0000000000a1',
        'authenticated', 'authenticated', 'phase5-discA@example.com'),   -- submitter
       ('00000000-0000-0000-0000-000000000000',
        'bbbbbbbb-0000-0000-0000-0000000000b2',
        'authenticated', 'authenticated', 'phase5-discB@example.com');   -- verifier / caller

-- Distinct exclusion fixtures (one visible target: S_near).
insert into public.submissions (id, submitter_id, status, name, coordinates, expires_at)
values
  -- S_near: A-owned, pending, in range, unexpired → the single expected result
  ('22222222-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'pending',
   'S_near', extensions.st_setsrid(extensions.st_makepoint(-123.0910, 44.0510), 4326)::extensions.geography,
   now() + interval '10 days'),
  -- S_own: B-owned, pending, in range → excluded (caller's own)
  ('22222222-0000-0000-0000-0000000000b0', 'bbbbbbbb-0000-0000-0000-0000000000b2', 'pending',
   'S_own', extensions.st_setsrid(extensions.st_makepoint(-123.0905, 44.0505), 4326)::extensions.geography,
   now() + interval '10 days'),
  -- S_verified: A-owned, pending, in range, but B already verified → excluded
  ('22222222-0000-0000-0000-0000000000c0', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'pending',
   'S_verified', extensions.st_setsrid(extensions.st_makepoint(-123.0912, 44.0512), 4326)::extensions.geography,
   now() + interval '10 days'),
  -- S_expired_status: A-owned, in range, unexpired-time but status='expired' → excluded
  ('22222222-0000-0000-0000-0000000000d0', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'expired',
   'S_expired_status', extensions.st_setsrid(extensions.st_makepoint(-123.0908, 44.0508), 4326)::extensions.geography,
   now() + interval '10 days'),
  -- S_expired_time: A-owned, pending, in range but expires_at in the past → excluded
  ('22222222-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'pending',
   'S_expired_time', extensions.st_setsrid(extensions.st_makepoint(-123.0907, 44.0507), 4326)::extensions.geography,
   now() - interval '1 day'),
  -- S_far: A-owned, pending, unexpired but ~1.1km away → excluded (outside 500m)
  ('22222222-0000-0000-0000-0000000000f0', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'pending',
   'S_far', extensions.st_setsrid(extensions.st_makepoint(-123.1000, 44.0600), 4326)::extensions.geography,
   now() + interval '10 days');

-- B has already recorded a verification event for S_verified.
insert into public.verification_events
  (submission_id, location_id, user_id, distance_from_location_meters, weight, event_type)
values ('22222222-0000-0000-0000-0000000000c0', null,
        'bbbbbbbb-0000-0000-0000-0000000000b2', 15, 1.0, 'confirm');

-- ═══ Section A. exclusions — first allowed call returns exactly S_near ════════
delete from private.verification_rate_limits where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select set_config('request.jwt.claims',
  json_build_object('sub','bbbbbbbb-0000-0000-0000-0000000000b2','role','authenticated')::text, true);

create temp table disc_a as
  select * from public.search_pending_submissions_nearby(44.05, -123.09, 10);

select is(
  (select count(*) from disc_a where id = '22222222-0000-0000-0000-0000000000a0'),
  1::bigint,
  'discovery returns the in-range pending submission S_near');
select is(
  (select count(*) from disc_a where id = '22222222-0000-0000-0000-0000000000b0'),
  0::bigint,
  'discovery excludes the caller''s OWN submission (S_own)');
select is(
  (select count(*) from disc_a where id = '22222222-0000-0000-0000-0000000000c0'),
  0::bigint,
  'discovery excludes a submission the caller already verified (S_verified)');
select is(
  (select count(*) from disc_a
     where id in ('22222222-0000-0000-0000-0000000000d0', '22222222-0000-0000-0000-0000000000d1')),
  0::bigint,
  'discovery excludes non-pending and expired submissions');
select is(
  (select count(*) from disc_a where id = '22222222-0000-0000-0000-0000000000f0'),
  0::bigint,
  'discovery excludes a submission outside the 500m radius (S_far)');

-- ═══ Section B. return-shape column safety (no identity / secret leakage) ═════
select ok(
  (select not (array['submitter_id','access_instructions','pending_access_code','timing_tip','coordinates']::text[]
               && p.proargnames)
     from pg_proc p
    where p.proname = 'search_pending_submissions_nearby' and p.pronamespace = 'public'::regnamespace),
  'search_pending_submissions_nearby exposes no submitter identity / access code / timing tip / raw coordinate column');
select ok(
  (select array['id','distance_m']::text[] <@ p.proargnames
     from pg_proc p
    where p.proname = 'search_pending_submissions_nearby' and p.pronamespace = 'public'::regnamespace),
  'search_pending_submissions_nearby returns id and a server-computed distance_m');

-- ═══ Section C. D-37 result cap across every result_limit input ═══════════════
-- Seed 12 more in-range A-owned pending candidates → 13 visible to B (S_near + 12).
insert into public.submissions (id, submitter_id, status, name, coordinates, expires_at)
select ('33333333-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
       'aaaaaaaa-0000-0000-0000-0000000000a1', 'pending',
       'S_cap_' || g,
       extensions.st_setsrid(extensions.st_makepoint(-123.0909 + g * 0.00001, 44.0509), 4326)::extensions.geography,
       now() + interval '10 days'
from generate_series(1, 12) g;

delete from private.verification_rate_limits where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select is(
  (select count(*) from public.search_pending_submissions_nearby(44.05, -123.09, 1000)),
  10::bigint,
  'result cap: an oversized result_limit (1000) is clamped to 10');

delete from private.verification_rate_limits where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select is(
  (select count(*) from public.search_pending_submissions_nearby(44.05, -123.09, null)),
  10::bigint,
  'result cap: a null result_limit returns at most 10 (never unbounded)');

delete from private.verification_rate_limits where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select is(
  (select count(*) from public.search_pending_submissions_nearby(44.05, -123.09, 0)),
  1::bigint,
  'result cap: a zero result_limit is floored to 1 (never a degenerate LIMIT 0)');

delete from private.verification_rate_limits where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select is(
  (select count(*) from public.search_pending_submissions_nearby(44.05, -123.09, -5)),
  1::bigint,
  'result cap: a negative result_limit is floored to 1');

delete from private.verification_rate_limits where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select is(
  (select count(*) from public.search_pending_submissions_nearby(44.05, -123.09, 5)),
  5::bigint,
  'result cap: an in-bounds result_limit (5) passes through unchanged');

-- ═══ Section D. per-user discovery cooldown (VOLATILE state) ══════════════════
-- The claim uses clock_timestamp() (real elapsed time), not now() (frozen for
-- this whole test file's wrapping transaction) — see 20260717120100's D-36
-- comment — specifically so the "denied call still advances the claim"
-- assertion below is provable inside one pgTAP transaction, not just in
-- separate real transactions.
delete from private.verification_rate_limits where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select ok(
  (select count(*) from public.search_pending_submissions_nearby(44.05, -123.09, 10)) > 0,
  'first (fresh) discovery call returns candidates and records cooldown state');

create temp table disc_cooldown_claim_1 as
  select last_discovery_at from private.verification_rate_limits
   where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select ok(
  (select last_discovery_at is not null from disc_cooldown_claim_1),
  'the first call''s claim recorded a non-null last_discovery_at');

select is(
  (select count(*) from public.search_pending_submissions_nearby(44.05, -123.09, 10)),
  0::bigint,
  'a second discovery call inside the cooldown returns no candidate data');

-- D-36 / Codex round-2 finding: the RPC must claim (advance) last_discovery_at
-- on EVERY call, including a denied one — the prior select-then-insert form
-- skipped the upsert on denial entirely, which both left the race window open
-- and let a denied call retry for free once the true fix started claiming
-- unconditionally. Prove the denied call above still moved the claim forward.
select ok(
  (select last_discovery_at from private.verification_rate_limits
    where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2')
  > (select last_discovery_at from disc_cooldown_claim_1),
  'a denied (cooldown-active) discovery call still advances last_discovery_at, not just the accepted call');

update private.verification_rate_limits
   set last_discovery_at = now() - interval '1 hour'
 where user_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select ok(
  (select count(*) from public.search_pending_submissions_nearby(44.05, -123.09, 10)) > 0,
  'a discovery call after the cooldown window succeeds again');

-- ═══ Section E. anonymous caller ═════════════════════════════════════════════
select set_config('request.jwt.claims', '', true);
select is(
  (select count(*) from public.search_pending_submissions_nearby(44.05, -123.09, 10)),
  0::bigint,
  'an anonymous caller receives zero discovery rows');

select * from finish();
rollback;
