-- Fix migration: RLS policy corrections — BLOCK findings from Antigravity + Codex review
--
-- 1. users_update_own: drop — no column restrictions; users could write trust_score,
--    trust_multiplier, shadowban_status, admin_override on their own row.
--    NOTE: no replacement policy is added here. Safe profile mutations (display_name,
--    family_mode, gps_consent, gps_consent_at) must go through a SECURITY DEFINER RPC
--    added in Phase 2 before profile editing is wired in the client.
--
-- 2. locations_update_auth: drop — any authenticated user could UPDATE any location,
--    including confidence_score, shadowban_status, deleted_at. locations_service_all
--    already covers service_role; no client-side UPDATE path is needed.
--
-- 3. reports_select_public: replace using (true) with own-row only — the reports table
--    includes user_id (reporter identity). Public read exposes who filed every report,
--    violating schema-contract: "Reporter identity is not public."
--
-- 4. availability_flags_select_public: drop and replace. Two problems in the
--    previous approach:
--    a) RLS subquery against users ran under caller RLS — anon role sees zero
--       users rows (users_select_own requires auth.uid() = id; anon has no uid),
--       so not exists(...) was always true, passing shadowbanned reporters silently.
--    b) reporter_id was still reachable via the base table; the security_invoker
--       view only helps if callers are forced to use it.
--    Fix: security-definer view (default PostgreSQL view behavior — runs as owner
--    who has unrestricted users visibility) with inline expiry + shadowban filter.
--    Direct SELECT on the base table revoked from anon and authenticated.

-- ─── 1. users: drop unconstrained self-update policy ──────────────────────────
drop policy if exists "users_update_own" on users;

-- ─── 2. locations: drop any-auth-user update policy ──────────────────────────
drop policy if exists "locations_update_auth" on locations;

-- ─── 3. reports: restrict select to own rows only ─────────────────────────────
drop policy if exists "reports_select_public" on reports;

create policy "reports_select_own"
  on reports for select
  using (auth.uid() = user_id);

-- ─── 4. availability_flags: security-definer view + revoke base table access ──
drop policy if exists "availability_flags_select_public" on availability_flags;
drop policy if exists "availability_flags_select_active" on availability_flags;

-- Defense-in-depth row filter for any role that does reach the base table
-- (e.g., future grants, authenticated queries through service paths).
-- Shadowban is NOT checked here — caller RLS hides users rows for anon,
-- making a subquery unreliable. Shadowban enforcement lives in the view below.
create policy "availability_flags_select_active"
  on availability_flags for select
  using (expires_at > now());

-- Security-definer view (no security_invoker option = default owner context).
-- Runs as the view owner, who has full users table visibility regardless of
-- caller RLS. Applies both expiry and shadowban filters, and excludes reporter_id.
drop view if exists availability_flags_public;

create view availability_flags_public as
  select f.id, f.location_id, f.type, f.created_at, f.expires_at
  from availability_flags f
  where f.expires_at > now()
    and not exists (
      select 1 from users u
      where u.id = f.reporter_id
        and u.shadowban_status = true
    );

comment on view availability_flags_public is
  'Public read path for active, non-shadowbanned availability flags. '
  'Excludes reporter_id. Security-definer so shadowban subquery has full users '
  'visibility independent of caller RLS. Client code must use this view.';

-- Revoke direct base-table SELECT from public-facing roles so reporter_id
-- cannot be accessed by querying availability_flags directly.
revoke select on availability_flags from anon;
revoke select on availability_flags from authenticated;

-- Grant SELECT on the sanitized view to public-facing roles.
grant select on availability_flags_public to anon;
grant select on availability_flags_public to authenticated;
