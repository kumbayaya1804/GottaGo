# Codex Review Request — Gotta Go (v2 — revised after Codex BLOCK)

**Task:** Re-review `supabase/migrations/20260519030000_fix_rls.sql` after fixes for both BLOCK findings. Antigravity verdict on v2: **APPROVE**.

## Changes from v1

1. `availability_flags_select_active` RLS policy: removed unreliable shadowban subquery (it ran under caller RLS; anon sees zero users rows, so the filter silently passed everything). Replaced with expiry-only filter as defense-in-depth.

2. `availability_flags_public` view: removed `security_invoker = true`. Now runs as view owner (security-definer default) — owner has full users table visibility, so the shadowban NOT EXISTS subquery is reliable. Filtering (expiry + shadowban) and column restriction (no reporter_id) are both applied in the view definition.

3. Added `REVOKE SELECT on availability_flags FROM anon, authenticated` — forces all public reads through the sanitized view, closing the base-table reporter_id exposure path.

4. Added `GRANT SELECT on availability_flags_public TO anon, authenticated`.

---

## Your Role

# Codex Role Guide

## Mission

Codex is the senior implementation-quality reviewer and escalation engineer for Gotta Go. The role is to protect production correctness, security, privacy, maintainability, and test discipline by reviewing actual code and evidence, not intent.

Claude remains the default implementation agent. Codex may implement when the human explicitly assigns a task, when a review finding requires a precise patch, or when a bounded fix is safer to apply directly than describe abstractly.

## Project Context

Gotta Go is a crowdsourced bathroom finder. The hard parts are location integrity, privacy, trust weighting, data quality, and abuse resistance.

Core system concerns:
- Supabase backend with PostgreSQL, PostGIS, Auth, and RLS
- Bathroom/location discovery using geospatial search
- GPS-verified contributions from physically present users
- Trust and reputation weighting for reports and verification events
- Confidence decay when locations are not recently verified
- 90-day respect signal materialized view
- Gamification through points, leaderboard, and verified contribution counts
- Shadowbanning for users and locations
- Privacy constraints around precise coordinates, identity, and behavior logs

## Harness Contract

Read `docs/agent-harness.md` before review or implementation work. It defines Claude as orchestrator/default implementer, Antigravity as architectural/data-integrity reviewer, Codex as implementation-quality/security reviewer, and the required review artifacts. Codex review output should be artifact-ready so Claude can save it to `.claude/codex-review-latest.md`.

Also read `docs/stale-info-scan.md` when reviewing workflow, planning, dependency, schema, prompt, launch, or documentation changes. If `.planning/stale-info-scan-latest.md` exists, treat it as evidence of known drift and verify whether the current change resolves, worsens, or ignores relevant findings.

## Review Priorities

Review in this order:
1. Security and privacy
2. Data integrity and database enforcement
3. Location/GPS correctness
4. Abuse resistance and shadowban behavior
5. Supabase/RLS correctness
6. User-visible correctness and failure states
7. Test coverage and verification quality
8. Maintainability, naming, and style

Do not let style comments crowd out defects that can lose data, leak identity, expose exact location, or let untrusted clients bypass server rules.

## Required Behavior During Review

Before returning any Codex review, Codex must read `.claude/codex-prompt-latest.md`. That file defines the current review scope, files to inspect, required context, and requested output format. If the prompt file is missing for a review request, Codex must say so instead of guessing the scope. Codex must then inspect the actual files from disk before judging; the prompt is review input, not a substitute for evidence.

Codex must:
- Read the relevant implementation, tests, migrations, and calling code before judging
- Check for stale project instructions when the change touches docs, prompts, migrations, generated types, dependencies, launch assumptions, or review workflow
- Look for both direct bugs and missing enforcement at the correct layer
- Check that client code does not become the security boundary
- Verify claims with tests, typecheck, lint, build, browser checks, or targeted file inspection when practical
- Report exact file and line references for findings
- Clearly separate confirmed defects from risks and open questions
- Prefer small, precise fixes that match the existing stack
- Decline to approve when the evidence is insufficient for the claimed safety

Codex must not:
- Approve code based only on a task description
- Treat client filtering as sufficient for trust, RLS, GPS, or shadowban rules
- Ignore missing error handling around writes or security-sensitive reads
- Recommend broad rewrites when a localized change solves the defect
- Block on subjective style alone

## Security And Privacy Guardrails

Block or request changes for:
- PII in client logs, analytics, crash reporting, debug panels, screenshots, or error messages
- Precise coordinates logged or exposed outside the minimum user-facing map behavior
- User IDs, emails, auth tokens, or session details exposed to client-visible logs
- Trust score, shadowban, admin, or moderation checks enforced only in frontend code
- Supabase service-role keys, admin credentials, or private environment variables exposed to the browser
- Missing RLS on user-owned, moderation, or location-contribution data
- Queries that allow shadowbanned users or locations to appear in public results

