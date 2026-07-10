-- Codex CRITICAL remediation, part 2 (2026-07-10) — sweep ALL remaining
-- overloads of the legacy radius RPCs.
--
-- 20260710020000 dropped the signatures the migration files declared
-- (numeric params) — which turned out to be only the SECURITY DEFINER
-- overloads that the 2026-06-24 migrations had ADDED alongside, not replaced,
-- the original remote-schema baseline versions. Verified live after that push:
-- one overload of each function survived, with baseline signatures the
-- migration files never described —
--   get_locations_in_radius(double precision, double precision, integer,
--                           boolean ×7 in a different parameter order)
--   count_locations_within(double precision, double precision, integer)
--
-- Exposure check on the survivors (verified live): they are INVOKER-rights
-- (prosecdef=false), so the base-table SELECT revocation applies to the
-- caller — `set local role anon; select ... from get_locations_in_radius(...)`
-- raises `42501 permission denied for table locations`. The active
-- exfiltration path was therefore fully closed by 20260710020000; these
-- remnants are inert. They are still dropped here because (a) they remain
-- EXECUTE-granted to anon/authenticated and would silently become a leak again
-- if anyone ever re-granted table SELECT or flipped them to SECURITY DEFINER,
-- and (b) the review contract's pgTAP coverage
-- (phase5prep_legacy_radius_rpcs_dropped.test.sql) asserts zero overloads of
-- either name under ANY signature.
--
-- A DO block drops every overload by name so no future signature drift can
-- cause another silent `if exists` no-op (the failure mode of 20260710020000).

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_locations_in_radius', 'count_locations_within')
  loop
    execute 'drop function ' || fn.sig;
  end loop;
end $$;
