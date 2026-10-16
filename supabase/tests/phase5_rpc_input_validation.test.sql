-- Phase 5 — pgTAP regression suite for server-side input validation in the two
-- GPS-bearing write RPCs (20261016000000_phase5_rpc_input_validation.sql).
-- Run locally with:  supabase test db   (requires Docker)
--
-- Each case below was reachable by a hostile or buggy authenticated client while the
-- client-side wizard kept the honest path green, so only these server assertions
-- can prove the boundary:
--   (a) submit_location rejects NULL / NaN / out-of-range coordinates. Previously a
--       NULL coordinate staged an unverifiable pending row and an out-of-range one was
--       silently wrapped by PostGIS to a different place on Earth.
--   (b) submit_location and verify_location treat p_mocked = NULL as "not proven
--       unmocked" and reject it. `p_mocked is true` let NULL through the D-45 check.
--   (c) submit_location rejects a NULL or blank name. locations.name is NOT NULL, so
--       such a row could never publish: the deciding verifier's call raised 23502 and
--       rolled back its own cooldown, event and trust writes, every time.
--   (d) verify_location never moves last_verify_attempt_at backwards. A call whose
--       transaction began before a concurrent call's claim must not rewind it.

begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- ─── Identities ──────────────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p5iv-creator@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'p5iv-verifier@example.com');

insert into public.submissions
  (id, submitter_id, status, confirmation_count, name, coordinates, policy_tag, expires_at)
values
  ('57000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'pending', 1, 'SUB iv',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days');

create or replace function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end; $$;

-- ═══ (a) submit_location coordinates ══════════════════════════════════════════
select pg_temp.act_as('a7000000-0000-0000-0000-000000000001');

