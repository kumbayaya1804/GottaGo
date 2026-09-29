-- Phase 5 (05-02 Task 3) — pgTAP suite for verify_location, the atomic publish,
-- trust appends, and the submit_location creator-evidence rewrite.
--
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ THIS FILE MUST NOT BE RUN WITH PLAIN `supabase test db`.                  ║
-- ║                                                                           ║
-- ║   node supabase/scripts/run-isolated-db-suite.js \                        ║
-- ║        supabase/tests/phase5_verify_publish.test.sql                      ║
-- ║                                                                           ║
-- ║ The HISTORICAL-VERIFIER-SHADOWBAN-RACE fixture below COMMITS a real global ║
-- ║ mutation to app_config.submission_publish_threshold, because a            ║
-- ║ transaction-local override is invisible to the separate connections the   ║
-- ║ race needs, and a shadow row is impossible (app_config.key is the PK).    ║
-- ║ Two concurrent invocations sharing this repo's fixed `Gotta_Go` project/  ║
-- ║ ports would interleave that mutation and its restore, silently            ║
-- ║ invalidating one run's race. "Serialized within one pgTAP process" does   ║
-- ║ NOT protect against two SEPARATE suite invocations on the same database.  ║
-- ║ The isolated runner provisions a unique project_id + random free ports    ║
-- ║ into a disposable temp copy of supabase/ and always attempts teardown.    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- Executed for real (2026-07-31, Docker became available in this environment): all 86
-- assertions passed at the time (the file now plans 111), including all four required two-session races (creator-shadowban,
-- historical-verifier-shadowban, current-caller-shadowban, reciprocal lock-order
-- deadlock), run repeatedly to confirm the manual cleanup leaves no residue. Still a
-- BLOCKING pre-push gate — the final authoritative pre-push run MUST go through
-- `node supabase/scripts/run-isolated-db-suite.js`, never plain `supabase test db`
-- against the shared dev stack, per this file's own disposable-instance requirement.
--
-- COOLDOWN NOTE (affects every fixture): now() is the TRANSACTION timestamp and is
-- constant inside this begin/rollback block, so a user's second verify_location call
-- always looks "0 seconds since last attempt" and is cooldown-rejected. Any test that
-- needs the same identity to verify twice must first clear that user's rate-limit row
-- (see reset_cooldown() below). This is a property of the D-36 design working
-- correctly, not a workaround.

-- plan() MUST be called BEFORE begin, not inside it. Verified empirically (root-caused
-- via a minimal repro): plan()'s internal state is not purely sequence-based — some of
-- it lives in an object that IS subject to transactional rollback, so calling plan()
-- inside a begin/rollback block silently loses that state once the single-session
-- section below rolls back, and the very first assertion in the committed race section
-- afterward fails with "You tried to run a test without a plan!" even though the
-- rolled-back section's own 58 assertions all counted correctly (the running counter
-- itself IS sequence-based and does survive rollback — only the plan value does not).
create extension if not exists pgtap with schema extensions;
select plan(111);
begin;

-- ─── Identities ──────────────────────────────────────────────────────────────
-- Inserting into auth.users fires handle_new_user, provisioning public.users.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'a1111111-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p5vp-creator@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'b2222222-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'p5vp-verifier1@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'c3333333-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'p5vp-verifier2@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'd4444444-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'p5vp-shadowbanned@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'e5555555-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'p5vp-sbcreator@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'f6666666-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'p5vp-nulltrust@example.com');

-- Seed trust_score BELOW the 9 ceiling so an award is observable. On the live 0-9
-- scale with default 9, a +1 reward on a fresh account is a no-op (the score is
-- already saturated), so a test seeded at 9 would pass even if the score sync were
-- entirely missing. This is the single most important fixture detail in the file.
update public.users set trust_score = 5, trust_multiplier = 0.5
 where id in ('a1111111-0000-0000-0000-000000000001',
              'b2222222-0000-0000-0000-000000000002',
              'c3333333-0000-0000-0000-000000000003',
              'e5555555-0000-0000-0000-000000000005');

update public.users set shadowban_status = true, trust_score = 5
 where id = 'd4444444-0000-0000-0000-000000000004';

-- Explicit NULL trust_score — the coalesce(trust_score, 9) case.
update public.users set trust_score = null where id = 'f6666666-0000-0000-0000-000000000006';

-- ─── Submissions (all at the same point; verifiers stand 0m away) ────────────
insert into public.submissions
  (id, submitter_id, status, confirmation_count, name, coordinates, policy_tag, expires_at)
values
  ('50000000-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'pending', 1, 'SUB publish',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days'),
  ('50000000-0000-0000-0000-000000000002', 'a1111111-0000-0000-0000-000000000001', 'pending', 1, 'SUB reject-paths',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days'),
  ('50000000-0000-0000-0000-000000000003', 'a1111111-0000-0000-0000-000000000001', 'pending', 1, 'SUB shadowban-verifier',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days'),
  ('50000000-0000-0000-0000-000000000004', 'e5555555-0000-0000-0000-000000000005', 'pending', 1, 'SUB shadowbanned-creator',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days'),
  ('50000000-0000-0000-0000-000000000005', 'a1111111-0000-0000-0000-000000000001', 'expired', 1, 'SUB non-pending',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days'),
  ('50000000-0000-0000-0000-000000000006', 'a1111111-0000-0000-0000-000000000001', 'pending', 1, 'SUB expired',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() - interval '1 day'),
  ('50000000-0000-0000-0000-000000000007', 'a1111111-0000-0000-0000-000000000001', 'pending', 1, 'SUB null-trust verifier',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days'),
  ('50000000-0000-0000-0000-000000000008', 'a1111111-0000-0000-0000-000000000001', 'pending', 1, 'SUB tags',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days');

-- Staged accessibility selections for the tag-copy assertion.
insert into public.submission_tags (submission_id, key, value) values
  ('50000000-0000-0000-0000-000000000008', 'changing_table', 'true'),
  ('50000000-0000-0000-0000-000000000008', 'wheelchair',     'true');

-- ─── Helpers ─────────────────────────────────────────────────────────────────
create or replace function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end; $$;

-- Clears the D-36 cooldown so the same identity can legitimately verify again
-- within this single-timestamp transaction (see the COOLDOWN NOTE in the header).
create or replace function pg_temp.reset_cooldown(p_uid uuid) returns void
language plpgsql as $$
begin
  delete from private.verification_rate_limits where user_id = p_uid;
end; $$;

-- A valid, in-range, fresh GPS sample at the submission's exact coordinates.
create or replace function pg_temp.verify_ok(p_sub uuid) returns jsonb
language plpgsql as $$
begin
  return public.verify_location(p_sub, 44.00, -123.00, 10, false, now());
end; $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1 — Reason-free rejection contract (SC7) + durable cooldown (D-36)
-- ═══════════════════════════════════════════════════════════════════════════════
select pg_temp.act_as('b2222222-0000-0000-0000-000000000002');

select is(
  public.verify_location('50000000-0000-0000-0000-000000000002', 44.00, -123.00, 10, true, now()),
  '{"accepted": false}'::jsonb,
  'p_mocked=true returns the reason-free accepted=false shape (D-45, no weight-0 acceptance)');

-- The cooldown write from that REJECTED attempt must have survived the return. If
-- verify_location had raised instead, PostgreSQL would have rolled this row back and
-- a rejected attempt would cost an attacker nothing.
select isnt(
  (select r.last_verify_attempt_at from private.verification_rate_limits r
    where r.user_id = 'b2222222-0000-0000-0000-000000000002'),
  null,
  'a REJECTED attempt still consumed the cooldown — the timestamp write committed (D-36)');

-- Still inside the cooldown window, so this returns the SAME shape with no reason.
select is(
  pg_temp.verify_ok('50000000-0000-0000-0000-000000000002'),
  '{"accepted": false}'::jsonb,
  'a too-soon retry returns the same reason-free shape and leaks no reason');

select is(
  (select count(*)::integer from public.verification_events ve
    where ve.submission_id = '50000000-0000-0000-0000-000000000002'),
  0,
  'no verification_events row is recorded for any rejected attempt');

select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  public.verify_location('50000000-0000-0000-0000-000000000002', 44.00, -123.00, 51, false, now()),
  '{"accepted": false}'::jsonb,
  'accuracy above accuracy_floor_m (50) is rejected OUTRIGHT, not accepted at weight 0 (D-46)');

-- A NEGATIVE accuracy is not a physical measurement. Without a lower bound it passes the
-- upper-bound floor above and inflates the accuracy factor (1 - acc/span > 1), so the event
-- would be admitted at MORE than full weight. Must be rejected outright, creating no event.
select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  public.verify_location('50000000-0000-0000-0000-000000000002', 44.00, -123.00, -100, false, now()),
  '{"accepted": false}'::jsonb,
  'a NEGATIVE accuracy is rejected OUTRIGHT and never admitted at inflated weight');
select is(
  (select count(*)::integer from public.verification_events ve
    where ve.submission_id = '50000000-0000-0000-0000-000000000002'),
  0,
  'the negative-accuracy attempt recorded no verification_events row');

-- Non-finite accuracy values must also be rejected outright (numeric admits NaN and
-- +/-Infinity; NaN sorts above every finite value, so the cap comparison catches it).
select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  public.verify_location('50000000-0000-0000-0000-000000000002', 44.00, -123.00, 'NaN'::numeric, false, now()),
  '{"accepted": false}'::jsonb,
  'a NaN accuracy is rejected OUTRIGHT by verify_location');
select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  public.verify_location('50000000-0000-0000-0000-000000000002', 44.00, -123.00, 'Infinity'::numeric, false, now()),
  '{"accepted": false}'::jsonb,
  'a +Infinity accuracy is rejected OUTRIGHT by verify_location');
select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  public.verify_location('50000000-0000-0000-0000-000000000002', 44.00, -123.00, '-Infinity'::numeric, false, now()),
  '{"accepted": false}'::jsonb,
  'a -Infinity accuracy is rejected OUTRIGHT by verify_location');

select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  public.verify_location('50000000-0000-0000-0000-000000000002', 44.00, -123.00, 10, false, now() - interval '10 minutes'),
  '{"accepted": false}'::jsonb,
  'a stale GPS fix (older than max_gps_age_s) is rejected');

