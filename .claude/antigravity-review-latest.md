## Antigravity Review - supabase/migrations/20260519030000_fix_rls.sql (v2)

**VERDICT: APPROVE**

### Issues
- None.

### Concerns
- Mutation path: dropping users_update_own and locations_update_auth locks direct client mutations. Phase 2 SECURITY DEFINER RPCs for profile editing and trusted location updates must be prioritized.
- Service Role Bypass: service_role_all on users and locations_service_all on locations (from baseline) remain the only admin update paths until authorized RPCs exist.

### Verification
- Verified table/column names against baseline remote_schema.sql.
- availability_flags_public view uses default SECURITY DEFINER context (owner), allowing anon to filter by shadowban_status even without users row visibility. Correct.
- Expiration filter applied both in view and as defense-in-depth policy on base table.
- reporter_id excluded from public view. REVOKE SELECT forces callers through sanitized view.

### Approved
- Critical vulnerabilities (trust self-promotion, shadowban self-clearing) closed.
- Reporter identity protected at DB layer for both reports and availability_flags.
- Shadowban filtering for availability signals robust against RLS visibility holes.
