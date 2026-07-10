-- Follow-up to 20260710000000_phase5prep_drop_verification_events_direct_insert.sql.
--
-- Dropping the authenticated INSERT policy closed the ordinary PostgREST/RLS write
-- path, but the live table still retained Supabase's broad default table grants for
-- both client roles. RLS currently denies row writes, yet TRUNCATE is not subject to
-- RLS and unused INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/MAINTAIN grants enlarge the
-- blast radius of any future policy or SQL surface mistake.
--
-- Intended least-privilege contract:
--   - anon: no direct verification_events table privileges;
--   - authenticated: SELECT only, constrained by verification_events_select_own;
--   - service_role/postgres: unchanged for server-owned workflows.
--
-- Future verification writes must go through hardened server-owned RPCs. Those
-- SECURITY DEFINER functions run as their owner and do not require client-role table
-- write grants.
revoke all privileges on table public.verification_events from anon, authenticated;
grant select on table public.verification_events to authenticated;