select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  public.verify_location('50000000-0000-0000-0000-000000000002', 44.00, -123.00, 10, false, now() + interval '1 hour'),
  '{"accepted": false}'::jsonb,
  'a FUTURE-dated GPS fix is rejected (WR-02 parity with submit_location)');

-- ~0.02 degrees of longitude at this latitude is well beyond the 100m hard gate.
select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  public.verify_location('50000000-0000-0000-0000-000000000002', 44.00, -123.02, 10, false, now()),
  '{"accepted": false}'::jsonb,
  'distance beyond verify_radius_m is a HARD reject, distinct from the D-56 decay');

select is(
  (select count(*)::integer from public.verification_events ve
    where ve.submission_id = '50000000-0000-0000-0000-000000000002'),
  0,
  'the out-of-range reject recorded no event and took no user-row lock');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2 — Target authorization (discovery filtering is NOT authorization)
-- ═══════════════════════════════════════════════════════════════════════════════
select pg_temp.act_as('a1111111-0000-0000-0000-000000000001');
select pg_temp.reset_cooldown('a1111111-0000-0000-0000-000000000001');
select is(
  pg_temp.verify_ok('50000000-0000-0000-0000-000000000002'),
  '{"accepted": false}'::jsonb,
  'the creator cannot verify their OWN submission (sockpuppet self-publish blocked)');

select pg_temp.act_as('b2222222-0000-0000-0000-000000000002');
select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  pg_temp.verify_ok('50000000-0000-0000-0000-000000000005'),
  '{"accepted": false}'::jsonb,
  'a NON-PENDING submission is rejected server-side');

select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  pg_temp.verify_ok('50000000-0000-0000-0000-000000000006'),
  '{"accepted": false}'::jsonb,
  'an EXPIRED submission is rejected server-side');

select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  pg_temp.verify_ok('50000000-0000-0000-0000-0000000000ff'),
  '{"accepted": false}'::jsonb,
  'a MISSING submission returns the same shape (no existence oracle)');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3 — Shadowbanned verifier: accepted at weight 0, zero influence (D-38)
-- ═══════════════════════════════════════════════════════════════════════════════
select pg_temp.act_as('d4444444-0000-0000-0000-000000000004');
select pg_temp.reset_cooldown('d4444444-0000-0000-0000-000000000004');
select is(
  pg_temp.verify_ok('50000000-0000-0000-0000-000000000003'),
  '{"accepted": true}'::jsonb,
  'a shadowbanned user''s event is ACCEPTED (silently, no reason leaked)');

select is(
  (select ve.weight from public.verification_events ve
    where ve.submission_id = '50000000-0000-0000-0000-000000000003'
      and ve.user_id = 'd4444444-0000-0000-0000-000000000004'),
  0::numeric,
  'the shadowbanned event carries weight = 0');

select is(
  (select s.status from public.submissions s where s.id = '50000000-0000-0000-0000-000000000003'),
  'pending',
  'a shadowbanned event never advances the publish count');

select is(
  (select count(*)::integer from public.trust_events te
    where te.user_id = 'd4444444-0000-0000-0000-000000000004'
      and te.action_type = 'verification_given_nonzero'),
  0,
  'a shadowbanned (weight-0) event appends NO verification_given_nonzero row');

select is(
  (select u.trust_multiplier from public.users u where u.id = 'd4444444-0000-0000-0000-000000000004'),
  0.5::numeric,
  'a shadowbanned event does NOT ramp trust_multiplier');

select is(
  (select u.trust_score from public.users u where u.id = 'd4444444-0000-0000-0000-000000000004'),
  5,
  'a shadowbanned event does NOT change trust_score');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4 — The deciding verification publishes atomically, with every side effect
-- ═══════════════════════════════════════════════════════════════════════════════
select pg_temp.act_as('b2222222-0000-0000-0000-000000000002');
select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select is(
  pg_temp.verify_ok('50000000-0000-0000-0000-000000000001'),
  '{"accepted": true}'::jsonb,
  'creator implicit claim + ONE distinct qualifying verifier is accepted');

select is(
  (select s.status from public.submissions s where s.id = '50000000-0000-0000-0000-000000000001'),
  'published',
  'threshold 2 (creator claim + 1 independent verifier) publishes the submission');

select is(
  (select count(*)::integer from public.locations l
     join public.submissions s on s.location_id = l.id
    where s.id = '50000000-0000-0000-0000-000000000001'),
  1,
  'EXACTLY ONE locations row is created by the publish');

select is(
  (select l.confidence_value from public.locations l
     join public.submissions s on s.location_id = l.id
    where s.id = '50000000-0000-0000-0000-000000000001'),
  (select c.value::numeric from public.app_config c where c.key = 'confidence_publish_start'),
  'the new location starts at the MID-tier publish value, not the maximum (D-55)');

select is(
  (select l.shadowban_status from public.locations l
     join public.submissions s on s.location_id = l.id
    where s.id = '50000000-0000-0000-0000-000000000001'),
  false,
  'a NON-shadowbanned creator yields shadowban_status=false — publicly visible');

-- Verifier trust: BOTH axes plus the ledger, asserted separately from the creator's.
select is(
  (select count(*)::integer from public.trust_events te
    where te.user_id = 'b2222222-0000-0000-0000-000000000002'
      and te.action_type = 'verification_given_nonzero'
      and te.delta > 0),
  1,
  'the verifier earns exactly one verification_given_nonzero append with a POSITIVE delta (sign matches action_type)');

select is(
  (select u.trust_score from public.users u where u.id = 'b2222222-0000-0000-0000-000000000002'),
  6,
  'SC6: the verifier''s users.trust_score actually MOVED 5 -> 6 — ledger and score never diverge');

select is(
  (select u.trust_multiplier from public.users u where u.id = 'b2222222-0000-0000-0000-000000000002'),
  0.55::numeric,
  'the verifier''s trust_multiplier ramped by trust_multiplier_step (D-48, distinct axis)');

-- Creator trust: earned ONLY at publication (D-50), asserted separately.
select is(
  (select count(*)::integer from public.trust_events te
    where te.user_id = 'a1111111-0000-0000-0000-000000000001'
      and te.action_type = 'published_contribution'
      and te.context_ref = '50000000-0000-0000-0000-000000000001'),
  1,
  'the creator earns exactly one published_contribution append, and only on publish (D-50)');

select is(
  (select u.trust_score from public.users u where u.id = 'a1111111-0000-0000-0000-000000000001'),
  6,
  'SC6: the creator''s users.trust_score actually MOVED 5 -> 6 on publication');

select is(
  (select u.gps_verified_contribution_count from public.users u
    where u.id = 'b2222222-0000-0000-0000-000000000002'),
  1,
  'the qualifying verifier''s distinct-bathrooms impact count incremented exactly once (D-65)');

select is(
  (select count(*)::integer from public.notification_outbox o
    where o.submission_id = '50000000-0000-0000-0000-000000000001'
      and o.recipient_user_id = 'a1111111-0000-0000-0000-000000000001'),
  1,
  'exactly one CREATOR-ONLY outbox row was enqueued in the publish transaction (D-67)');

select is(
  (select s.publication_seen_at from public.submissions s
    where s.id = '50000000-0000-0000-0000-000000000001'),
  null,
  'publication_seen_at starts null so the D-68 in-app fallback is reachable');

