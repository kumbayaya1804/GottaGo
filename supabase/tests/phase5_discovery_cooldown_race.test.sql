-- Phase 5 (05-01 discovery cooldown) — genuine two-session concurrency proof
-- for the atomic last_discovery_at claim in
-- 20260717120100_phase5_discovery_rpc.sql (D-36).
--
-- MUST run via the disposable-instance isolated runner, NEVER plain
-- `supabase test db`:
--   node supabase/scripts/run-isolated-db-suite.js supabase/tests/phase5_discovery_cooldown_race.test.sql
--
-- Why this file is structured differently from every other phase5_*.test.sql:
-- proving the row lock actually serializes a concurrent caller requires two
-- truly separate Postgres sessions, via dblink. A dblink connection is a
-- genuinely separate backend — it can never see uncommitted rows from this
-- script's own session, so (unlike every other suite in this directory) this
-- file does NOT wrap its fixtures in `begin;...rollback;`: it commits real
-- fixture rows for the dblink sessions to see, then deletes them again at the
-- end. Running this against the shared dev stack could interleave its
-- commits/cleanup with another concurrent run — the same class of hazard
-- documented for 05-02's HISTORICAL-VERIFIER-SHADOWBAN-RACE fixture — hence
-- the disposable single-use instance requirement.
--
-- Round-2 Codex findings fixed here (was BLOCK): (1) the fixture identifiers
-- were not valid hex UUIDs ("race..." contains a non-hex 'r'/'s' and the wrong
-- digit count) — replaced with "facade"-themed ids, which are valid hex.
-- (2) `dblink_exec` cannot run a row-returning statement (`SELECT
-- set_config(...)`) — replaced with a plain session-level `SET` command,
-- which `dblink_exec` supports. (3) firing both calls back-to-back only
-- established PROBABLE overlap, so the "exactly one winner" assertion could
-- pass even against the OLD buggy read-then-write code if session A simply
-- finished first — replaced with a deterministic design: connection A
-- manually acquires the SAME row lock the RPC takes internally and holds it
-- open (via an explicit uncommitted transaction + `pg_sleep`), connection B
-- calls the REAL production RPC while A holds the lock, and this script polls
-- `pg_stat_activity` for B's own backend pid until B is OBSERVED waiting on a
-- lock (wait_event_type = 'Lock') before letting A commit — this is a
-- genuine, deterministic proof that contention occurred, not a hope that two
-- async dispatches happened to overlap.
--
-- Execution is currently unavailable on this host (no Docker) — NOT an
-- accepted carry-forward override: 05-01-PLAN.md Task 5 explicitly accepts no
-- override for this trust boundary, unlike the historical Phase 3/4
-- unexecuted-pgTAP debt. This suite remains a hard BLOCKING requirement
-- before any live push, and this file's dblink mechanism is new to this
-- codebase — it must be exercised for real the first time this runs in a
-- Docker-capable environment before being trusted.

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(3);

-- ─── Fixtures (COMMITTED for real — see header) ────────────────────────────
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000',
        'dddddddd-0000-0000-0000-facade000a01',
        'authenticated', 'authenticated', 'phase5-race-submitter@example.com'),
       ('00000000-0000-0000-0000-000000000000',
        'dddddddd-0000-0000-0000-facade000c01',
        'authenticated', 'authenticated', 'phase5-race-caller@example.com');

insert into public.submissions (id, submitter_id, status, name, coordinates, expires_at)
values ('dddddddd-1111-0000-0000-facade00d001',
        'dddddddd-0000-0000-0000-facade000a01', 'pending', 'Race_S1',
        extensions.st_setsrid(extensions.st_makepoint(-123.0910, 44.0510), 4326)::extensions.geography,
        now() + interval '10 days');

delete from private.verification_rate_limits where user_id = 'dddddddd-0000-0000-0000-facade000c01';

-- ─── Set up connection A: manually hold the caller's rate-limit row lock ───
-- A stands in for "another concurrent claimant" by taking the EXACT lock the
-- RPC's own `with locked as (select ... for update) update ...` step takes
-- internally, but held open via an explicit transaction rather than through
-- the RPC — this isolates the proof to "does a genuinely held row lock force
-- a concurrent real RPC call to block and then observe the committed value,"
-- which is precisely the property the round-1 fix depends on.
select dblink_connect('phase5_race_conn_a', 'dbname=' || current_database());
select dblink_connect('phase5_race_conn_b', 'dbname=' || current_database());