select throws_ok(
  $$ select public.submit_location('Null lat', null, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'gps rejected', 'submit_location rejects a NULL latitude');
select throws_ok(
  $$ select public.submit_location('Null lng', 44.05, null, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'gps rejected', 'submit_location rejects a NULL longitude');
select throws_ok(
  $$ select public.submit_location('NaN lat', 'NaN'::numeric, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'gps rejected', 'submit_location rejects a NaN latitude');
select throws_ok(
  $$ select public.submit_location('Inf lng', 44.05, 'Infinity'::numeric, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'gps rejected', 'submit_location rejects an infinite longitude');
select throws_ok(
  $$ select public.submit_location('Lat 200', 200, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'gps rejected', 'submit_location rejects latitude > 90 instead of letting PostGIS wrap it');
select throws_ok(
  $$ select public.submit_location('Lng -181', 44.05, -181, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'gps rejected', 'submit_location rejects longitude < -180');

-- Boundary values remain valid measurements.
select lives_ok(
  $$ select public.submit_location('Edge', 90, -180, 10::numeric, false, now(), 'chill_spot') $$,
  'submit_location still accepts the inclusive bounds lat=90, lng=-180');

-- ═══ (b) p_mocked = NULL ══════════════════════════════════════════════════════
select throws_ok(
  $$ select public.submit_location('Null mocked', 44.05, -123.09, 10::numeric, null, now(), 'chill_spot') $$,
  'P0001', 'gps rejected', 'submit_location rejects p_mocked = NULL (D-45 requires proof of an unmocked fix)');

select pg_temp.act_as('a7000000-0000-0000-0000-000000000002');

select is(
  public.verify_location('57000000-0000-0000-0000-000000000001', 44.00, -123.00, 10, null, now()),
  '{"accepted": false}'::jsonb,
  'verify_location returns the reason-free rejection for p_mocked = NULL');
select is(
  (select count(*)::int from public.verification_events
    where submission_id = '57000000-0000-0000-0000-000000000001'
      and user_id = 'a7000000-0000-0000-0000-000000000002'),
  0,
  'a p_mocked = NULL verification records no event');
select is(
  (select confirmation_count from public.submissions where id = '57000000-0000-0000-0000-000000000001'),
  1,
  'a p_mocked = NULL verification does not advance the confirmation count');

-- ═══ (c) submit_location name ═════════════════════════════════════════════════
select pg_temp.act_as('a7000000-0000-0000-0000-000000000001');

select throws_ok(
  $$ select public.submit_location(null, 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'submit_location rejects a NULL name (it could never publish)');
select throws_ok(
  $$ select public.submit_location('   ', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'submit_location rejects a blank name');
select is(
  (select count(*)::int from public.submissions
    where submitter_id = 'a7000000-0000-0000-0000-000000000001'
      and (name is null or btrim(name) = '')),
  0,
  'no nameless pending submission was staged');

-- ═══ (d) cooldown timestamp is monotonic ══════════════════════════════════════
-- Simulates a concurrent call that claimed the cooldown 2s after this transaction's
-- now(): this (earlier-started) call must be rejected AND must not rewind the claim.
select pg_temp.act_as('a7000000-0000-0000-0000-000000000002');
delete from private.verification_rate_limits where user_id = 'a7000000-0000-0000-0000-000000000002';
insert into private.verification_rate_limits (user_id, last_verify_attempt_at)
values ('a7000000-0000-0000-0000-000000000002', now() + interval '2 seconds');

select is(
  public.verify_location('57000000-0000-0000-0000-000000000001', 44.00, -123.00, 10, false, now()),
  '{"accepted": false}'::jsonb,
  'a call inside the cooldown window is rejected');
select is(
  (select last_verify_attempt_at from private.verification_rate_limits
    where user_id = 'a7000000-0000-0000-0000-000000000002'),
  now() + interval '2 seconds',
  'verify_location does not move last_verify_attempt_at backwards');

-- ═══ (e) real caller roles ════════════════════════════════════════════════════
-- Everything above runs as the pgTAP connection role (postgres), which bypasses the
-- execute ACL. These cases switch the actual SQL role so the grants, not just the
-- function bodies, are exercised: anon is denied both RPCs outright, and an
-- authenticated caller reaches the new validation paths.
delete from private.verification_rate_limits where user_id = 'a7000000-0000-0000-0000-000000000002';

set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
select throws_ok(
  $$ select public.submit_location('Anon', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  '42501', null, 'anon cannot execute submit_location (execute revoked)');
select throws_ok(
  $$ select public.verify_location('57000000-0000-0000-0000-000000000001', 44.00, -123.00, 10, false, now()) $$,
  '42501', null, 'anon cannot execute verify_location (execute revoked)');
reset role;

select pg_temp.act_as('a7000000-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ select public.submit_location('Role ok', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'an authenticated caller can submit a valid location');
select throws_ok(
  $$ select public.submit_location('   ', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'as authenticated: a blank name is rejected');
-- btrim() strips only spaces; a tab or newline name must be rejected too.
select throws_ok(
  $$ select public.submit_location(chr(9), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'as authenticated: a tab-only name is rejected');
select throws_ok(
  $$ select public.submit_location(chr(10) || ' ' || chr(13), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'as authenticated: a newline/space/carriage-return name is rejected');
select throws_ok(
  $$ select public.submit_location('Role null mocked', 44.05, -123.09, 10::numeric, null, now(), 'chill_spot') $$,
  'P0001', 'gps rejected', 'as authenticated: p_mocked = NULL is rejected');
select throws_ok(
  $$ select public.submit_location('Role lat 200', 200, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'gps rejected', 'as authenticated: an out-of-range latitude is rejected');
reset role;

select pg_temp.act_as('a7000000-0000-0000-0000-000000000002');
set local role authenticated;
select is(
  public.verify_location('57000000-0000-0000-0000-000000000001', 44.00, -123.00, 10, null, now()),
  '{"accepted": false}'::jsonb,
  'as authenticated: verify_location rejects p_mocked = NULL');
reset role;

select is(
  (select count(*)::int from public.verification_events
    where submission_id = '57000000-0000-0000-0000-000000000001'
      and user_id = 'a7000000-0000-0000-0000-000000000002'),
  0,
  'the authenticated p_mocked = NULL call recorded no event');

select * from finish();
rollback;
