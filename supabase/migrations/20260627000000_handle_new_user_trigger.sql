-- Phase 2: Auth & Profiles — Wave 0 (2026-06-27)
--
-- Captures the existing live handle_new_user trigger and its function in version
-- control so the migration history is reproducible from scratch.
--
-- Live gap closed: The trigger and function exist on the remote project
-- (applied manually prior to Phase 1 scaffolding) but were never tracked in
-- supabase/migrations. This migration makes the schema self-contained.
--
-- Live trigger verified 2026-06-28 via Supabase MCP:
--   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user()
--
-- Function body (LOCKED per 02-CONTEXT.md §10 — id+email ONLY, no display_name):
--   INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email); RETURN NEW;
--
-- Mitigates: T-02-PROV — no client INSERT on users; profile row created only by
-- this SECURITY DEFINER trigger (no INSERT RLS policy on public.users).

-- ─── 1. Recreate handle_new_user function (idempotent) ───────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- ─── 2. Recreate trigger (drop-if-exists for reproducibility) ────────────────
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
