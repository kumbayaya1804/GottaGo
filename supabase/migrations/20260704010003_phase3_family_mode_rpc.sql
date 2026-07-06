-- Phase 3 (03-01 Task 2) — extend update_profile with family_mode (2026-07-04)
--
-- D-30: the family_mode Settings toggle (03-04) writes through the EXISTING
-- update_profile RPC rather than a near-duplicate function. Adding a parameter
-- changes the signature, so the old update_profile(text) is dropped and a new
-- update_profile(text, boolean) is created with BOTH params defaulting null:
--   * a display-name-only call (Phase 2)        → update_profile(new_display_name := 'X')
--   * a family-mode-only call (03-04 setFamily) → update_profile(new_family_mode := true)
--
-- CRITICAL (both reviewers, 2026-07-05): BOTH columns are updated via coalesce so
-- each call touches ONLY what it sends. Writing `display_name = new_display_name`
-- unconditionally would null the caller's display name on every family-mode toggle
-- (update_profile(null, true)). Authenticated-only (auth.uid() guard + role grants).

-- Drop the old single-arg signature so the extended one is unambiguous.
drop function if exists public.update_profile(text);

create or replace function public.update_profile(new_display_name text default null, new_family_mode boolean default null)
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
    set display_name = coalesce(new_display_name, display_name),
        family_mode  = coalesce(new_family_mode, family_mode),
        updated_at   = now()
  where id = auth.uid();
end;
$$;

-- Re-issue grants against the NEW arg list (text, boolean). Supabase ALTER DEFAULT
-- PRIVILEGES auto-grants EXECUTE to anon/authenticated, so revoking PUBLIC alone is
-- insufficient — explicitly revoke from anon too (authenticated-only write).
revoke execute on function public.update_profile(text, boolean) from public;
revoke execute on function public.update_profile(text, boolean) from anon;
grant  execute on function public.update_profile(text, boolean) to authenticated;