-- Idempotency (D-43): a retried call by the SAME user hits the verification_events
-- unique-conflict path and returns accepted:true with no second count or side effect.
-- Under this project's locked submission_publish_threshold=2, the creator's implicit
-- claim plus ANY single qualifying (weight>0) verifier ALWAYS publishes on that
-- verifier's first call — so a retry by a QUALIFYING verifier can never reach this
-- path at all: Step 3's `status is distinct from 'pending'` gate intercepts it first
-- (confirmed empirically: retrying as B on the now-published submission 001 above
-- returns accepted:false, not true — Step 3 runs BEFORE Step 7's insert/unique_violation
-- handling and is unconditional on caller identity). The unique-conflict path is
-- therefore only reachable for a caller whose event does NOT cross the threshold —
-- the shadowbanned (weight=0) verifier D on submission 003 (section 3 above), whose
-- calls never publish, is the correct fixture to exercise it.
select pg_temp.act_as('d4444444-0000-0000-0000-000000000004');
select pg_temp.reset_cooldown('d4444444-0000-0000-0000-000000000004');
select is(
  pg_temp.verify_ok('50000000-0000-0000-0000-000000000003'),
  '{"accepted": true}'::jsonb,
  'a duplicate call by the same (shadowbanned, non-decisive) caller is idempotent and reason-free (D-43)');

select is(
  (select count(*)::integer from public.verification_events ve
    where ve.submission_id = '50000000-0000-0000-0000-000000000003'
      and ve.user_id = 'd4444444-0000-0000-0000-000000000004'),
  1,
  'the D-43 uniqueness index kept it at ONE event for this user/submission');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5 — Staged accessibility tags are copied into the LIVE tags vocabulary
-- ═══════════════════════════════════════════════════════════════════════════════
select pg_temp.act_as('c3333333-0000-0000-0000-000000000003');
select pg_temp.reset_cooldown('c3333333-0000-0000-0000-000000000003');
select ok(
  (pg_temp.verify_ok('50000000-0000-0000-0000-000000000008') ->> 'accepted')::boolean,
  'the tagged submission publishes');

-- The staging keys are NOT the public vocabulary. A verbatim key copy would produce
-- tags that the Phase 3 filter subqueries can never match, so the mapping is asserted
-- explicitly rather than just counting rows.
select is(
  (select count(*)::integer from public.tags t
     join public.submissions s on s.location_id = t.location_id
    where s.id = '50000000-0000-0000-0000-000000000008'
      and t.key = 'amenity' and t.value = 'changing_table'),
  1,
  'changing_table is copied as (key=amenity, value=changing_table) — the vocabulary the readers match');

select is(
  (select count(*)::integer from public.tags t
     join public.submissions s on s.location_id = t.location_id
    where s.id = '50000000-0000-0000-0000-000000000008'
      and t.key = 'accessibility' and t.value = 'wheelchair'),
  1,
  'wheelchair is copied as (key=accessibility, value=wheelchair)');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6 — D-69: a shadowbanned CREATOR publishes SUPPRESSED and earns no trust
-- ═══════════════════════════════════════════════════════════════════════════════
update public.users set shadowban_status = true
 where id = 'e5555555-0000-0000-0000-000000000005';

select pg_temp.act_as('b2222222-0000-0000-0000-000000000002');
select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select ok(
  (pg_temp.verify_ok('50000000-0000-0000-0000-000000000004') ->> 'accepted')::boolean,
  'a shadowbanned creator''s submission still ACCEPTS the verification');

select is(
  (select s.status from public.submissions s where s.id = '50000000-0000-0000-0000-000000000004'),
  'published',
  'D-69: the creator''s implicit claim still counts — publication still happens');

select is(
  (select l.shadowban_status from public.locations l
     join public.submissions s on s.location_id = l.id
    where s.id = '50000000-0000-0000-0000-000000000004'),
  true,
  'D-69: the published row INHERITS shadowban_status=true from the creator');

-- Suppression is not a new mechanism — it is the same filter Phase 3 already applies.
select is(
  (select count(*)::integer
     from public.search_locations_nearby(44.00, -123.00, 50) n
     join public.submissions s on s.location_id = n.id
    where s.id = '50000000-0000-0000-0000-000000000004'),
  0,
  'the suppressed location is excluded from search_locations_nearby');

select is(
  (select count(*)::integer
     from public.search_locations_bbox(-123.10, 43.95, -122.90, 44.05) b
     join public.submissions s on s.location_id = b.id
    where s.id = '50000000-0000-0000-0000-000000000004'),
  0,
  'the suppressed location is excluded from search_locations_bbox');

select is(
  (select count(*)::integer from public.get_location_detail(
     (select s.location_id from public.submissions s where s.id = '50000000-0000-0000-0000-000000000004'))),
  0,
  'the suppressed location is excluded from get_location_detail');

-- Creator and verifier trust effects asserted SEPARATELY — "exactly one
-- published_contribution somewhere" would not prove who legitimately earned it.
select is(
  (select count(*)::integer from public.trust_events te
    where te.user_id = 'e5555555-0000-0000-0000-000000000005'
      and te.action_type = 'published_contribution'),
  0,
  'D-69: the shadowbanned creator earns NO published_contribution for the suppressed publish');

select is(
  (select u.trust_score from public.users u where u.id = 'e5555555-0000-0000-0000-000000000005'),
  5,
  'D-69: the shadowbanned creator''s trust_score is UNCHANGED (no silent credit)');

select is(
  (select count(*)::integer from public.trust_events te
    where te.user_id = 'b2222222-0000-0000-0000-000000000002'
      and te.action_type = 'verification_given_nonzero'
      and te.context_ref = '50000000-0000-0000-0000-000000000004'),
  1,
  'D-69: the deciding verifier''s contribution and trust ARE preserved on a suppressed publish');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7 — SC6 nullable-column case: coalesce(trust_score, 9) must not zero the row
-- ═══════════════════════════════════════════════════════════════════════════════
-- users.trust_score is NULLABLE. A naive least(9, greatest(0, trust_score + 1)) on a
-- NULL row collapses to exactly 0, because GREATEST/LEAST silently IGNORE NULL
-- arguments — the opposite of an increment, and invisible to any test seeded with a
-- non-null score. Expected here: coalesce(NULL,9)+1 = 10, clamped to 9.
select pg_temp.act_as('f6666666-0000-0000-0000-000000000006');
select pg_temp.reset_cooldown('f6666666-0000-0000-0000-000000000006');
select ok(
  (pg_temp.verify_ok('50000000-0000-0000-0000-000000000007') ->> 'accepted')::boolean,
  'the NULL-trust_score verifier''s event is accepted');

select is(
  (select u.trust_score from public.users u where u.id = 'f6666666-0000-0000-0000-000000000006'),
  9,
  'SC6 NULL case: a NULL trust_score anchors on coalesce(...,9) and clamps to 9 — never a silent 0');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8 — submit_location: WR-02 preserved, creator evidence written, overload gone
-- ═══════════════════════════════════════════════════════════════════════════════
select pg_temp.act_as('c3333333-0000-0000-0000-000000000003');

select throws_ok(
  $$select public.submit_location('WR02 regression', 44.0, -123.0, 10, false,
      now() + interval '1 hour', 'public_facility', null, null, null, null, null, false, false)$$,
  'gps rejected',
  'WR-02 regression: submit_location still rejects a FUTURE-dated p_captured_at');

select throws_ok(
  $$select public.submit_location('Negative accuracy', 44.0, -123.0, -100, false,
      now(), 'public_facility', null, null, null, null, null, false, false)$$,
  'gps rejected',
  'submit_location rejects a NEGATIVE accuracy (not a physical measurement)');

select throws_ok(
  $$select public.submit_location('NaN accuracy', 44.0, -123.0, 'NaN'::numeric,
      false, now(), 'public_facility', null, null, null, null, null, false, false)$$,
  'gps rejected',
  'submit_location rejects a NaN accuracy');
select throws_ok(
  $$select public.submit_location('Infinite accuracy', 44.0, -123.0, 'Infinity'::numeric,
      false, now(), 'public_facility', null, null, null, null, null, false, false)$$,
  'gps rejected',
  'submit_location rejects a +Infinity accuracy');

-- The creator_claim insert would fail outright on the NOT NULL weight column if the
-- explicit weight=0 were omitted, so a successful insert proves the constraint is met.
select lives_ok(
  $$select public.submit_location('Creator evidence', 44.0, -123.0, 10, false,
      now(), 'public_facility', null, null, null, null, null, true, true)$$,
  'submit_location succeeds and writes a creator_claim row (NOT NULL weight satisfied by the explicit 0)');

