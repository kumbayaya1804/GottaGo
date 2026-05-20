## Codex Review - supabase/migrations/20260519030000_fix_rls.sql

**VERDICT: APPROVE**

### Findings
- None.

### Open Questions
- None that affect merge safety.

### Verification
- Read `.claude/codex-prompt-latest.md` first, then inspected `supabase/migrations/20260519030000_fix_rls.sql` from disk.
- Compared the migration against the baseline policies in `supabase/migrations/20260519010000_remote_schema.sql`, specifically `users_select_own`, `reports_select_public`, `reports_service_all`, `availability_flags_select_public`, and `availability_flags_service_all`.
- Reviewed Antigravity v2 artifact at `.claude/antigravity-review-latest.md`; Antigravity also returned APPROVE.
- Checked current official docs for the relevant RLS/view behavior:
  - Supabase RLS docs: views bypass RLS by default because they are usually created by `postgres`, and `security_invoker = true` makes views obey underlying RLS for `anon`/`authenticated`.
  - PostgreSQL `CREATE VIEW`: default view access to underlying relations uses the view owner's permissions; `security_invoker = true` switches that to the invoking user.
  - PostgreSQL `CREATE POLICY`: policy expressions run with the rights of the user running the query, while views use the view owner's rights unless `security_invoker` is set.
- Ran `SUPABASE_TELEMETRY_DISABLED=1 supabase.cmd --version` - CLI version 2.100.1.
- Ran `SUPABASE_TELEMETRY_DISABLED=1 supabase.cmd db lint --local` - blocked because no local Postgres is running at `127.0.0.1:54322`.
- Ran `git diff --check -- supabase/migrations/20260519030000_fix_rls.sql .claude/codex-prompt-latest.md` - passed with only Git line-ending normalization warnings.
- Ran trailing-whitespace scan on the migration and prompt - no matches.
- Ran targeted search confirming the migration contains the expected `availability_flags_public` view, base-table SELECT revokes, sanitized view grants, and replacement policies.

### Approved
- The v2 `availability_flags_public` view resolves the previous shadowban-filter blocker. Because it is not `security_invoker`, PostgreSQL evaluates underlying relation permissions and RLS using the view owner's context, so the `users` lookup is not subject to the caller's `users_select_own` visibility hole.
- The v2 revoke/grant pattern resolves the previous base-table reporter leak for `availability_flags`: direct SELECT is revoked from `anon` and `authenticated`, while those roles receive SELECT only on the sanitized `availability_flags_public` view that omits `reporter_id`.
- Keeping `availability_flags_select_active` as expiry-only defense in depth does not create a current public-read gap because public-facing roles no longer have direct base-table SELECT. The view remains the enforced public path for expiry plus shadowban filtering.
- Dropping `users_update_own` remains correct; profile edits should wait for a constrained RPC rather than allowing direct mutation of trust, shadowban, or admin fields.
- Dropping `locations_update_auth` remains correct; authenticated clients should not directly update arbitrary location rows.
- `reports_select_own` correctly removes public reporter exposure, and the remaining `reports_service_all` policy covers service-role reads.

### Non-Blocking Follow-Up
- Add real anon/authenticated database tests when a local or linked Supabase test path is available. Minimum assertions: anon can select from `availability_flags_public`, anon cannot select `reporter_id` from `availability_flags`, expired flags are hidden, and flags from shadowbanned reporters are hidden.
- Future grants on `availability_flags` must not reintroduce public direct table SELECT unless column-level permissions or an equivalent privacy-preserving path is added.
