-- Phase 4 Codex review fixes (2026-07-08)
--
-- Codex [MAJOR] finding: update_access_code stages p_code with NO server-side
-- non-empty/non-blank validation. A client calling the RPC directly (bypassing
-- the UI's own trim-and-ignore-blank guard) can stage NULL or an empty/whitespace
-- string. Once staged:
--   - NULL: a DIFFERENT user is then blocked from staging their own real proposal
--     by the CR-02 guard ('code update already pending', since
--     pending_code_proposed_by is set even though pending_access_code is null),
--     and confirm_access_code can never clear it because it raises
--     'no pending code to confirm' whenever v_pending is null (line ~106-108 of
--     20260708000000_phase4_code_review_fixes.sql) — the location's code update
--     path gets stuck.
--   - '' or whitespace: a colluding second account CAN confirm it (v_pending is
--     the non-null string '' or '   ', not NULL), promoting a blank/corrupted
--     value into access_instructions and silently clearing the live door code.
--
-- Fix: reject p_code is null or btrim(p_code) = '' up front, and stage the
-- TRIMMED value (matching the client's own trim-before-send behavior, so the
-- staged value always matches what the UI displayed to the proposer).
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
  v_trimmed text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_code is null or btrim(p_code) = '' then
    raise exception 'code cannot be blank';
  end if;
  v_trimmed := btrim(p_code);
  if char_length(v_trimmed) > 100 then
    raise exception 'code is too long';                  -- mirrors the locations_pending_access_code_length_chk bound
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

  -- Stage only (trimmed). access_instructions + access_code_confirmed_at untouched.
  update public.locations
     set pending_access_code      = v_trimmed,
         pending_code_proposed_by = v_uid
   where id = p_location_id;
end;
$$;
