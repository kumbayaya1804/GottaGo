## Antigravity Review - Phase 1 Migration 000002 Re-Review (2026-06-24)

**VERDICT: APPROVE**

---

### Issues

None. All three prior findings are fully resolved. No new issues introduced.

---

### Verification

**MAJOR (000000:37) — `revoke select on ratings from authenticated` missing**
- `000002` line 14: `revoke select on ratings from authenticated;` — present, correct, and placed as the first statement in the migration before any function work. The authentication bypass gap is closed.
- Authenticated users can no longer reach `user_id` via the base `ratings` table. Own-row access remains intact via `ratings_select_own` (RLS, for service-role paths). Aggregate access remains via `ratings_public` view (no `user_id` column). The full privacy chain is now correct.

**MINOR (000000:99,126) — `get_locations_in_radius` implicit SRID**
- ST_DWithin call: `000002` line 41 uses `st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography` — explicit SRID, consistent with `000001` WR-01 documented pattern.
- KNN ordering operator: `000002` line 67 uses `st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography` — same explicit-SRID pattern applied to the `<->` ordering expression.
- Both occurrences that were flagged in `000000` are corrected.

**MINOR (000000:155) — `count_locations_within` implicit SRID**
- `000002` line 95 uses `st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography` — explicit SRID applied.
- Argument order in `ST_MakePoint(p_lon, p_lat)` is correct: PostGIS convention is (x=lon, y=lat).

**Grants re-application**
- `get_locations_in_radius`: `anon` and `authenticated` re-granted at lines 70–75. Argument type list (10 params: `numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean`) matches the function signature exactly.
- `count_locations_within`: `anon` and `authenticated` re-granted at lines 100–101. Argument type list (3 params: `numeric, numeric, numeric`) matches the function signature exactly.
- `create or replace function` does not preserve existing grants. The explicit re-grant is required and correctly present in both cases.

**Security posture check — no regression**
- `security definer` retained on both functions — intentional server-side execution with no RLS bypass concern here.
- `set search_path = public` retained on both functions — search-path injection surface unchanged from `000000`.
- `stable` volatility marker retained on both functions — correct; neither function mutates data.
- `ratings_select_own` policy (created in `000000`) is not touched — correct; it was not broken and remains available for service-role paths.
- `ratings_public` view and its grants (from `000000`) are not touched — correct.
- No new tables, policies, or views introduced. Migration is a clean surgical fix targeting only the three prior findings.

---

### Approved

- **Privacy fix (MAJOR resolved)**: Rater identity (`user_id`) is now fully inaccessible to both `anon` and `authenticated` roles via the base `ratings` table. The `ratings_select_own` RLS policy and the `ratings_public` aggregate view remain intact and correctly scoped.
- **PostGIS SRID consistency (both MINORs resolved)**: Both `get_locations_in_radius` (ST_DWithin + KNN `<->`) and `count_locations_within` now use `ST_SetSRID(ST_MakePoint(...), 4326)::geography`, consistent with the explicit-SRID pattern documented in migration `000001` WR-01.
- **Grant hygiene**: All function grants are correctly re-applied after `create or replace`. No role is left without execute permission.
- **Idempotent-safe**: `create or replace function` makes re-application safe. The `revoke` on `authenticated` is a no-op if already revoked in a prior session.

This migration is approved for commit.

---

*Reviewed by Antigravity — 2026-06-24*
*Re-review of `20260624000002_ratings_privacy_fix.sql` addressing REQUEST CHANGES from prior review of `20260624000000_block_fixes.sql`*
