# Add caller-role access tests for the Phase 5 discovery and verification RPCs

Created: 2026-10-09 from a Codex follow-up note (skills-restructure review, attempt 3).

`supabase/tests/phase5_discovery.test.sql:86,209` and `supabase/tests/phase5_verify_publish.test.sql:102` set
`request.jwt.claims` but never `SET ROLE`, so they run as `postgres`. Discovery's "anonymous" assertion tests the
function body, not the denied `anon` EXECUTE path. Add single-session tests that `SET LOCAL ROLE anon` /
`authenticated` with matching claims and assert: `anon` is denied EXECUTE on `search_pending_submissions_nearby`,
`verify_location`, and the publication RPCs; `authenticated` is allowed. Follows the `pgtap-testing` skill rule
that concurrency races are not access-control proof. Full tier (supabase/tests); run via the isolated runner.
