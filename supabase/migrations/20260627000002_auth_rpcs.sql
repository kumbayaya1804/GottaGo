-- Phase 2: Auth & Profiles — Wave 0 (2026-06-27)
--
-- Two SECURITY DEFINER RPCs for the auth flow:
--
--   check_display_name_available(name text) → boolean
--     Pre-signup availability check. Callable by anon (pre-auth sign-up form)
--     and authenticated (profile editing in later phases).
--
--   set_gps_consent() → void
--     Writes gps_consent = true and gps_consent_at = now() for the calling user.
--     Callable by authenticated role only. GPS consent is NEVER written by the
--     client directly — only through this RPC after the OS dialog resolves to
--     'granted' (T-02-04).
--
-- Live gap closed: Neither RPC exists on the remote project yet. The auth modules
-- in 02-01b (displayName.ts, gpsConsent.ts) call these RPCs directly.

-- ─── 1. check_display_name_available ─────────────────────────────────────────
create or replace function public.check_display_name_available(name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from users
    where lower(display_name) = lower(name)
  );
$$;

grant execute on function public.check_display_name_available(text) to anon;
grant execute on function public.check_display_name_available(text) to authenticated;

-- ─── 2. set_gps_consent ──────────────────────────────────────────────────────
create or replace function public.set_gps_consent()
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
    set gps_consent    = true,
        gps_consent_at = now()
  where id = auth.uid();
end;
$$;

-- Restrict set_gps_consent to authenticated only.
-- Supabase auto-grants EXECUTE to anon/authenticated/service_role on all new
-- public-schema functions via ALTER DEFAULT PRIVILEGES (pg_default_acl). Revoking
-- from PUBLIC alone is insufficient — anon must be revoked explicitly as well.
revoke execute on function public.set_gps_consent() from public;
revoke execute on function public.set_gps_consent() from anon;
grant execute on function public.set_gps_consent() to authenticated;
