## Codex Review - Phase 1.5 Round 4 (01.5-01 Flow 10 server contract targeted)

**VERDICT: APPROVE**

### Findings

- None.

### Verification

- Read `.claude/codex-prompt-latest.md`.
- Read `docs/review-severity.md`.
- Read `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md`, focused on Flow 10 and the server contract note around lines 127-130.
- Ran targeted `rg` inspections for `Flow 10`, `Server contract`, `submission_id`, `submit_location`, `confirm_duplicate`, `duplicate_candidate`, `idempotent`, `retry`, `double`, and `replay`.
- No code tests, typecheck, lint, or Supabase live checks were run because this review scope is documentation-only and targets a planned RPC contract.

### Approved

- The Round 3 idempotency finding is resolved: the server contract now requires a client-generated `submission_id` UUID when the user enters Submit Step 1 and requires that `submission_id` on every `submit_location` call.
- The RPC idempotency guarantee is explicit: repeat calls with the same `submission_id` return the existing `{ status: 'success', location_id }` without creating a new row.
- The default happy path is correct: when no duplicate is found, the first `submit_location` call inserts and returns `{ status: 'success', location_id }`.
- The duplicate-candidate path is correct: when a duplicate is found, the default call does not insert and returns `{ status: 'duplicate_candidate', candidate: { id, name, address } }`.
- The confirm path is now retry-safe: `confirm_duplicate: true` skips duplicate checking but upserts by `submission_id` rather than inserting unconditionally, covering double-taps, retries, and network replays.