select is(
  (select ve.weight from public.verification_events ve
     join public.submissions s on s.id = ve.submission_id
    where s.name = 'Creator evidence' and ve.event_type = 'creator_claim'),
  0::numeric,
  'the creator_claim evidence row carries the intentional explicit weight = 0');

select is(
  (select count(*)::integer from public.submission_tags st
     join public.submissions s on s.id = st.submission_id
    where s.name = 'Creator evidence'),
  2,
  'the two Phase 4 accessibility selections are finally FORWARDED and staged, not discarded');

-- Catalog assertion: exactly one submit_location signature may remain callable.
select is(
  (select count(*)::integer
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_location'),
  1,
  'the stale 12-argument submit_location overload is GONE — only the new signature exists');

select is(
  (select p.proconfig
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_location'),
  array['search_path=""'],
  'the new submit_location signature is hardened to a fixed EMPTY search_path');

select is(
  (select p.proconfig
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'verify_location'),
  array['search_path=""'],
  'verify_location pins a fixed EMPTY search_path');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9 — D-52: shadowban AFTER a genuine event removes decision-time eligibility
-- ═══════════════════════════════════════════════════════════════════════════════
-- Single-session (sequential) form. The CONCURRENT forms live in the companion race
-- file; see the note at the end of this suite.
insert into public.submissions
  (id, submitter_id, status, confirmation_count, name, coordinates, policy_tag, expires_at)
values
  ('50000000-0000-0000-0000-00000000000a', 'a1111111-0000-0000-0000-000000000001', 'pending', 1, 'SUB d52',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days');

-- A records a genuine nonzero-weight event, then is shadowbanned before the decision.
select pg_temp.act_as('c3333333-0000-0000-0000-000000000003');
select pg_temp.reset_cooldown('c3333333-0000-0000-0000-000000000003');
select ok(
  (pg_temp.verify_ok('50000000-0000-0000-0000-00000000000a') ->> 'accepted')::boolean,
  'D-52 setup: verifier C records a genuine nonzero-weight event');

-- That event alone published it (threshold 2), so re-open the submission to model a
-- still-pending row carrying an already-recorded verifier, then shadowban that user.
update public.submissions set status = 'pending', location_id = null
 where id = '50000000-0000-0000-0000-00000000000a';
update public.users set shadowban_status = true
 where id = 'c3333333-0000-0000-0000-000000000003';

select is(
  (select ve.weight > 0 from public.verification_events ve
    where ve.submission_id = '50000000-0000-0000-0000-00000000000a'
      and ve.user_id = 'c3333333-0000-0000-0000-000000000003'),
  true,
  'D-52: the shadowbanned user''s immutable event is NOT rewritten — history is preserved');

-- The now-ineligible verifier must no longer count, so a fresh eligible verifier is
-- required to reach the threshold. B is already at 9 trust here; that is irrelevant to
-- the count assertion below.
select pg_temp.act_as('b2222222-0000-0000-0000-000000000002');
select pg_temp.reset_cooldown('b2222222-0000-0000-0000-000000000002');
select ok(
  (pg_temp.verify_ok('50000000-0000-0000-0000-00000000000a') ->> 'accepted')::boolean,
  'a currently-eligible second verifier is accepted');

select is(
  (select s.confirmation_count from public.submissions s
    where s.id = '50000000-0000-0000-0000-00000000000a'),
  2,
  'D-52: the count is creator(1) + eligible B(1) = 2 — the shadowbanned C no longer counts despite weight>0');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9 — D-68 publication fallback RPCs: owner-scoped read + acknowledge
-- ═══════════════════════════════════════════════════════════════════════════════
-- get_my_unseen_submission_publications / acknowledge_submission_publication are
-- SECURITY DEFINER, so the ONLY thing standing between one creator and another creator's
-- publication state is the submitter_id = auth.uid() predicate. Those predicates are
-- exercised here rather than trusted from the source.
insert into public.submissions
  (id, submitter_id, status, confirmation_count, name, coordinates, policy_tag, expires_at, publication_seen_at)
values
  ('50000000-0000-0000-0000-0000000000d1', 'a1111111-0000-0000-0000-000000000001', 'published', 2, 'D68 owner A published',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days', null),
  ('50000000-0000-0000-0000-0000000000d2', 'b2222222-0000-0000-0000-000000000002', 'published', 2, 'D68 owner B published',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days', null),
  ('50000000-0000-0000-0000-0000000000d3', 'a1111111-0000-0000-0000-000000000001', 'pending', 1, 'D68 owner A still pending',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days', null);

select pg_temp.act_as('a1111111-0000-0000-0000-000000000001');
select is(
  (select coalesce(array_agg(g.submission_id order by g.submission_id), array[]::uuid[])
     from public.get_my_unseen_submission_publications() g
    where g.submission_id in ('50000000-0000-0000-0000-0000000000d1',
                              '50000000-0000-0000-0000-0000000000d2',
                              '50000000-0000-0000-0000-0000000000d3')),
  array['50000000-0000-0000-0000-0000000000d1']::uuid[],
  'D-68: the owner sees only THEIR OWN published, unseen submission — not another creator''s, not their pending one');

select pg_temp.act_as('b2222222-0000-0000-0000-000000000002');
select is(
  (select coalesce(array_agg(g.submission_id order by g.submission_id), array[]::uuid[])
     from public.get_my_unseen_submission_publications() g
    where g.submission_id in ('50000000-0000-0000-0000-0000000000d1',
                              '50000000-0000-0000-0000-0000000000d2',
                              '50000000-0000-0000-0000-0000000000d3')),
  array['50000000-0000-0000-0000-0000000000d2']::uuid[],
  'D-68: a different creator sees only their own — never the first owner''s row');

-- B tries to acknowledge A's publication: silent no-op, A's row is untouched.
select public.acknowledge_submission_publication('50000000-0000-0000-0000-0000000000d1');
select is(
  (select s.publication_seen_at is null from public.submissions s
    where s.id = '50000000-0000-0000-0000-0000000000d1'),
  true,
  'D-68: a NON-owner''s acknowledge does not touch another creator''s row');

select pg_temp.act_as('a1111111-0000-0000-0000-000000000001');
select public.acknowledge_submission_publication('50000000-0000-0000-0000-0000000000d1');
select is(
  (select s.publication_seen_at is not null from public.submissions s
    where s.id = '50000000-0000-0000-0000-0000000000d1'),
  true,
  'D-68: the OWNER''s acknowledge stamps publication_seen_at');

select is(
  (select s.publication_seen_at is null from public.submissions s
    where s.id = '50000000-0000-0000-0000-0000000000d2'),
  true,
  'D-68: acknowledging one creator''s submission never alters another creator''s row');

select is(
  (select count(*)::integer from public.get_my_unseen_submission_publications() g
    where g.submission_id = '50000000-0000-0000-0000-0000000000d1'),
  0,
  'D-68: an acknowledged publication no longer appears in the owner''s unseen list');

-- No authenticated identity at all (auth.uid() is null).
select set_config('request.jwt.claims', '{}', true);
select is(
  (select count(*)::integer from public.get_my_unseen_submission_publications()),
  0,
  'D-68: with no identity the read RPC returns zero rows');
select throws_ok(
  $$select public.acknowledge_submission_publication('50000000-0000-0000-0000-0000000000d2')$$,
  'not authenticated',
  'D-68: with no identity the acknowledge RPC raises rather than silently succeeding');

-- Grants: anon must have no EXECUTE on either function; authenticated must have it.
select is(
  array[
    has_function_privilege('anon', 'public.get_my_unseen_submission_publications()', 'execute'),
    has_function_privilege('anon', 'public.acknowledge_submission_publication(uuid)', 'execute')],
  array[false, false],
  'D-68: anon has no EXECUTE on either publication RPC');
select is(
  array[
    has_function_privilege('authenticated', 'public.get_my_unseen_submission_publications()', 'execute'),
    has_function_privilege('authenticated', 'public.acknowledge_submission_publication(uuid)', 'execute')],
  array[true, true],
  'D-68: authenticated has EXECUTE on both publication RPCs');

rollback;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10 — TWO-SESSION CONCURRENCY RACES (creator/historical-verifier/current-caller
-- shadowban vs. publish, and the reciprocal-user lock-order deadlock case)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Deliberately OUTSIDE the begin/rollback block above, for the identical reason
-- documented in phase5_discovery_cooldown_race.test.sql: a dblink connection is a
-- genuinely separate backend and can never see this session's own uncommitted rows,
-- so proving the step-5b lock actually blocks a concurrent session requires real
-- COMMITTED fixture rows, not rollback-cleaned ones. Every statement below runs in
-- implicit autocommit (no open transaction), and every fixture this section commits
-- is deleted explicitly at the end (see CLEANUP below) rather than relying on
-- rollback — verified empirically that pgTAP's plan()/finish() counter survives an
-- intervening rollback (it is sequence-backed, not transactional), so one continuous
-- plan(46 + 19) / finish() pair correctly spans both the rolled-back section above
-- and this committed section below.
--
-- Connection mechanism: see phase5_discovery_cooldown_race.test.sql's header for the
-- full round-1/round-2/round-3 history. Round 3 (verified working here too): dial the
-- CURRENT session's own real, non-loopback interface address via
-- host(inet_server_addr()) rather than any loopback address — Linux rewrites the
-- SOURCE address of any loopback-destined connection to 127.0.0.1 regardless of which
-- specific loopback address was dialed, which always lands on pg_hba.conf's
-- `127.0.0.1/32 trust` rule and therefore never actually consumes the supplied
-- password, failing dblink's non-superuser password-auth requirement. Targeting the
-- real interface address avoids that rewrite and lands on the `scram-sha-256`
-- catch-all instead, which genuinely authenticates with the ordinary `postgres` role
-- (confirmed non-superuser in this image — no elevated role needed).
create extension if not exists dblink with schema extensions;

do $$
declare
  v_addr text := host(inet_server_addr());
  v_port text := inet_server_port()::text;
begin
  if v_addr is null or v_port is null then
    raise exception 'phase5_verify_publish two-session races require a real TCP connection (inet_server_addr()/inet_server_port() returned NULL) — run via `supabase test db`/the isolated runner, never a local Unix socket.';
  end if;
  create temp table phase5_race_self_conn (addr text not null, port text not null);
  insert into phase5_race_self_conn (addr, port) values (v_addr, v_port);
end
$$;

create or replace function pg_temp.race_connstr() returns text
language sql stable as $$
  select 'hostaddr=' || addr || ' port=' || port || ' dbname=' || current_database() || ' user=postgres password=postgres'
    from phase5_race_self_conn;
$$;

-- Polls pg_stat_activity for the given backend pid until it is OBSERVED waiting on a
-- lock (not merely "probably blocked by now") — the same deterministic proof
-- phase5_discovery_cooldown_race.test.sql uses, factored out here since all four
-- races below need it.
create or replace function pg_temp.race_wait_blocked(p_pid int, p_timeout_s numeric default 5) returns boolean
language plpgsql as $$
declare
  v_deadline timestamptz := clock_timestamp() + make_interval(secs => p_timeout_s);
  v_wait_type text;
begin
  while clock_timestamp() < v_deadline loop
    select wait_event_type into v_wait_type from pg_stat_activity where pid = p_pid;
    if v_wait_type = 'Lock' then
      return true;
    end if;
    perform pg_sleep(0.05);
  end loop;
  return false;
end;
$$;

-- ─── RACE 1: CREATOR-SHADOWBAN CONCURRENCY RACE (D-69, two-session) ─────────────
-- Session 1 shadowbans the CREATOR and holds the transaction open; session 2 is the
-- deciding verify_location call. Session 2 must demonstrably BLOCK on the creator's
-- row within the step-5b lock pass, then reflect the now-committed shadowban_status
-- once session 1 resolves — never a "sequential either/or" outcome.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'a6000001-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p5vpr1-creator@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'a6000001-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'p5vpr1-verifier@example.com');
update public.users set trust_score = 5 where id = 'a6000001-0000-0000-0000-000000000002';

insert into public.submissions
  (id, submitter_id, status, confirmation_count, name, coordinates, policy_tag, expires_at)
values
  ('76000001-0000-0000-0000-000000000001', 'a6000001-0000-0000-0000-000000000001', 'pending', 1, 'R1 creator-shadowban race',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days');

select dblink_connect('r1_a', pg_temp.race_connstr());
select dblink_connect('r1_b', pg_temp.race_connstr());
select dblink_exec('r1_b',
  $$SET request.jwt.claims TO '{"sub":"a6000001-0000-0000-0000-000000000002","role":"authenticated"}'$$);

select dblink_exec('r1_a', 'begin');
select dblink_exec('r1_a',
  $$update public.users set shadowban_status = true where id = 'a6000001-0000-0000-0000-000000000001'$$);

create temp table phase5_r1_pid_b as
  select pid from dblink('r1_b', 'select pg_backend_pid() as pid') as t(pid int);

-- Dispatch the REAL production RPC on B while A holds the creator's row locked.
select dblink_send_query('r1_b',
  $$select public.verify_location('76000001-0000-0000-0000-000000000001'::uuid, 44.00, -123.00, 10, false, now())::text$$);

create temp table phase5_r1_blocked (observed boolean not null default false);
insert into phase5_r1_blocked (observed) select pg_temp.race_wait_blocked(pid) from phase5_r1_pid_b;

-- A commits, releasing the lock; B's blocked call proceeds and observes the committed shadowban.
select dblink_exec('r1_a', 'commit');
create temp table phase5_r1_result as
  select result from dblink_get_result('r1_b') as t(result text);
select result from dblink_get_result('r1_b') as t(result text);  -- drain the terminating result set (dblink async protocol)

select dblink_disconnect('r1_a');
select dblink_disconnect('r1_b');

select ok(
  (select observed from phase5_r1_blocked),
  'RACE 1 (CREATOR-SHADOWBAN): the deciding verify_location call was independently observed BLOCKED (wait_event_type=Lock) on the creator''s row while a concurrent transaction held it uncommitted');

select is(
  (select r.result from phase5_r1_result r),
  '{"accepted": true}',
  'RACE 1: once unblocked, the deciding call still returns accepted=true');

select is(
  (select s.status from public.submissions s where s.id = '76000001-0000-0000-0000-000000000001'),
  'published',
  'RACE 1: publication still happens — the creator''s implicit claim still counts even though the creator is now shadowbanned');

select is(
  (select l.shadowban_status from public.locations l join public.submissions s on s.location_id = l.id
    where s.id = '76000001-0000-0000-0000-000000000001'),
  true,
  'RACE 1: the published row inherited shadowban_status=true — proving the read happened under the step-5b lock against the now-committed post-race state, not a stale pre-race read');

select is(
  (select count(*)::integer from public.trust_events te
    where te.user_id = 'a6000001-0000-0000-0000-000000000001' and te.action_type = 'published_contribution'),
  0,
  'RACE 1 (D-69): the now-shadowbanned creator earns NO published_contribution for the suppressed publish');

select is(
  (select u.trust_score from public.users u where u.id = 'a6000001-0000-0000-0000-000000000001'),
  9,
  'RACE 1: the creator''s trust_score is UNCHANGED from its default (no silent credit for a suppressed publish)');

select is(
  (select count(*)::integer from public.trust_events te
    where te.user_id = 'a6000001-0000-0000-0000-000000000002' and te.action_type = 'verification_given_nonzero'),
  1,
  'RACE 1: the deciding verifier''s contribution and trust ARE preserved — creator and verifier trust effects proven separately');

select is(
  (select u.trust_score from public.users u where u.id = 'a6000001-0000-0000-0000-000000000002'),
  6,
  'RACE 1: SC6 — the verifier''s trust_score actually moved 5 -> 6 despite the creator-side suppression');

-- ─── CLEANUP (manual — no rollback available for the committed race section) ───
-- Every fixture row this section committed is deleted here, matching
-- phase5_discovery_cooldown_race.test.sql's identical pattern. Runs regardless of
-- which individual assertions above passed or failed.
-- The locations.id FK is captured BEFORE submissions is deleted, but the location row
-- itself is deleted AFTER submissions — a referenced row cannot be deleted while a
-- submissions.location_id FK still points to it (confirmed empirically: deleting
-- locations before submissions fails with a live FK-violation error).
create temp table phase5_r1_loc_ids as
  select location_id from public.submissions where id::text like '76000001%' and location_id is not null;
delete from public.tags where location_id in (select location_id from phase5_r1_loc_ids);
delete from public.trust_events where user_id::text like 'a6000001%';
delete from public.notification_outbox where submission_id::text like '76000001%';
delete from public.verification_events where submission_id::text like '76000001%';
delete from public.submission_tags where submission_id::text like '76000001%';
delete from public.submissions where id::text like '76000001%';
delete from public.locations where id in (select location_id from phase5_r1_loc_ids);
delete from private.verification_rate_limits where user_id::text like 'a6000001%';
delete from public.users where id::text like 'a6000001%';
delete from auth.users where id::text like 'a6000001%';

-- ─── RACE 2: HISTORICAL-VERIFIER-SHADOWBAN-RACE (D-52/D-69, two-session) ────────
-- Under the locked submission_publish_threshold=2, any single qualifying verifier's
-- own call always publishes immediately — so proving the step-5b lock ALSO protects
-- a HISTORICAL verifier's eligibility read (not just the creator's or current
-- caller's own row) requires temporarily raising the threshold to 3 so a first
-- verifier's genuine event can exist on a submission that is STILL pending, then
-- racing a shadowban of THAT historical verifier against a second (deciding) caller.
--
-- Defense-in-depth precondition (plan-required): fail fast and loud if a PRIOR run's
-- interrupted cleanup left the threshold at something other than the Task-1-locked
-- default, rather than silently compounding the corruption.
do $$
declare
  v_threshold text;
begin
  select value into v_threshold from public.app_config where key = 'submission_publish_threshold';
  if v_threshold is distinct from '2' then
    raise exception 'RACE 2 precondition failed: submission_publish_threshold is % (expected steady-state 2) — a prior run''s cleanup may not have completed. Refusing to proceed rather than compound the corruption.', v_threshold;
  end if;
end
$$;

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'a6000002-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p5vpr2-creator@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'a6000002-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'p5vpr2-histverifier@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'a6000002-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'p5vpr2-decidingverifier@example.com');

insert into public.submissions
  (id, submitter_id, status, confirmation_count, name, coordinates, policy_tag, expires_at)
values
  ('76000002-0000-0000-0000-000000000001', 'a6000002-0000-0000-0000-000000000001', 'pending', 1, 'R2 historical-verifier-shadowban race',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days');

-- Step 1: real COMMITTED config bump — a savepoint/transaction-local override is
-- invisible to the SEPARATE dblink connections this race needs (ordinary MVCC
-- read-committed visibility), and app_config.key is the table's primary key so no
-- shadow row is possible. Own top-level statement (autocommitted).
update public.app_config set value = '3' where key = 'submission_publish_threshold';

-- Step 2: V1 (historical verifier) records a genuine nonzero-weight event. count =
-- creator(1) + V1(1) = 2 < 3, so the submission stays pending — V1 is now a genuine,
-- durably-committed historical qualifying verifier on a still-pending submission.
select set_config('request.jwt.claims',
  json_build_object('sub', 'a6000002-0000-0000-0000-000000000002', 'role', 'authenticated')::text, false);
select is(
  public.verify_location('76000002-0000-0000-0000-000000000001'::uuid, 44.00, -123.00, 10, false, now()),
  '{"accepted": true}'::jsonb,
  'RACE 2 setup: historical verifier V1 records a genuine nonzero-weight event');
select is(
  (select s.status from public.submissions s where s.id = '76000002-0000-0000-0000-000000000001'),
  'pending',
  'RACE 2 setup: threshold=3 means V1''s single event does NOT yet publish — a genuine still-pending historical verifier now exists');

-- Step 3-4: the race itself. Session A shadowbans V1 (the HISTORICAL verifier, not the
-- creator and not the deciding caller) and holds; session B, as V2 (a THIRD distinct
-- identity), makes the deciding call that would bring the count to 3 if V1 still
-- counted.
select dblink_connect('r2_a', pg_temp.race_connstr());
select dblink_connect('r2_b', pg_temp.race_connstr());
select dblink_exec('r2_b',
  $$SET request.jwt.claims TO '{"sub":"a6000002-0000-0000-0000-000000000003","role":"authenticated"}'$$);

select dblink_exec('r2_a', 'begin');
select dblink_exec('r2_a',
  $$update public.users set shadowban_status = true where id = 'a6000002-0000-0000-0000-000000000002'$$);

create temp table phase5_r2_pid_b as
  select pid from dblink('r2_b', 'select pg_backend_pid() as pid') as t(pid int);

select dblink_send_query('r2_b',
  $$select public.verify_location('76000002-0000-0000-0000-000000000001'::uuid, 44.00, -123.00, 10, false, now())::text$$);

create temp table phase5_r2_blocked (observed boolean not null default false);
insert into phase5_r2_blocked (observed) select pg_temp.race_wait_blocked(pid) from phase5_r2_pid_b;

select dblink_exec('r2_a', 'commit');
create temp table phase5_r2_result as
  select result from dblink_get_result('r2_b') as t(result text);
select result from dblink_get_result('r2_b') as t(result text);  -- drain the terminating result set

select dblink_disconnect('r2_a');
select dblink_disconnect('r2_b');

-- Step 5: GUARANTEED restore. This is a top-level (autocommitted) statement that runs
-- immediately in the normal path. A genuine SQL-level ERROR earlier in this sequence
-- would abort the whole script before reaching here (verified empirically: psql/the
-- `supabase test db` harness does not continue past an unhandled error) — that failure
-- mode is accepted per this file's existing mandatory single-use disposable-instance
-- requirement (the whole instance is destroyed regardless of whether this statement
-- ran) and is why plain `supabase test db` against a shared/persistent stack remains
-- explicitly forbidden for this file. pgTAP assertion failures (ok/is returning false)
-- do NOT raise or abort — only a real SQL error would — so the overwhelmingly common
-- failure mode (the race behaving unexpectedly, not a SQL exception) still reaches and
-- executes this restore.
update public.app_config set value = '2' where key = 'submission_publish_threshold';
select is(
  (select value from public.app_config where key = 'submission_publish_threshold'),
  '2',
  'RACE 2: submission_publish_threshold restored to the Task-1-locked default');

select ok(
  (select observed from phase5_r2_blocked),
  'RACE 2 (HISTORICAL-VERIFIER-SHADOWBAN): the deciding call was independently observed BLOCKED on V1''s row — proving the lock serializes a HISTORICAL verifier''s eligibility read, not just the creator''s or current caller''s own');

select is(
  (select r.result from phase5_r2_result r),
  '{"accepted": true}',
  'RACE 2: once unblocked, the deciding call still returns accepted=true');

select is(
  (select s.status from public.submissions s where s.id = '76000002-0000-0000-0000-000000000001'),
  'pending',
  'RACE 2: V1 no longer counts once shadowbanned — count = creator(1) + V2(1) = 2 < the (now-restored) threshold, submission remains pending');

select is(
  (select s.confirmation_count from public.submissions s where s.id = '76000002-0000-0000-0000-000000000001'),
  2,
  'RACE 2: confirmation_count reflects only the currently-eligible creator + V2 — V1 excluded');

select is(
  (select ve.weight > 0 from public.verification_events ve
    where ve.submission_id = '76000002-0000-0000-0000-000000000001' and ve.user_id = 'a6000002-0000-0000-0000-000000000002'),
  true,
  'RACE 2 (D-52): V1''s immutable recorded event is UNCHANGED (weight not rewritten) even though V1 no longer counts toward the threshold');

-- ─── CLEANUP (Race 2) ────────────────────────────────────────────────────────────
create temp table phase5_r2_loc_ids as
  select location_id from public.submissions where id::text like '76000002%' and location_id is not null;
delete from public.tags where location_id in (select location_id from phase5_r2_loc_ids);
delete from public.trust_events where user_id::text like 'a6000002%';
delete from public.notification_outbox where submission_id::text like '76000002%';
delete from public.verification_events where submission_id::text like '76000002%';
delete from public.submission_tags where submission_id::text like '76000002%';
delete from public.submissions where id::text like '76000002%';
delete from public.locations where id in (select location_id from phase5_r2_loc_ids);
delete from private.verification_rate_limits where user_id::text like 'a6000002%';
delete from public.users where id::text like 'a6000002%';
delete from auth.users where id::text like 'a6000002%';

-- ─── RACE 3: CURRENT-CALLER-SHADOWBAN-RACE (D-38/D-48/D-49, two-session) ────────
-- Proves the CALLER's OWN shadowban-dependent weight/trust effects are read only
-- after the caller's own row is locked in the step-5b pass — not merely the
-- creator's or a historical verifier's row (races 1 and 2 above). Session A
-- shadowbans the DECIDING CALLER's own row and holds; session B, as that SAME
-- caller, makes the call.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'a6000003-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p5vpr3-creator@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'a6000003-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'p5vpr3-caller@example.com');
update public.users set trust_score = 5, trust_multiplier = 0.7 where id = 'a6000003-0000-0000-0000-000000000002';

insert into public.submissions
  (id, submitter_id, status, confirmation_count, name, coordinates, policy_tag, expires_at)
values
  ('76000003-0000-0000-0000-000000000001', 'a6000003-0000-0000-0000-000000000001', 'pending', 1, 'R3 current-caller-shadowban race',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days');

select dblink_connect('r3_a', pg_temp.race_connstr());
select dblink_connect('r3_b', pg_temp.race_connstr());
select dblink_exec('r3_b',
  $$SET request.jwt.claims TO '{"sub":"a6000003-0000-0000-0000-000000000002","role":"authenticated"}'$$);

select dblink_exec('r3_a', 'begin');
select dblink_exec('r3_a',
  $$update public.users set shadowban_status = true where id = 'a6000003-0000-0000-0000-000000000002'$$);

create temp table phase5_r3_pid_b as
  select pid from dblink('r3_b', 'select pg_backend_pid() as pid') as t(pid int);

select dblink_send_query('r3_b',
  $$select public.verify_location('76000003-0000-0000-0000-000000000001'::uuid, 44.00, -123.00, 10, false, now())::text$$);

create temp table phase5_r3_blocked (observed boolean not null default false);
insert into phase5_r3_blocked (observed) select pg_temp.race_wait_blocked(pid) from phase5_r3_pid_b;

select dblink_exec('r3_a', 'commit');
create temp table phase5_r3_result as
  select result from dblink_get_result('r3_b') as t(result text);
select result from dblink_get_result('r3_b') as t(result text);  -- drain the terminating result set

select dblink_disconnect('r3_a');
select dblink_disconnect('r3_b');

select ok(
  (select observed from phase5_r3_blocked),
  'RACE 3 (CURRENT-CALLER-SHADOWBAN): the call was independently observed BLOCKED on the caller''s OWN row — proving the caller''s own shadowban-dependent effects are lock-protected, not just the creator''s or a historical verifier''s');

select is(
  (select r.result from phase5_r3_result r),
  '{"accepted": true}',
  'RACE 3: a now-shadowbanned caller''s event is still ACCEPTED (silently, weight 0) once unblocked');

select is(
  (select ve.weight from public.verification_events ve
    where ve.submission_id = '76000003-0000-0000-0000-000000000001' and ve.user_id = 'a6000003-0000-0000-0000-000000000002'),
  0::numeric,
  'RACE 3: the caller''s inserted event carries weight=0 — the concurrent shadowban was read under the step-5b lock, not a stale pre-race value');

select is(
  (select count(*)::integer from public.trust_events te
    where te.user_id = 'a6000003-0000-0000-0000-000000000002' and te.action_type = 'verification_given_nonzero'),
  0,
  'RACE 3: NO verification_given_nonzero append for the now-shadowbanned caller');

select is(
  (select u.trust_multiplier from public.users u where u.id = 'a6000003-0000-0000-0000-000000000002'),
  0.7::numeric,
  'RACE 3: NO trust_multiplier ramp occurred');

select is(
  (select u.trust_score from public.users u where u.id = 'a6000003-0000-0000-0000-000000000002'),
  5,
  'RACE 3: NO trust_score change occurred');

select is(
  (select s.status from public.submissions s where s.id = '76000003-0000-0000-0000-000000000001'),
  'pending',
  'RACE 3: NO publication resulted from this caller alone — a weight=0 event never crosses the threshold');

-- ─── CLEANUP (Race 3) ────────────────────────────────────────────────────────────
create temp table phase5_r3_loc_ids as
  select location_id from public.submissions where id::text like '76000003%' and location_id is not null;
delete from public.tags where location_id in (select location_id from phase5_r3_loc_ids);
delete from public.trust_events where user_id::text like 'a6000003%';
delete from public.notification_outbox where submission_id::text like '76000003%';
delete from public.verification_events where submission_id::text like '76000003%';
delete from public.submission_tags where submission_id::text like '76000003%';
delete from public.submissions where id::text like '76000003%';
delete from public.locations where id in (select location_id from phase5_r3_loc_ids);
delete from private.verification_rate_limits where user_id::text like 'a6000003%';
delete from public.users where id::text like 'a6000003%';
delete from auth.users where id::text like 'a6000003%';

-- ─── RACE 4: RECIPROCAL-USER LOCK-ORDER DEADLOCK TEST (two-session) ─────────────
-- Two DIFFERENT submissions with reversed creator/caller roles: submission A's
-- creator is U2 and its caller is U1; submission B's creator is U1 and its caller is
-- U2. If each call locked in "creator-then-caller" order, call A would lock
-- U2-then-U1 while call B locked U1-then-U2 — the classic reversed-order deadlock
-- shape. The single GLOBAL ascending-users.id lock order (step 5b) makes both calls
-- lock in the SAME order regardless of which role each user plays, so they can only
-- ever serialize, never deadlock. Dispatched concurrently via async send_query so
-- both calls genuinely contend for the overlapping {U1, U2} lock set.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'a6000004-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p5vpr4-u1@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'a6000004-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'p5vpr4-u2@example.com');

insert into public.submissions
  (id, submitter_id, status, confirmation_count, name, coordinates, policy_tag, expires_at)
values
  ('76000004-0000-0000-0000-00000000000a', 'a6000004-0000-0000-0000-000000000002', 'pending', 1, 'R4 submission A (creator U2)',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days'),
  ('76000004-0000-0000-0000-00000000000b', 'a6000004-0000-0000-0000-000000000001', 'pending', 1, 'R4 submission B (creator U1)',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days');

select dblink_connect('r4_a', pg_temp.race_connstr());
select dblink_connect('r4_b', pg_temp.race_connstr());
-- Connection A acts as U1 (caller of submission A, created by U2).
select dblink_exec('r4_a',
  $$SET request.jwt.claims TO '{"sub":"a6000004-0000-0000-0000-000000000001","role":"authenticated"}'$$);
-- Connection B acts as U2 (caller of submission B, created by U1) — the reciprocal.
select dblink_exec('r4_b',
  $$SET request.jwt.claims TO '{"sub":"a6000004-0000-0000-0000-000000000002","role":"authenticated"}'$$);

-- Dispatch BOTH calls asynchronously back-to-back so neither waits on the other to be
-- issued — this is what makes the overlap genuine rather than accidentally sequential.
select dblink_send_query('r4_a',
  $$select public.verify_location('76000004-0000-0000-0000-00000000000a'::uuid, 44.00, -123.00, 10, false, now())::text$$);
select dblink_send_query('r4_b',
  $$select public.verify_location('76000004-0000-0000-0000-00000000000b'::uuid, 44.00, -123.00, 10, false, now())::text$$);

-- Retrieve both results, EXPLICITLY tolerating (capturing rather than propagating) a
-- deadlock-detected exception from either connection — that IS the failure mode this
-- test exists to catch, and it must surface as a reported pgTAP failure, not a
-- script-aborting SQL error. pgTAP's ok()/is() cannot be called from inside this DO
-- block (their output would never reach the TAP stream), so the outcome is captured
-- into a temp table and asserted via plain top-level selects afterward.
create temp table phase5_r4_outcome (conn text primary key, succeeded boolean not null, detail text);
do $$
declare
  v_result text;
begin
  begin
    select result into v_result from dblink_get_result('r4_a') as t(result text);
    perform result from dblink_get_result('r4_a') as t(result text);  -- drain terminating set
    insert into phase5_r4_outcome values ('a', true, v_result);
  exception when others then
    insert into phase5_r4_outcome values ('a', false, sqlerrm);
  end;

  begin
    select result into v_result from dblink_get_result('r4_b') as t(result text);
    perform result from dblink_get_result('r4_b') as t(result text);
    insert into phase5_r4_outcome values ('b', true, v_result);
  exception when others then
    insert into phase5_r4_outcome values ('b', false, sqlerrm);
  end;
end
$$;

select dblink_disconnect('r4_a');
select dblink_disconnect('r4_b');

select ok(
  (select succeeded from phase5_r4_outcome where conn = 'a'),
  'RACE 4 (RECIPROCAL LOCK-ORDER DEADLOCK): call A (submission A, caller U1, creator U2) completed without a deadlock-detected exception — ' ||
    coalesce((select detail from phase5_r4_outcome where conn = 'a'), 'NULL'));

select ok(
  (select succeeded from phase5_r4_outcome where conn = 'b'),
  'RACE 4: call B (submission B, caller U2, creator U1 — the reciprocal overlapping-user case) completed without a deadlock-detected exception — ' ||
    coalesce((select detail from phase5_r4_outcome where conn = 'b'), 'NULL'));

select is(
  (select detail from phase5_r4_outcome where conn = 'a'),
  '{"accepted": true}',
  'RACE 4: call A returned accepted=true (not merely non-erroring)');

select is(
  (select detail from phase5_r4_outcome where conn = 'b'),
  '{"accepted": true}',
  'RACE 4: call B returned accepted=true (not merely non-erroring)');

-- ─── CLEANUP (Race 4) ────────────────────────────────────────────────────────────
create temp table phase5_r4_loc_ids as
  select location_id from public.submissions where id::text like '76000004%' and location_id is not null;
delete from public.tags where location_id in (select location_id from phase5_r4_loc_ids);
delete from public.trust_events where user_id::text like 'a6000004%';
delete from public.notification_outbox where submission_id::text like '76000004%';
delete from public.verification_events where submission_id::text like '76000004%';
delete from public.submission_tags where submission_id::text like '76000004%';
delete from public.submissions where id::text like '76000004%';
delete from public.locations where id in (select location_id from phase5_r4_loc_ids);
delete from private.verification_rate_limits where user_id::text like 'a6000004%';
delete from public.users where id::text like 'a6000004%';
delete from auth.users where id::text like 'a6000004%';

-- ─── RACE 5: FIRST-USE COOLDOWN CLAIM RACE (D-36, two-session, MISSING-ROW BYPASS) ──
-- Round-3 Codex finding (real, reproduced): `select ... for update` against a
-- NONEXISTENT private.verification_rate_limits row acquires NO lock (there is
-- nothing to lock) — unlike every other lock in this file, which all lock an
-- EXISTING row. So a genuinely first-time caller's cooldown read is NOT serialized
-- against a second, truly-concurrent first-time call by the SAME user. Two DISTINCT
-- submissions are used (not the same one) so D-43's per-submission idempotency guard
-- cannot mask the bypass by collapsing a double-accept into a single counted event.
-- Overlap is FORCED and OBSERVED here (see CONTROLLED PAUSE below), not assumed from
-- firing both calls back-to-back.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'a6000005-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p5vpr5-creator@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'a6000005-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'p5vpr5-caller@example.com');

insert into public.submissions
  (id, submitter_id, status, confirmation_count, name, coordinates, policy_tag, expires_at)
values
  ('76000005-0000-0000-0000-00000000000a', 'a6000005-0000-0000-0000-000000000001', 'pending', 1, 'R5 submission A',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days'),
  ('76000005-0000-0000-0000-00000000000b', 'a6000005-0000-0000-0000-000000000001', 'pending', 1, 'R5 submission B',
   extensions.st_setsrid(extensions.st_makepoint(-123.00, 44.00), 4326)::extensions.geography, 'public_facility', now() + interval '14 days');

-- Defense-in-depth precondition (same pattern as RACE 2): the caller must be a
-- genuinely first-time identity with NO prior row — that absence IS the bug's
-- precondition, and a prior run's interrupted cleanup must fail loudly, not silently
-- invalidate this race.
do $$
begin
  if exists (select 1 from private.verification_rate_limits where user_id = 'a6000005-0000-0000-0000-000000000002') then
    raise exception 'RACE 5 precondition failed: caller already has a verification_rate_limits row — a prior run''s cleanup may not have completed. Refusing to proceed rather than compound the corruption.';
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'p5_r5_pause_trg') then
    raise exception 'RACE 5 precondition failed: a stale p5_r5_pause_trg trigger exists — a prior run''s cleanup did not complete.';
  end if;
end
$$;

-- CONTROLLED PAUSE. Firing both calls back-to-back proves nothing if A can finish and
-- commit before B even starts: that schedule is sequential and passes against a
-- non-atomic implementation too. So A is held INSIDE its transaction, after it has
-- already claimed the cooldown row but before it can commit: a test-only trigger on the
-- verification_events insert for submission A waits on an advisory lock that THIS session
-- holds. B is then dispatched while A is provably mid-transaction, and both are observed
-- blocked (wait_event_type = Lock) before anything is released.
create function public.p5_r5_pause() returns trigger
language plpgsql as $f$
begin
  perform pg_catalog.pg_advisory_lock(7605005);
  perform pg_catalog.pg_advisory_unlock(7605005);
  return new;
end;
$f$;
create trigger p5_r5_pause_trg before insert on public.verification_events
  for each row when (new.submission_id = '76000005-0000-0000-0000-00000000000a')
  execute function public.p5_r5_pause();

select pg_catalog.pg_advisory_lock(7605005);   -- hold it: A will park on this

select dblink_connect('r5_a', pg_temp.race_connstr());
select dblink_connect('r5_b', pg_temp.race_connstr());
select dblink_exec('r5_a',
  $$SET request.jwt.claims TO '{"sub":"a6000005-0000-0000-0000-000000000002","role":"authenticated"}'$$);
select dblink_exec('r5_b',
  $$SET request.jwt.claims TO '{"sub":"a6000005-0000-0000-0000-000000000002","role":"authenticated"}'$$);

create temp table phase5_r5_pid_a as
  select pid from dblink('r5_a', 'select pg_backend_pid() as pid') as t(pid int);
create temp table phase5_r5_pid_b as
  select pid from dblink('r5_b', 'select pg_backend_pid() as pid') as t(pid int);

-- A first: it claims the cooldown row, then parks at the event insert.
select dblink_send_query('r5_a',
  $$select public.verify_location('76000005-0000-0000-0000-00000000000a'::uuid, 44.00, -123.00, 10, false, now())::text$$);
create temp table phase5_r5_a_blocked (observed boolean not null default false);
insert into phase5_r5_a_blocked (observed) select pg_temp.race_wait_blocked(pid) from phase5_r5_pid_a;

-- B is dispatched only now, while A is mid-transaction holding the caller's rate-limit row.
select dblink_send_query('r5_b',
  $$select public.verify_location('76000005-0000-0000-0000-00000000000b'::uuid, 44.00, -123.00, 10, false, now())::text$$);
create temp table phase5_r5_b_blocked (observed boolean not null default false);
insert into phase5_r5_b_blocked (observed) select pg_temp.race_wait_blocked(pid) from phase5_r5_pid_b;

-- Release A. B, still queued on the caller's rate-limit row, resolves after A commits.
select pg_catalog.pg_advisory_unlock(7605005);

create temp table phase5_r5_outcome (conn text primary key, succeeded boolean not null, detail text);
do $$
declare
  v_result text;
begin
  begin
    select result into v_result from dblink_get_result('r5_a') as t(result text);
    perform result from dblink_get_result('r5_a') as t(result text);
    insert into phase5_r5_outcome values ('a', true, v_result);
  exception when others then
    insert into phase5_r5_outcome values ('a', false, sqlerrm);
  end;

  begin
    select result into v_result from dblink_get_result('r5_b') as t(result text);
    perform result from dblink_get_result('r5_b') as t(result text);
    insert into phase5_r5_outcome values ('b', true, v_result);
  exception when others then
    insert into phase5_r5_outcome values ('b', false, sqlerrm);
  end;
end
$$;

select dblink_disconnect('r5_a');
select dblink_disconnect('r5_b');

select ok(
  (select observed from phase5_r5_a_blocked),
  'RACE 5: call A was independently observed PARKED mid-transaction (wait_event_type=Lock) - the overlap is real, not assumed');

select ok(
  (select observed from phase5_r5_b_blocked),
  'RACE 5: call B was independently observed BLOCKED (wait_event_type=Lock) while A was still open - the two calls genuinely contended');

select ok(
  (select succeeded from phase5_r5_outcome where conn = 'a'),
  'RACE 5: call A completed without an unexpected error - ' || coalesce((select detail from phase5_r5_outcome where conn = 'a'), 'NULL'));

select ok(
  (select succeeded from phase5_r5_outcome where conn = 'b'),
  'RACE 5: call B completed without an unexpected error - ' || coalesce((select detail from phase5_r5_outcome where conn = 'b'), 'NULL'));

select is(
  (select count(*)::integer from phase5_r5_outcome where detail = '{"accepted": true}'),
  1,
  'RACE 5 (FIRST-USE COOLDOWN BYPASS): exactly ONE of the two truly-concurrent first-ever verify_location calls by the same brand-new caller is accepted — the other must be cooldown-rejected, proving the D-36 claim is genuinely atomic even when no rate-limit row exists yet');

select is(
  (select count(*)::integer from public.verification_events ve
    where ve.submission_id in ('76000005-0000-0000-0000-00000000000a', '76000005-0000-0000-0000-00000000000b')
      and ve.event_type = 'verification'),
  1,
  'RACE 5: exactly one verifier event was recorded across both submissions — the rejected call recorded no event');

select is(
  (select last_verify_attempt_at is not null from private.verification_rate_limits
    where user_id = 'a6000005-0000-0000-0000-000000000002'),
  true,
  'RACE 5: the caller''s rate-limit row exists with a non-null claimed timestamp after the race');

-- ─── CLEANUP (Race 5) ────────────────────────────────────────────────────────────
drop trigger if exists p5_r5_pause_trg on public.verification_events;
drop function if exists public.p5_r5_pause();
select pg_catalog.pg_advisory_unlock_all();
create temp table phase5_r5_loc_ids as
  select location_id from public.submissions where id::text like '76000005%' and location_id is not null;
delete from public.tags where location_id in (select location_id from phase5_r5_loc_ids);
delete from public.trust_events where user_id::text like 'a6000005%';
delete from public.notification_outbox where submission_id::text like '76000005%';
delete from public.verification_events where submission_id::text like '76000005%';
delete from public.submission_tags where submission_id::text like '76000005%';
delete from public.submissions where id::text like '76000005%';
delete from public.locations where id in (select location_id from phase5_r5_loc_ids);
delete from private.verification_rate_limits where user_id::text like 'a6000005%';
delete from public.users where id::text like 'a6000005%';
delete from auth.users where id::text like 'a6000005%';

select finish();