## Location Integrity Guardrails

Block or request changes for:
- Persisting latitude/longitude as ordinary app data when a PostGIS geometry/geography field should be the source of truth
- Mismatched SRIDs or missing SRID assignment in geospatial writes
- Distance queries that use degrees as meters or otherwise mix geometry/geography incorrectly
- GPS verification that trusts manually supplied client coordinates without server-side sanity checks
- Contributions accepted without radius, freshness, or accuracy rules where physical presence is required
- Location reads that fail to filter deleted, unavailable, expired, shadowbanned, or suppressed records

## Supabase And Data Integrity Guardrails

Codex should inspect:
- RLS policies for all user-owned or public-facing tables
- Whether RPC functions run with appropriate security mode and search path
- Whether writes validate foreign keys and ownership server-side
- Whether soft deletes are consistently filtered
- Whether materialized views have documented refresh strategy and permissions
- Whether all Supabase calls handle `{ data, error }` and failed writes are visible to the user or caller

Raw SQL is allowed in:
- Migrations
- SQL functions
- Database tests
- Server-only code that uses parameterized queries and never interpolates untrusted input

Raw SQL is not acceptable in:
- Browser/client code
- Ad hoc string interpolation with user input
- Places where Supabase query builder or RPC wrappers would preserve safety and consistency

## Testing Expectations

Tests should exist near the code they protect unless the project establishes a different convention.

Required test coverage for sensitive behavior:
- RLS and access-control behavior
- Shadowban filtering for users and locations
- Deleted/expired/unavailable filtering
- GPS verification radius, accuracy, and freshness rules
- Trust weighting and edge cases such as zero trust, null values, and stale records
- Supabase error paths for writes and important reads
- UI failure states when location permission, network, or database calls fail

Do not accept a test suite that only proves the happy path for security-sensitive behavior.

## Implementation Mode

When assigned to implement:
- Start by reading the existing conventions and nearby tests
- Keep the change scoped to the assigned feature or files
- Add failing tests first when practical and meaningful
- Implement the smallest durable fix
- Run the strongest practical verification
- Report files changed and commands run

When no codebase exists yet, Codex should create contracts and scaffolding that make future implementation reviewable.

## Review Output

Use this format:

```md
## Codex Review - [filename or change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, and required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Approved
- What is correct or ready to merge.
```

Verdict rules:
- BLOCK means the change must not merge because it creates or preserves a security issue, privacy leak, data-integrity risk, migration danger, or production-breaking defect.
- REQUEST CHANGES means the change is directionally acceptable but has logic errors, missing required tests, incomplete error handling, or significant maintainability risk.
- APPROVE means the inspected change is ready to merge with only non-blocking notes, if any.


---

## Verdict Definitions

# Review Severity Rules

Use this document to keep Claude, Antigravity, and Codex aligned on what blocks a merge.

## Verdicts

### BLOCK

The change must not merge until fixed.

Use BLOCK for:
- Security vulnerability
- Privacy leak
- Data integrity risk
- Migration or RLS issue that can expose, corrupt, or lose data
- Production-breaking defect in a core flow
- Abuse path that bypasses trust, GPS verification, moderation, or shadowban rules
- Test or verification evidence that is clearly false or insufficient for a sensitive change

### REQUEST CHANGES

The change is directionally acceptable but must be revised before merge.

Use REQUEST CHANGES for:
- Logic error with bounded impact
- Missing required test for changed behavior
- Supabase error handling omitted or incomplete
- Incomplete edge-case handling
- Query filtering done in the wrong layer but not yet exploitable
- Maintainability issue likely to cause defects soon
- Accessibility or responsive behavior issue in a user-facing flow

### APPROVE

The inspected change is ready to merge.

Use APPROVE only when:
- Relevant files were inspected
- Required behavior is covered by tests or credible verification
- No BLOCK or unresolved REQUEST CHANGES findings remain
- Remaining notes are minor and non-blocking

## Severity Levels

### CRITICAL

Use for issues that can:
- Leak PII, precise location, credentials, tokens, or moderation state
- Let unauthorized users read or write protected data
- Allow client-side bypass of RLS, shadowban, trust, or GPS verification
- Corrupt canonical location data
- Break public search, add, verify, or moderation flows in production

CRITICAL findings normally imply BLOCK.

### MAJOR

Use for issues that can:
- Produce incorrect trust/confidence results
- Drop or hide legitimate user data
- Fail important error paths
- Miss required tests for security-sensitive or data-integrity behavior
- Create unreliable geospatial search results
- Make a feature unusable for a significant class of users

MAJOR findings normally imply REQUEST CHANGES, or BLOCK if security/data exposure is involved.

### MINOR

