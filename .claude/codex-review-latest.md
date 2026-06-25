## Codex Review - Phase 1.5 Round 3 (01.5-01 Flow 10 targeted)

**VERDICT: REQUEST CHANGES**

### Findings

- [MAJOR] `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md:130` - The rewritten server contract says `confirm_duplicate: true` "bypasses the duplicate check and inserts unconditionally" while also claiming "the duplicate-confirm path is idempotent." Those two requirements conflict unless the RPC contract includes an idempotency key, deterministic submission identity, unique constraint, or retry-safe upsert behavior for the duplicate-confirm call. Impact: a double tap, client retry, or network replay after the user chooses Continue can create multiple pending submissions for one user action, which is exactly the data-integrity risk Flow 10 is supposed to avoid. Required fix: make the duplicate-confirm contract explicitly idempotent, for example by requiring a client-generated `submission_id`/idempotency key reused across retries or by defining a server-side unique constraint/upsert that returns the existing `{ status: 'success', location_id }` for repeat confirm attempts.

### Verification

- Read `.claude/codex-prompt-latest.md`.
- Read `docs/review-severity.md`.
- Read `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md`, focused on Flow 10 and the server contract note around lines 127-130.
- Ran targeted `rg` inspections for `Flow 10`, `submit_location`, `confirm_duplicate`, `duplicate_candidate`, `unconditionally`, and `idempotent`.
- No code tests, typecheck, lint, or Supabase live checks were run because this review scope is documentation-only and targets a planned RPC contract.

### Approved

- The original Antigravity Round 2 happy-path issue is resolved: the default `submit_location` call now inserts and returns `{ status: 'success', location_id }` when no duplicate is found.
- The duplicate-candidate branch is clear that the default call does not insert when a duplicate is found and returns `{ status: 'duplicate_candidate', candidate: { id, name, address } }`.
- The Continue branch is clear that it calls `submit_location` with `confirm_duplicate: true`.
