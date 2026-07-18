-- Phase 5 (05-01 Task 2) — event-model evolution: polymorphic verification_events,
-- submissions lifecycle CHECK, submission_tags staging, private discovery/verify
-- rate-limit state, delete_account raw-GPS purge, event-aware withdraw_submission.
-- (2026-07-17)
--
-- Section 1 — verification_events: polymorphic FK + exactly-one CHECK (D-39).
-- Section 2 — verification_events: missing weight-input audit columns (D-40).
-- Section 3 — verification_events: per-user-per-submission uniqueness (D-43).
-- Section 4 — submissions.status CHECK: add 'cancelled' (D-58).
-- Section 5 — submission_tags staging table (D-62/D-63).
-- Section 6 — PRESERVE the 2026-07-10 verification_events client-write lockdown.
-- Section 7 — delete_account(): purge raw GPS coordinate (D-41), preserve derived
--             evidence (D-40), harden to the Phase 5 fixed-empty search_path contract.
-- Section 8 — withdraw_submission(): event-aware D-58 rewrite, WR-04 preserved,
--             hardened to the Phase 5 fixed-empty search_path contract.
-- Section 9 — private schema + verification_rate_limits (D-36 discovery/verify cooldown).
--
-- Conventions followed: alter-add-column idiom (20260707020000 §1); ACL lockdown
-- contract (20260710121534, preserved byte-for-byte — no new grant added here);
-- withdraw_submission rewritten from the LATEST WR-04 body in
-- 20260708000000_phase4_code_review_fixes.sql (lines 171-195), NOT the older
-- 20260707020000 hard-delete-only body. All new/rewritten SECURITY DEFINER
-- functions use `set search_path = ''` with every object schema-qualified
-- (Phase 5 hardening — NOT `set search_path = public`/`public, auth`).
--
-- D-42 grandfather note: existing Phase 4 pending rows with no stored creator GPS
-- evidence keep confirmation_count=1 as-is; this migration inserts NO synthetic
-- creator verification_events row. submit_location writing full creator weight-input
-- evidence for FUTURE submissions is 05-02 scope.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 1 — verification_events: polymorphic target (D-39)
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.verification_events
  add column if not exists submission_id uuid references public.submissions(id);

alter table public.verification_events
  alter column location_id drop not null;

alter table public.verification_events
  drop constraint if exists verification_events_target_exactly_one;
alter table public.verification_events
  add constraint verification_events_target_exactly_one
  check (num_nonnulls(submission_id, location_id) = 1);