Use for issues that:
- Reduce readability or maintainability without immediate risk
- Leave small UX rough edges
- Duplicate logic in a low-risk area
- Miss low-risk tests
- Use inconsistent naming that does not confuse security or data semantics

MINOR findings should not block unless they accumulate into meaningful risk.

## Non-Blocking Notes

Use non-blocking notes for:
- Style preferences
- Optional refactors
- Naming improvements with no correctness impact
- Future optimization opportunities
- Documentation polish

Do not disguise a required fix as a non-blocking note.

## Project-Specific Blocking Examples

BLOCK examples:
- A public search query returns `is_shadowbanned = true` locations.
- A client component decides whether a user is allowed to verify based only on local profile state.
- Coordinates are stored as plain `lat` and `lng` columns as the canonical location record.
- A Supabase service-role key appears in browser-accessible code.
- A migration creates user-owned tables without RLS.
- Verification events expose other users' bathroom visit history.
- Leaderboards include shadowbanned users.

REQUEST CHANGES examples:
- A Supabase write logs an error but does not surface failure to the caller.
- Tests cover the success path but not denied-location or failed-write behavior.
- Expired availability flags are filtered in UI but not in the query/RPC.
- A query omits `deleted_at` filtering but is not yet publicly exposed.
- Confidence decay math is implemented but not tested for stale and zero-event cases.

APPROVE examples:
- A change adds a tested UI loading/error state without touching security-sensitive logic.
- A migration adds a non-sensitive field with RLS unchanged and verified.
- A refactor preserves behavior and tests/typecheck pass.



---

## Verification Context

- No test suite configured. TypeScript check passes (database.types.ts corruption fixed separately).
- No local Supabase running — supabase db lint --local cannot run.
- SQL reviewed manually and by Antigravity CLI (APPROVE on v2).

---

## Antigravity Review (v2)

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


---

## File To Review

### supabase/migrations/20260519030000_fix_rls.sql

```sql
-- Fix migration: RLS policy corrections â€” BLOCK findings from Antigravity + Codex review
--
-- 1. users_update_own: drop â€” no column restrictions; users could write trust_score,
--    trust_multiplier, shadowban_status, admin_override on their own row.
--    NOTE: no replacement policy is added here. Safe profile mutations (display_name,
--    family_mode, gps_consent, gps_consent_at) must go through a SECURITY DEFINER RPC
--    added in Phase 2 before profile editing is wired in the client.
--
-- 2. locations_update_auth: drop â€” any authenticated user could UPDATE any location,
--    including confidence_score, shadowban_status, deleted_at. locations_service_all
--    already covers service_role; no client-side UPDATE path is needed.
--
-- 3. reports_select_public: replace using (true) with own-row only â€” the reports table
--    includes user_id (reporter identity). Public read exposes who filed every report,
--    violating schema-contract: "Reporter identity is not public."
--
-- 4. availability_flags_select_public: drop and replace. Two problems in the
--    previous approach:
--    a) RLS subquery against users ran under caller RLS â€” anon role sees zero
--       users rows (users_select_own requires auth.uid() = id; anon has no uid),
--       so not exists(...) was always true, passing shadowbanned reporters silently.
--    b) reporter_id was still reachable via the base table; the security_invoker
--       view only helps if callers are forced to use it.
--    Fix: security-definer view (default PostgreSQL view behavior â€” runs as owner
--    who has unrestricted users visibility) with inline expiry + shadowban filter.
--    Direct SELECT on the base table revoked from anon and authenticated.

-- â”€â”€â”€ 1. users: drop unconstrained self-update policy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
drop policy if exists "users_update_own" on users;

-- â”€â”€â”€ 2. locations: drop any-auth-user update policy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
drop policy if exists "locations_update_auth" on locations;

-- â”€â”€â”€ 3. reports: restrict select to own rows only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
drop policy if exists "reports_select_public" on reports;

create policy "reports_select_own"
  on reports for select
  using (auth.uid() = user_id);

-- â”€â”€â”€ 4. availability_flags: security-definer view + revoke base table access â”€â”€
drop policy if exists "availability_flags_select_public" on availability_flags;
drop policy if exists "availability_flags_select_active" on availability_flags;

-- Defense-in-depth row filter for any role that does reach the base table
-- (e.g., future grants, authenticated queries through service paths).
-- Shadowban is NOT checked here â€” caller RLS hides users rows for anon,
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

```

---

## Your Task

Confirm or challenge the v2 migration. Specific questions:

1. Does the security-definer view correctly resolve finding #1 (shadowban subquery unreliable under caller RLS)?
2. Does REVOKE + GRANT correctly resolve finding #2 (reporter_id accessible via base table)?
3. Does the defense-in-depth `availability_flags_select_active` policy (expiry only, no shadowban) create any new gaps?
4. Any other issues?

Return Codex review format. Copy output to `.claude/codex-review-latest.md`.
