-- Phase 4 (04-01 Task 2) — submission staging columns + submission-lifecycle RPCs
-- (2026-07-07)
--
-- Resolves the phase's central storage question as OPTION A (RESEARCH §Pattern 1):
-- pending bathroom data lives ONLY on the `submissions` row — no `locations` row is
-- created until Phase 5's publish gate. Phase 3's five shipped readers are untouched
-- and cannot leak pending data by construction.
--
-- Section 1 — typed staging columns on `submissions` (all nullable; zero prod rows).
-- Section 2 — submit_location   (write; server-side GPS validation + pending insert).
-- Section 3 — get_my_pending_submissions (read; auth.uid()-scoped pending pins).
-- Section 4 — withdraw_submission (write; owner-only DELETE of a pending row).
--
-- Conventions mirrored verbatim:
--   * auth-gate header + revoke/grant triple: 20260627000004_profile_rpcs.sql
--   * app_config read + coalesce fallback:    20260704010002_phase3_search_rpcs.sql
--   * PostGIS coordinate handling (lng first): st_setsrid(st_makepoint(lng,lat),4326)::geography
-- Write RPCs are NOT `stable`; the read RPC keeps `stable`.
-- All three are authed-only: revoke from public AND anon, grant to authenticated
-- (get_my_pending_submissions is NOT granted to anon, unlike the Phase 3 search RPCs).

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 1 — staging columns on public.submissions (mirror the eventual
--             `locations` types for a clean Phase 5 publish copy). All nullable.
-- Per OQ-4: the submission-time timing tip is staged on `timing_tip` ONLY this
-- phase — the dedicated `timing_tips` table is deferred to Phase 5's publish gate.
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.submissions
  add column if not exists name                     text,
  add column if not exists coordinates              extensions.geography(Point, 4326),
  add column if not exists address                  text,
  add column if not exists policy_tag               text,
  add column if not exists access_sensitivity       text,
  add column if not exists hours                    jsonb,
  add column if not exists access_instructions      text,
  add column if not exists access_code_confirmed_at timestamptz,
  add column if not exists timing_tip               text;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 2 — submit_location (write, server-authoritative GPS validation)
-- ═══════════════════════════════════════════════════════════════════════════════
-- The client passes the RAW GPS sample (lat/lng/accuracy/mocked/captured_at). The
-- RPC re-validates against app_config thresholds and raises a SINGLE generic
-- 'gps rejected' error on failure (SC7 — the specific failing check is never echoed).
-- On success it stages a pending submissions row with confirmation_count=1
-- (creator-initial event, OQ-2) and coordinates as geography. It NEVER touches
-- `locations`. `expires_at` keeps its existing 14-day column default.
create or replace function public.submit_location(
  p_name                 text,
  p_lat                  numeric,
  p_lng                  numeric,
  p_accuracy_m           numeric,
  p_mocked               boolean,
  p_captured_at          timestamptz,
  p_policy_tag           text,
  p_address              text        default null,
  p_access_sensitivity   text        default null,   -- 'sensitive' or null (D-09)
  p_hours                jsonb       default null,
  p_access_code          text        default null,   -- only when policy_tag='code_required' (D-17)
  p_timing_tip           text        default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_accuracy numeric;
  v_max_age_s    numeric;
  v_id           uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';                 -- D-18
  end if;

  -- Config-driven thresholds (admin-tunable; never hardcoded in client).
  select value::numeric into v_max_accuracy from public.app_config where key = 'max_accuracy_m';
  select value::numeric into v_max_age_s    from public.app_config where key = 'max_gps_age_s';
  v_max_accuracy := coalesce(v_max_accuracy, 50);
  v_max_age_s    := coalesce(v_max_age_s, 60);

  -- SC2/SC7 — server-side rejection. Single generic error; no PII/coords/reason echoed.
  if p_mocked is true then
    raise exception 'gps rejected';                      -- mock provider (Pitfall 1 trust boundary)
  end if;
  if p_accuracy_m is null or p_accuracy_m > v_max_accuracy then
    raise exception 'gps rejected';                      -- accuracy
  end if;
  if p_captured_at is null or (now() - p_captured_at) > make_interval(secs => v_max_age_s) then
    raise exception 'gps rejected';                      -- freshness
  end if;

  insert into public.submissions
    (submitter_id, status, confirmation_count,
     name, coordinates, address, policy_tag, access_sensitivity, hours,
     access_instructions, access_code_confirmed_at, timing_tip)
  values
    (auth.uid(), 'pending', 1,                           -- confirmation_count=1 = creator-initial (SC3)
     p_name,
     extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,   -- lng FIRST
     p_address, p_policy_tag, p_access_sensitivity, p_hours,
     p_access_code, now(), p_timing_tip)                 -- D-22: code_confirmed_at defaults to created_at
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text) from public;
revoke execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text) from anon;
grant  execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 3 — get_my_pending_submissions (read, auth.uid()-scoped)
-- ═══════════════════════════════════════════════════════════════════════════════
-- The SOLE "visible only to submitter" enforcement point (RESEARCH §Pattern 4):
-- scopes to the caller's own pending rows. Phase 3's five readers are untouched.
-- Anonymous callers get zero rows (return early). Authed-only grant.
create or replace function public.get_my_pending_submissions()
returns table (
  id                 uuid,
  name               text,
  lat                double precision,
  lng                double precision,
  policy_tag         text,
  confirmation_count integer,
  expires_at         timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;                                              -- anon → no pending pins
  end if;

  return query
  select s.id,
         s.name,
         extensions.st_y(s.coordinates::extensions.geometry)::double precision as lat,
         extensions.st_x(s.coordinates::extensions.geometry)::double precision as lng,
         s.policy_tag,
         s.confirmation_count,
         s.expires_at
  from public.submissions s
  where s.submitter_id = auth.uid()
    and s.status = 'pending';
end;
$$;

revoke execute on function public.get_my_pending_submissions() from public;
revoke execute on function public.get_my_pending_submissions() from anon;
grant  execute on function public.get_my_pending_submissions() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Section 4 — withdraw_submission (write, owner-only)
-- ═══════════════════════════════════════════════════════════════════════════════
-- D-29 "as if never submitted" → DELETE the pending row (never a withdrawn status
-- value, which the submissions.status CHECK forbids). Guarded by submitter_id = auth.uid()
-- AND status='pending' so a caller can only remove their OWN pending submission
-- (Pitfall 6). Confirm dialog is client-side (D-30).
create or replace function public.withdraw_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.submissions
  where id = p_submission_id
    and submitter_id = uid
    and status = 'pending';
end;
$$;

revoke execute on function public.withdraw_submission(uuid) from public;
revoke execute on function public.withdraw_submission(uuid) from anon;
grant  execute on function public.withdraw_submission(uuid) to authenticated;
