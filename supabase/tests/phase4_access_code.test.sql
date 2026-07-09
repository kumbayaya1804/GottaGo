-- Phase 4 (04-02 Task 1) — pgTAP correctness suite for the access-code UPDATE path
-- Run locally with:  supabase test db   (requires Docker — tracked override this env)
--
-- Covers the three access-code SECURITY DEFINER RPCs added in
-- 20260707030000_phase4_access_code_update.sql:
--   update_access_code   — stages a proposed door code (D-24: no instant overwrite)
--   confirm_access_code  — a SECOND, DIFFERENT authed user promotes the staged code
--   get_access_code      — authed-only read of the current code (SC6; the ONLY code
--                          read path — get_location_detail stays untouched, Pitfall 4)
--
-- Asserts (RESEARCH §Pattern 5 + OQ-3 → the D-24 stage-then-confirm mechanism):
--   (a) update_access_code by the PROPOSER stages pending_access_code +
--       pending_code_proposed_by but leaves access_instructions = 'OLD-CODE'
--   (b) confirm_access_code by the SAME user (proposer) does NOT promote — it raises
--       a generic error and access_instructions is still 'OLD-CODE' (D-24: confirmer
--       must differ from proposer)
--   (c) confirm_access_code by a DIFFERENT authed user copies pending_access_code into
--       access_instructions, clears both pending columns, and sets a fresh
--       access_code_confirmed_at (D-25 overwrite, code freshness reset)
--   (d) get_access_code returns the current code for an authenticated caller
--   (e/f) get_access_code / update_access_code / confirm_access_code with empty jwt
--       claims each raise 'not authenticated' (SC6 — reads + writes are authed-only)
--
-- Two auth.users fixtures (proposer A / confirmer B) fire handle_new_user → provision
-- public.users so the different-user confirmation gate is directly testable.

begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- ─── Fixtures: two authenticated test users (proposer A + confirmer B) ────────
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000',
        'a0000000-0000-0000-0000-000000000001',
        'authenticated', 'authenticated', 'phase4-code-proposer@example.com'),
       ('00000000-0000-0000-0000-000000000000',
        'a0000000-0000-0000-0000-000000000002',
        'authenticated', 'authenticated', 'phase4-code-confirmer@example.com');

-- ─── Fixture: one PUBLISHED location with a known live code 'OLD-CODE' ─────────
-- Published = deleted_at null, shadowban_status default false, suppressed_at null.
insert into public.locations (id, name, coordinates, policy_tag, access_instructions)
values ('c0000000-0000-0000-0000-000000000001',
        'Code Locked Cafe',
        extensions.st_setsrid(extensions.st_makepoint(-123.09, 44.05), 4326)::extensions.geography,
        'code_required',
        'OLD-CODE');

-- ═══ Section 0. update_access_code rejects null/blank/whitespace/overlong (Codex) ═
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

select throws_ok(
  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, null) $$,
  'P0001', 'code cannot be blank',
  'update_access_code rejects a null p_code');

select throws_ok(
  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, '') $$,
  'P0001', 'code cannot be blank',
  'update_access_code rejects an empty-string p_code');

select throws_ok(
  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, '   ') $$,
  'P0001', 'code cannot be blank',
  'update_access_code rejects a whitespace-only p_code');

select throws_ok(
  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, repeat('x', 101)) $$,
  'P0001', 'code is too long',
  'update_access_code rejects a p_code over 100 characters');

select is(
  (select pending_access_code from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  null::text,
  'none of the rejected proposals above staged anything (pending_access_code still null)');

-- ═══ Section 1. update_access_code STAGES without overwriting (proposer A) ════
select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, '  NEW-CODE  ');

select is(
  (select access_instructions from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  'OLD-CODE',
  'update_access_code leaves the live access_instructions unchanged (D-24 — stage, not overwrite)');

select is(
  (select pending_access_code from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  'NEW-CODE',
  'update_access_code stages the proposed code in pending_access_code');

select is(
  (select pending_code_proposed_by from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'update_access_code records the proposer in pending_code_proposed_by');

-- ═══ Section 1b. A DIFFERENT user cannot clobber A's pending proposal (CR-02) ══
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);

select throws_ok(
  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, 'ATTACKER-CODE') $$,
  'P0001', 'code update already pending',
  'update_access_code rejects a different user overwriting an already-pending proposal (CR-02)');

select is(
  (select pending_access_code from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  'NEW-CODE',
  'the rejected overwrite attempt leaves A''s original pending_access_code unchanged');

-- The ORIGINAL proposer may still re-stage their own proposal (e.g. fixing a typo).
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

select lives_ok(
  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, 'NEW-CODE') $$,
  'the original proposer may re-stage their own pending proposal without the CR-02 guard firing');

-- ═══ Section 2. Same-user confirm does NOT promote (D-24) ═════════════════════
-- Still impersonating proposer A — confirming your own proposal must be refused.
select throws_ok(
  $$ select public.confirm_access_code('c0000000-0000-0000-0000-000000000001'::uuid) $$,
  'P0001',
  'cannot confirm own code',
  'confirm_access_code refuses when the confirmer is the proposer (D-24 second-party gate)');

select is(
  (select access_instructions from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  'OLD-CODE',
  'a rejected same-user confirm leaves the live code as OLD-CODE (no promotion)');

-- ═══ Section 3. Different-user confirm PROMOTES the staged code ═══════════════
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);

select public.confirm_access_code('c0000000-0000-0000-0000-000000000001'::uuid);

select is(
  (select access_instructions from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  'NEW-CODE',
  'confirm_access_code by a DIFFERENT authed user promotes pending → access_instructions (D-25)');

select is(
  (select pending_access_code from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  null::text,
  'confirm_access_code clears pending_access_code after promotion');

select is(
  (select pending_code_proposed_by from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  null::uuid,
  'confirm_access_code clears pending_code_proposed_by after promotion');

select ok(
  (select access_code_confirmed_at is not null
          and access_code_confirmed_at > now() - interval '1 minute'
     from public.locations
     where id = 'c0000000-0000-0000-0000-000000000001'),
  'confirm_access_code sets a fresh access_code_confirmed_at (D-22 code freshness reset)');

-- ═══ Section 4. get_access_code returns the current code to an authed caller ══
select is(
  public.get_access_code('c0000000-0000-0000-0000-000000000001'::uuid),
  'NEW-CODE',
  'get_access_code returns the current live code to an authenticated caller');

-- ═══ Section 5. All three RPCs reject anonymous callers (SC6) ═════════════════
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$ select public.get_access_code('c0000000-0000-0000-0000-000000000001'::uuid) $$,
  'P0001', 'not authenticated',
  'get_access_code rejects an anonymous caller (code never leaks to anon — SC6)');

select throws_ok(
  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, 'ANON-CODE') $$,
  'P0001', 'not authenticated',
  'update_access_code rejects an anonymous caller');

select throws_ok(
  $$ select public.confirm_access_code('c0000000-0000-0000-0000-000000000001'::uuid) $$,
  'P0001', 'not authenticated',
  'confirm_access_code rejects an anonymous caller');

select * from finish();
rollback;
