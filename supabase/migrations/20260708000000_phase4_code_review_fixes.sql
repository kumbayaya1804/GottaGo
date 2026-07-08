-- Phase 4 code-review fixes (04-REVIEW.md, 2026-07-08)
--
-- Fixes CR-02 (critical) and WR-01/WR-02/WR-03/WR-04/WR-05/IN-01 found during the
-- phase's end-of-execution code review. Each function is `create or replace` — no
-- new tables, no data migration. Applied after 20260707020000 and 20260707030000.
--
-- CR-02: update_access_code unconditionally overwrote ANY existing pending proposal
--        from a different user, defeating the two-party stage-then-confirm gate's
--        own stated abuse-resistance goal (an attacker's second account could stage
--        a malicious code over a legitimate pending one, then confirm from account 2).
-- WR-01: get_access_code returned a bare NULL typed as non-nullable `text` when no
--        code was set or the location wasn't visible — now raises the same generic
--        error the write RPCs use.
-- WR-02: submit_location's freshness check didn't reject a future-dated p_captured_at
--        (negative age always passes the staleness bound).
-- WR-03: confirm_access_code's promoting UPDATE didn't re-apply the visibility
--        filters (deleted_at/shadowban_status/suppressed_at) used by its initial SELECT.
-- WR-04: withdraw_submission silently no-op'd on a non-matching id instead of
--        signaling failure, indistinguishable from a real success to the caller.
-- WR-05 (partial): pending_access_code now has a length CHECK matching the client's
--        100-char bound (submitSchema.accessCode) for defense in depth.
-- IN-01: submissions.policy_tag / access_sensitivity now have CHECK constraints
--        matching the 4-value enum / 'sensitive'-or-null contract enforced only
--        client-side before this fix.

-- ═══════════════════════════════════════════════════════════════════════════════
-- CR-02 fix — update_access_code rejects staging over a DIFFERENT user's pending
-- proposal. The proposer may re-stage their own proposal (e.g. fixing a typo)
-- freely; only a different user's in-flight proposal is protected.
-- ═══════════════════════════════════════════════════════════════════════════════
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
  v_existing_proposer uuid;
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

  select pending_code_proposed_by into v_existing_proposer
    from public.locations
   where id = p_location_id;

  -- CR-02: refuse to clobber a DIFFERENT user's in-flight proposal. The same user
  -- re-staging (e.g. correcting a typo before anyone confirms) is still allowed.
  if v_existing_proposer is not null and v_existing_proposer <> v_uid then
    raise exception 'code update already pending';
  end if;

  -- Stage only. access_instructions + access_code_confirmed_at are left untouched.
  update public.locations
     set pending_access_code      = p_code,
         pending_code_proposed_by = v_uid
   where id = p_location_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- WR-03 fix — confirm_access_code's promoting UPDATE re-applies the same
-- visibility filters used by its initial SELECT, closing the TOCTOU-style gap
-- where a location could be soft-deleted/shadowbanned/suppressed between the two.
-- ═══════════════════════════════════════════════════════════════════════════════
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
  -- WR-03: re-apply the same visibility predicates as the initial SELECT so a
  -- location that became invisible between the read and this write is not promoted.
  update public.locations
     set access_instructions      = v_pending,
         access_code_confirmed_at = now(),
         pending_access_code      = null,
         pending_code_proposed_by = null
   where id = p_location_id
     and pending_code_proposed_by <> auth.uid()
     and deleted_at is null
     and shadowban_status is not true
     and suppressed_at is null;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- WR-01 fix — get_access_code raises the same generic error as the write RPCs
-- instead of silently returning NULL typed as non-nullable `text`.
-- ═══════════════════════════════════════════════════════════════════════════════
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

  if v_code is null then
    raise exception 'location not available';            -- generic; matches update/confirm
  end if;

  return v_code;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- WR-04 fix — withdraw_submission raises when the caller's id/ownership/status
-- guard matches zero rows, instead of a silent, indistinguishable-from-success no-op.
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.withdraw_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_deleted_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.submissions
  where id = p_submission_id
    and submitter_id = uid
    and status = 'pending'
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'submission not available';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- WR-02 fix — submit_location rejects a p_captured_at set in the future, not just
-- a stale one. A small allowance (5s) absorbs clock skew between device and server.
-- ═══════════════════════════════════════════════════════════════════════════════
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
  if p_captured_at is null
     or (now() - p_captured_at) > make_interval(secs => v_max_age_s)
     or p_captured_at > now() + interval '5 seconds' then  -- WR-02: reject future-dated fixes too
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- WR-05 (partial) — bound pending_access_code to the same 100-char limit
-- submitSchema.accessCode already enforces client-side, for defense in depth.
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.locations
  drop constraint if exists locations_pending_access_code_length_chk;
alter table public.locations
  add constraint locations_pending_access_code_length_chk
  check (char_length(pending_access_code) <= 100);

-- ═══════════════════════════════════════════════════════════════════════════════
-- IN-01 — server-side enum/value validation on submissions.policy_tag and
-- access_sensitivity, matching the client's zod enum and the 'sensitive'-or-null
-- contract (previously enforced client-side only).
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.submissions
  drop constraint if exists submissions_policy_tag_chk;
alter table public.submissions
  add constraint submissions_policy_tag_chk
  check (policy_tag is null or policy_tag in ('chill_spot', 'purchase_required', 'code_required', 'public_facility'));

alter table public.submissions
  drop constraint if exists submissions_access_sensitivity_chk;
alter table public.submissions
  add constraint submissions_access_sensitivity_chk
  check (access_sensitivity is null or access_sensitivity = 'sensitive');