-- SET (not SELECT set_config(...)) because dblink_exec only accepts commands
-- that do not return rows (Codex round-2 finding #2).
select dblink_exec('phase5_race_conn_b',
  $$SET request.jwt.claims TO '{"sub":"dddddddd-0000-0000-0000-facade000c01","role":"authenticated"}'$$);

select dblink_exec('phase5_race_conn_a', 'begin');
-- Ensure the row exists BEFORE attempting the lock (the row was deleted
-- above, and `for update` against zero matching rows is a silent no-op —
-- taking a real, meaningful lock requires a real row), matching what the
-- RPC's own `insert ... on conflict do nothing` guarantees live.
select dblink_exec('phase5_race_conn_a',
  $$insert into private.verification_rate_limits (user_id, last_discovery_at)
    values ('dddddddd-0000-0000-0000-facade000c01', null)
    on conflict (user_id) do nothing$$);
select last_discovery_at_a from
  dblink('phase5_race_conn_a',
    $$select last_discovery_at from private.verification_rate_limits
       where user_id = 'dddddddd-0000-0000-0000-facade000c01' for update$$
  ) as t(last_discovery_at_a timestamptz);

-- Hold the lock open asynchronously (a synchronous pg_sleep here would block
-- this whole script, leaving no chance to dispatch B or poll pg_stat_activity
-- during the hold window). Wrapped in `select 1 where pg_sleep(2) is null`
-- rather than a bare `select pg_sleep(2)`: pg_sleep returns void, and void
-- cannot be reliably typed through dblink_get_result's `AS t(col type)`
-- clause below — this form still forces the same sleep as a side effect of
-- evaluating the WHERE clause, but returns an ordinary (zero-row) integer
-- result set instead.
select dblink_send_query('phase5_race_conn_a', 'select 1 as ignored where pg_sleep(2) is null');

-- Get B's own backend pid up front (synchronous, fast, no contention yet).
create temp table phase5_race_pid_b as
  select pid from dblink('phase5_race_conn_b', 'select pg_backend_pid() as pid')
    as t(pid int);

-- Dispatch the REAL production RPC call on B while A is confirmed mid-sleep,
-- still holding the lock.
select dblink_send_query('phase5_race_conn_b',
  $$select count(*) as discovered from public.search_pending_submissions_nearby(44.05, -123.09, 10)$$);

-- ─── Observable blocked-state handshake (Codex round-2 finding #3) ─────────
-- Poll pg_stat_activity for B's own backend until it is actually reported
-- waiting on a lock — proving real contention occurred, not accidental
-- fast-sequential completion. Bounded timeout so a broken proof fails loudly
-- (the assertion below) instead of hanging. The result is recorded via UPDATE
-- (not CREATE TABLE AS SELECT) because UPDATE is one of the statement forms
-- PL/pgSQL directly substitutes local variables into without needing dynamic
-- EXECUTE; the target table is created first, outside the DO block.
create temp table phase5_race_b_wait_observed (observed boolean not null default false);
insert into phase5_race_b_wait_observed (observed) values (false);

do $do$
declare
  v_deadline  timestamptz := clock_timestamp() + interval '5 seconds';
  v_pid       int;
  v_wait_type text;
begin
  select pid into v_pid from phase5_race_pid_b;
  while clock_timestamp() < v_deadline loop
    select wait_event_type into v_wait_type
      from pg_stat_activity where pid = v_pid;
    if v_wait_type = 'Lock' then
      update phase5_race_b_wait_observed set observed = true;
      exit;
    end if;
    perform pg_sleep(0.05);
  end loop;
end
$do$;

-- Drain A's pg_sleep result (blocks briefly if the 2s sleep has not yet
-- elapsed — harmless, we already captured the blocked-state proof above).
-- dblink's async protocol (round-3 finding from both reviewers) requires
-- calling dblink_get_result an ADDITIONAL time to retrieve the terminating
-- empty result set before the connection is considered fully drained and can
-- be reused for another command — a single call is not sufficient, and
-- reusing the connection without the extra drain would fail with a
-- connection-busy error on the very next dblink_exec below.
select ignored from dblink_get_result('phase5_race_conn_a') as t(ignored int);
select ignored from dblink_get_result('phase5_race_conn_a') as t(ignored int);

-- Now claim A's own commit with a fresh, known timestamp simulating "another
-- caller just claimed this cooldown a moment ago."
select dblink_exec('phase5_race_conn_a',
  $$update private.verification_rate_limits
       set last_discovery_at = clock_timestamp()
     where user_id = 'dddddddd-0000-0000-0000-facade000c01'$$);
select dblink_exec('phase5_race_conn_a', 'commit');

-- A's commit releases the lock; B's blocked call now proceeds and observes
-- A's just-committed claim. Same extra-drain requirement applies to B.
create temp table phase5_race_result_b as
  select discovered from dblink_get_result('phase5_race_conn_b')
    as t(discovered bigint);
select discovered from dblink_get_result('phase5_race_conn_b') as t(discovered bigint);

select dblink_disconnect('phase5_race_conn_a');
select dblink_disconnect('phase5_race_conn_b');

select ok(
  (select observed from phase5_race_b_wait_observed),
  'the real discovery RPC call was independently observed genuinely blocked (wait_event_type = Lock) while a concurrent transaction held the same row lock');

select is(
  (select discovered from phase5_race_result_b),
  0::bigint,
  'once unblocked, the RPC correctly observes the concurrently-committed claim and denies (proves the decision reads the post-lock value, not a stale pre-lock read — the exact class of the round-1 TOCTOU bug)');

select ok(
  (select last_discovery_at is not null from private.verification_rate_limits
    where user_id = 'dddddddd-0000-0000-0000-facade000c01'),
  'the raced claim recorded a non-null last_discovery_at for the caller');

-- ─── Manual cleanup (no rollback available in this file — see header) ──────
delete from private.verification_rate_limits where user_id = 'dddddddd-0000-0000-0000-facade000c01';
delete from public.submissions where id = 'dddddddd-1111-0000-0000-facade00d001';
delete from auth.users where id in ('dddddddd-0000-0000-0000-facade000a01', 'dddddddd-0000-0000-0000-facade000c01');

select * from finish();
