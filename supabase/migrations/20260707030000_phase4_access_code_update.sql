-- Phase 4 (04-02 Task 2) — access-code UPDATE path (D-21/D-22/D-24/D-25)
-- (2026-07-07; applied after 04-01's 20260707020000_phase4_submission_staging.sql)
--
-- Implements the "submit/update the bathroom access code" requirement as an
-- abuse-resistant, two-party STAGE-THEN-CONFIRM gate on public.locations — the
-- same shape that gates location publishing, so a single malicious update cannot
-- silently break a working door code for everyone (RESEARCH §Pattern 5, OQ-3).
--
-- Section 1 — code-freshness + pending-code columns on `locations` (all nullable).
-- Section 2 — update_access_code   (write; stages a proposed code, NO overwrite).
-- Section 3 — confirm_access_code  (write; a DIFFERENT authed user promotes it).
-- Section 4 — get_access_code      (read; authed-only current-code read, SC6).
--
-- Conventions mirrored verbatim:
--   * auth-gate header + revoke/grant triple: 20260627000004_profile_rpcs.sql
--   * stable read-RPC header + moderation filter: 20260704010002_phase3_search_rpcs.sql
-- Write RPCs are NOT `stable`; the read RPC (get_access_code) keeps `stable`.
-- All three are authed-only: revoke from public AND anon, grant to authenticated.
-- The Phase 3 public detail read RPC is DELIBERATELY untouched (Pitfall 4):
-- this migration adds the ONLY code-returning read path.
--
-- NOTE: this migration references no PostGIS types/functions, so no
-- extensions.* schema-qualification is required here (unlike 04-01's migration).

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 1 — code-freshness + staged-code columns on public.locations.
-- All nullable, no backfill. access_code_confirmed_at (D-22 freshness) is set at a
-- confirmed update; the two pending_* columns hold a proposed code awaiting a
-- second-party confirmation (D-24) and are NULL when nothing is pending.
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.locations
  add column if not exists access_code_confirmed_at timestamptz,
  add column if not exists pending_access_code       text,
  add column if not exists pending_code_proposed_by  uuid;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 2 — update_access_code (write, stages only — D-24 no instant overwrite)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Stages the proposed code in pending_access_code + records the proposer. It NEVER
-- touches access_instructions or access_code_confirmed_at — the live code only
-- changes once a DIFFERENT authed user calls confirm_access_code. The target must
-- be a real PUBLISHED location; otherwise a single generic error is raised.
create or replace function public.update_access_code(
  p_location_id uuid,
  p_code        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.locations
     where id = p_location_id
       and deleted_at is null
       and shadowban_status is not true
       and suppressed_at is null
  ) then
    raise exception 'location not available';            -- generic; no detail echoed
  end if;

  -- Stage only. access_instructions + access_code_confirmed_at are left untouched.
  update public.locations
     set pending_access_code      = p_code,
         pending_code_proposed_by = v_uid
   where id = p_location_id;
end;
$$;

revoke execute on function public.update_access_code(uuid,text) from public;
revoke execute on function public.update_access_code(uuid,text) from anon;
grant  execute on function public.update_access_code(uuid,text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 3 — confirm_access_code (write, second-party promotion — D-24/D-25)
-- ═══════════════════════════════════════════════════════════════════════════════
-- A staged code is promoted to the live access_instructions ONLY when the confirmer
-- is a DIFFERENT authenticated user than the proposer. On success it overwrites the
-- old code with no history kept (D-25) and resets access_code_confirmed_at = now()
-- (D-22 freshness), then clears both pending columns.
create or replace function public.confirm_access_code(
  p_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_pending     text;
  v_proposed_by uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select pending_access_code, pending_code_proposed_by
    into v_pending, v_proposed_by
    from public.locations
   where id = p_location_id
     and deleted_at is null
     and shadowban_status is not true
     and suppressed_at is null;

  if v_pending is null or v_proposed_by is null then
    raise exception 'no pending code to confirm';        -- generic; nothing staged
  end if;

  -- D-24: the confirmer MUST differ from the proposer — no self-confirmation.
  if v_proposed_by = v_uid then
    raise exception 'cannot confirm own code';
  end if;

  -- D-25 overwrite (no history) + D-22 freshness reset + clear the staged code.
  -- The `pending_code_proposed_by <> auth.uid()` predicate is defense-in-depth so
  -- the promotion can never occur under a self-confirming caller.
  update public.locations
     set access_instructions      = v_pending,
         access_code_confirmed_at = now(),
         pending_access_code      = null,
         pending_code_proposed_by = null
   where id = p_location_id
     and pending_code_proposed_by <> auth.uid();
end;
$$;

revoke execute on function public.confirm_access_code(uuid) from public;
revoke execute on function public.confirm_access_code(uuid) from anon;
grant  execute on function public.confirm_access_code(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 4 — get_access_code (read, authed-only — SC6)
-- ═══════════════════════════════════════════════════════════════════════════════
-- The ONLY read path that returns a door code, for the "Update door code" UI.
-- Authed-only: anon callers are rejected. The Phase 3 public detail RPC is NOT
-- modified, so the public search/detail contract never widens to the code (Pitfall 4).
create or replace function public.get_access_code(
  p_location_id uuid
)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select access_instructions
    into v_code
    from public.locations
   where id = p_location_id
     and deleted_at is null
     and shadowban_status is not true
     and suppressed_at is null;

  return v_code;
end;
$$;

revoke execute on function public.get_access_code(uuid) from public;
revoke execute on function public.get_access_code(uuid) from anon;
grant  execute on function public.get_access_code(uuid) to authenticated;
