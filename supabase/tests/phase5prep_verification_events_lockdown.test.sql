-- Whole-project audit P0-2 fix (2026-07-09 audit, remediated 2026-07-10) — pgTAP
-- coverage proving the verification_events direct-write bypass and broad client-role
-- table ACLs are closed.
-- Run locally with:  supabase test db   (requires Docker — tracked override this env)
--
-- The pre-existing `verification_events_insert_auth` RLS policy let a signed-in
-- user insert an arbitrary weight, distance_from_location_meters, event_type,
-- and gps_location as long as user_id matched their own auth.uid() — no
-- server-side computation or validation involved. The policy was dropped in
-- 20260710000000_phase5prep_drop_verification_events_direct_insert.sql, and the
-- remaining broad table grants were reduced to least privilege in
-- 20260710121534_verification_events_client_write_acl_lockdown.sql. This suite
-- asserts the effective ACL contract and a real denial under the `authenticated`
-- role (not a SECURITY
-- DEFINER function, which runs as the table owner and is unaffected) — mirrors
-- the phase4_submit.test.sql Section 7 / phase3_read_rpcs.test.sql
-- "base-table access denied" role-switching pattern.
--
-- No Phase 5 RPC exists yet to write verification_events server-side; this
-- suite only proves the bypass is closed, not that a replacement write path
-- exists (that is Phase 5 scope, per 05-DISCUSSION-DRAFT.md).

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select is(
  (select count(*)::bigint
     from aclexplode((select relacl
                        from pg_class
                       where oid = 'public.verification_events'::regclass)) acl
     join pg_roles role_grantee on role_grantee.oid = acl.grantee
    where role_grantee.rolname = 'anon'),
  0::bigint,
  'anon has no direct table privileges on verification_events');

select is(
  (select string_agg(acl.privilege_type, ',' order by acl.privilege_type)
     from aclexplode((select relacl
                        from pg_class
                       where oid = 'public.verification_events'::regclass)) acl
     join pg_roles role_grantee on role_grantee.oid = acl.grantee
    where role_grantee.rolname = 'authenticated'),
  'SELECT'::text,
  'authenticated retains only SELECT for its owner-scoped RLS policy');

select ok(not has_table_privilege('anon', 'public.verification_events', 'INSERT'),
  'anon cannot INSERT verification_events');
select ok(not has_table_privilege('authenticated', 'public.verification_events', 'INSERT'),
  'authenticated cannot INSERT verification_events');
select ok(not has_table_privilege('anon', 'public.verification_events', 'UPDATE'),
  'anon cannot UPDATE verification_events');
select ok(not has_table_privilege('authenticated', 'public.verification_events', 'UPDATE'),
  'authenticated cannot UPDATE verification_events');
select ok(not has_table_privilege('anon', 'public.verification_events', 'DELETE'),
  'anon cannot DELETE verification_events');
select ok(not has_table_privilege('authenticated', 'public.verification_events', 'DELETE'),
  'authenticated cannot DELETE verification_events');
select ok(not has_table_privilege('anon', 'public.verification_events', 'TRUNCATE'),
  'anon cannot TRUNCATE verification_events');
select ok(not has_table_privilege('authenticated', 'public.verification_events', 'TRUNCATE'),
  'authenticated cannot TRUNCATE verification_events');
select ok(not has_table_privilege('anon', 'public.verification_events', 'REFERENCES'),
  'anon cannot create REFERENCES to verification_events');
select ok(not has_table_privilege('authenticated', 'public.verification_events', 'REFERENCES'),
  'authenticated cannot create REFERENCES to verification_events');
select ok(not has_table_privilege('anon', 'public.verification_events', 'TRIGGER'),
  'anon cannot create TRIGGERs on verification_events');
select ok(not has_table_privilege('authenticated', 'public.verification_events', 'TRIGGER'),
  'authenticated cannot create TRIGGERs on verification_events');
select ok(not has_table_privilege('anon', 'public.verification_events', 'SELECT'),
  'anon cannot SELECT verification_events');
select ok(has_table_privilege('authenticated', 'public.verification_events', 'SELECT'),
  'authenticated can SELECT only rows allowed by RLS');

insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000',
        'b0000000-0000-0000-0000-000000000001',
        'authenticated', 'authenticated', 'phase5prep-userA@example.com');

select set_config('request.jwt.claims',
  json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ insert into public.verification_events
       (location_id, user_id, distance_from_location_meters, weight, event_type)
     values (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001'::uuid, 5, 1.0, 'confirm') $$,
  '42501',
  null,
  'authenticated role cannot INSERT into verification_events directly, even self-attributed (no client write path exists — future Phase 5 RPCs are the only intended writers)');

reset role;

select is(
  (select count(*)::bigint from public.verification_events),
  0::bigint,
  'the denied INSERT left verification_events empty');

select set_config('request.jwt.claims', '', true);
select * from finish();
rollback;
