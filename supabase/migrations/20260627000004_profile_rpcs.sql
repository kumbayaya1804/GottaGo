-- Phase 2: Auth & Profiles — Wave 0 (2026-06-27)
--
-- Two SECURITY DEFINER RPCs for profile management:
--
--   update_profile(new_display_name text) → void
--     Sets display_name on public.users for the calling user post-signup.
--     The handle_new_user trigger (migration 000000) provisions the row with id+email
--     but NOT display_name — this RPC fills it after supabase.auth.signUp returns.
--     The lower(display_name) unique index from migration 000001 acts as the
--     race-safe backstop against duplicate display names (CONTEXT §10).
--     Callable by authenticated only.
--
--   delete_account() → void
--     Anonymizes all 7 community-data tables (set FK to null) then deletes the
--     auth.users row, which cascades to public.users via the FK added in the
--     remote schema. Anonymization + deletion is a single atomic transaction so
--     partial states are impossible. Callable by authenticated only (T-02-03 is
--     enforced at the UI layer via the type-DELETE modal gate).
--
-- Grant style: same as set_gps_consent in migration 000002.
-- Both RPCs revoke from PUBLIC + anon explicitly — Supabase ALTER DEFAULT
-- PRIVILEGES auto-grants EXECUTE to anon/authenticated/service_role, so revoking
-- PUBLIC alone is insufficient.

-- ─── 1. update_profile ───────────────────────────────────────────────────────
create or replace function public.update_profile(new_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.users
    set display_name = new_display_name,
        updated_at   = now()
  where id = auth.uid();
end;
$$;

revoke execute on function public.update_profile(text) from public;
revoke execute on function public.update_profile(text) from anon;
grant execute on function public.update_profile(text) to authenticated;

-- ─── 2. delete_account ───────────────────────────────────────────────────────
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Anonymize community contributions so deletion cannot be blocked by the
  -- NOT NULL → ON DELETE SET NULL constraints in migration 000003.
  update submissions set submitter_id = null where submitter_id = uid;
  update ratings set user_id = null where user_id = uid;
  update trust_events set user_id = null where user_id = uid;
  update verification_events set user_id = null where user_id = uid;
  update reports set user_id = null where user_id = uid;
  update failure_events set user_id = null where user_id = uid;
  update availability_flags set reporter_id = null where reporter_id = uid;

  -- Delete the auth user — cascades to public.users via the users.id FK.
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_account() from public;
revoke execute on function public.delete_account() from anon;
grant execute on function public.delete_account() to authenticated;