create index if not exists idx_verification_events_submission_id
  on public.verification_events (submission_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 2 — verification_events: missing weight-input audit columns (D-40)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Reuse the shipped `gps_location` (the SINGLE raw-coordinate authority — the
-- original raw numeric lat/lon columns were backfilled into gps_location and
-- DROPPED by 20260519020000_fix_schema.sql, lines 43-46, and do NOT exist live)
-- and the shipped `distance_from_location_meters`. Add only what's missing.
alter table public.verification_events
  add column if not exists gps_accuracy_m       numeric,
  add column if not exists captured_at          timestamptz,
  add column if not exists raw_gps_purge_after  timestamptz;

-- D-40: the raw coordinate (gps_location) is retained for a reviewed fraud/audit
-- window then purged; derived distance/accuracy/weight is retained permanently.
-- The exact retention-window day count is intentionally NOT hardcoded here — it is
-- decided at the 05-02 Task 1 decision checkpoint alongside the other Claude's-
-- Discretion tunables (trust deltas, confidence thresholds, decay constants), seeded
-- into app_config as `raw_gps_retention_days`, and consumed when verify_location /
-- submit_location (05-02) compute
--   raw_gps_purge_after = now() + (retention_days || ' days')::interval
-- at insert time. Because this column is added nullable with NO default, any
-- verification_events row created before 05-02 ships has a NULL deadline and is
-- NEVER purge-eligible (NULL <= now() is never true) — 05-06 Task 1 MUST
-- deterministically backfill those NULL deadlines once raw_gps_retention_days is
-- seeded. The executable purge routine + schedule are also 05-06 scope.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 3 — per-user-per-submission uniqueness (D-43)
-- ═══════════════════════════════════════════════════════════════════════════════
create unique index if not exists verification_events_user_submission_uniq
  on public.verification_events (user_id, submission_id)
  where submission_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 4 — submissions.status lifecycle CHECK: add 'cancelled' (D-58)
-- ═══════════════════════════════════════════════════════════════════════════════
-- RESEARCH A3 (confirmed this session): the live CHECK is
-- ('pending','published','expired','rejected') — 'cancelled' is missing and the
-- D-58 withdraw-with-event write fails until this alter runs.
alter table public.submissions
  drop constraint if exists submissions_status_check;
alter table public.submissions
  add constraint submissions_status_check
  check (status = any(array['pending','published','expired','rejected','cancelled']));

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 5 — submission_tags staging table (D-62/D-63)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mirrors public.tags (location_id, key, value) shape, keyed by submission_id.
-- Exactly the 2 keys SubmitFlow already renders: changing_table, wheelchair.
create table if not exists public.submission_tags (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  key           text not null check (key in ('changing_table', 'wheelchair')),
  value         text not null,
  created_at    timestamptz default now(),
  unique (submission_id, key)
);

create index if not exists idx_submission_tags_submission_id
  on public.submission_tags (submission_id);

alter table public.submission_tags enable row level security;

-- Owner-scoped select only — a submission's tags are visible to the submitter.
create policy "submission_tags_select_own"
  on public.submission_tags for select
  using (exists (
    select 1 from public.submissions s
     where s.id = submission_tags.submission_id
       and s.submitter_id = (select auth.uid())
  ));

create policy "submission_tags_service_all"
  on public.submission_tags for all
  using ((auth.jwt() ->> 'role') = 'service_role');

-- NO client insert grant. Writes happen only inside submit_location / the eventual
-- publish RPC — both SECURITY DEFINER, running as the table owner. authenticated
-- gets SELECT only (constrained further by the owner-scoped RLS policy above).
revoke all privileges on table public.submission_tags from anon, authenticated;
grant select on table public.submission_tags to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 6 — PRESERVE the verification_events client-write lockdown
-- ═══════════════════════════════════════════════════════════════════════════════
-- See 20260710121534_verification_events_client_write_acl_lockdown.sql: anon has
-- zero direct table privileges, authenticated keeps SELECT-only (constrained by
-- verification_events_select_own). This migration adds NO grant to either role —
-- the new submission_id column and the new CHECK/index above do not widen the ACL.
-- Future verification writes remain RPC-only (05-02's verify_location).

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 7 — delete_account(): purge raw GPS coordinate (D-41), preserve derived
--             evidence (D-40), harden to Phase 5's fixed-empty search_path contract
-- ═══════════════════════════════════════════════════════════════════════════════
-- The live body (20260627000004_profile_rpcs.sql:52) uses
-- `set search_path = public, auth`, which does not meet Phase 5's fixed-empty
-- search_path contract (05-PATTERNS.md — every Phase 5 SECURITY DEFINER RPC uses
-- `set search_path=''` with full schema qualification). This rewrite hardens it.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Anonymize community contributions so deletion cannot be blocked by the
  -- NOT NULL -> ON DELETE SET NULL constraints (unchanged from the prior body).
  update public.submissions set submitter_id = null where submitter_id = uid;
  update public.ratings set user_id = null where user_id = uid;
  update public.trust_events set user_id = null where user_id = uid;

  -- D-41: purge the raw GPS coordinate immediately on account deletion, regardless
  -- of where the retention window stands. gps_location is the SINGLE raw-coordinate
  -- authority (the original raw numeric lat/lon columns were dropped by
  -- 20260519020000 and do NOT exist live — never referenced here). D-40: derived
  -- evidence (distance_from_location_meters, gps_accuracy_m, weight) is explicitly
  -- PRESERVED — only user_id and gps_location are touched.
  update public.verification_events
     set user_id = null,
         gps_location = null
   where user_id = uid;

  update public.reports set user_id = null where user_id = uid;
  update public.failure_events set user_id = null where user_id = uid;
  update public.availability_flags set reporter_id = null where reporter_id = uid;

  -- Delete the auth user — cascades to public.users via the users.id FK.
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_account() from public;
revoke execute on function public.delete_account() from anon;
grant execute on function public.delete_account() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 8 — withdraw_submission(): event-aware D-58 rewrite, WR-04 preserved,
--             hardened to Phase 5's fixed-empty search_path contract
-- ═══════════════════════════════════════════════════════════════════════════════
-- Rewritten from the LATEST WR-04 body (20260708000000_phase4_code_review_fixes.sql
-- lines 171-195) — NOT the older 20260707020000 silent-no-op body. Locks the owned
-- pending submission FIRST (same submission-row-first lock order 05-02's
-- verify_location uses). D-58: if any verification_events row references it, move
-- to 'cancelled' (row + immutable events retained); only with NO event does the
-- hard-delete path apply. The WR-04 failure signal survives unchanged: a zero-row
-- ownership/status match still raises 'submission not available'.
create or replace function public.withdraw_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid         uuid := auth.uid();
  v_locked_id uuid;
  v_has_event boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_locked_id
    from public.submissions
   where id = p_submission_id
     and submitter_id = uid
     and status = 'pending'
   for update;

  if v_locked_id is null then
    raise exception 'submission not available';   -- WR-04: zero-row match still raises
  end if;

  select exists (
    select 1 from public.verification_events ve
     where ve.submission_id = v_locked_id
  ) into v_has_event;

  if v_has_event then
    -- D-58: an event already exists — cancel, never hard-delete. The immutable
    -- verification_events row(s) are retained as-is.
    update public.submissions
       set status = 'cancelled',
           updated_at = now()
     where id = v_locked_id;
  else
    -- No event exists yet — "as if never submitted" (D-29, unchanged for the
    -- unverified case).
    delete from public.submissions where id = v_locked_id;
  end if;
end;
$$;

revoke execute on function public.withdraw_submission(uuid) from public;
revoke execute on function public.withdraw_submission(uuid) from anon;
grant execute on function public.withdraw_submission(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 9 — private schema + verification_rate_limits (D-36 discovery/verify
--             per-user cooldown state)
-- ═══════════════════════════════════════════════════════════════════════════════
create schema if not exists private;

create table if not exists private.verification_rate_limits (
  user_id                 uuid primary key references public.users(id) on delete cascade,
  last_discovery_at       timestamptz,
  last_verify_attempt_at  timestamptz
);

-- Not Data-API exposed (PostgREST only serves schemas listed in the exposed-schemas
-- config, which `private` is not). Client roles get zero direct privileges as
-- defense in depth; only approved SECURITY DEFINER RPCs (owned by postgres) read or
-- write this table.
revoke all privileges on table private.verification_rate_limits from anon, authenticated;
