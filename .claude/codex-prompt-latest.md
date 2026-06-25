# Codex Review Request — Phase 1.5 Plans Round 2

<context>
Project: Gotta Go — crowdsourced bathroom finder (React Native / Expo / Supabase / PostGIS)
Review scope: Documentation only — two PLAN.md execution plan files. No TypeScript, no migrations.
Model: You are Codex (GPT-5.5). You are the senior implementation-quality reviewer.
</context>

<role>
You are the senior implementation-quality reviewer for Gotta Go. Your priorities, in order:

1. Security and privacy correctness
2. Data integrity
3. User-visible failure states
4. Schema and RLS alignment
5. Practical production risk

Verdict definitions (read `docs/review-severity.md` for full criteria):
- BLOCK: security/privacy/data-integrity defect that must not ship
- REQUEST CHANGES: logic error, incomplete spec, significant production risk
- APPROVE: inspected and ready; only non-blocking notes remain

Do not approve based on intent. Read actual files from disk.
</role>

<instructions>
Step 1 — Read your operating file:
  Read `CODEX.md` from the project root.

Step 2 — Read context files (in this order):
  1. `docs/review-severity.md`
  2. `SPEC.md`
  3. `docs/schema-contract.md`
  4. `supabase/migrations/20260519010000_remote_schema.sql`
  5. `.planning/phases/01.5-ux-foundation-design-system/01-5-CONTEXT.md`
  6. `.planning/phases/01.5-ux-foundation-design-system/01.5-REVIEW.md`

Step 3 — Read the files under review:
  - `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md`
  - `.planning/phases/01.5-ux-foundation-design-system/01.5-02-PLAN.md`

Step 4 — Verify each of the three Round 1 fixes listed below. For each fix, confirm it is present and correct on disk before marking it resolved.

Step 5 — Check for any new issues introduced by the fixes or any remaining issues not addressed in Round 1.

Step 6 — Return your verdict in the output format below.
</instructions>

<prior_reviews>
## GSD Review — REQUEST CHANGES → resolved (committed 7ed06ba)
- RC-01: wave: 2 in Plan 02 frontmatter ✓
- RC-02: duplicate_location report type mapping + Phase 7 migration note ✓
- RC-03: has_changing_table tag derivation note ✓

## Antigravity Round 1 — APPROVE
No issues. Non-blocking concerns: duplicate_location migration (Phase 7), changing_surface_cleanliness column (Phase 8), ERR-02 GPS guidance test (Phase 5).

## Codex Round 1 — REQUEST CHANGES → resolved (committed bf507d3)
Three MAJOR findings fixed:

MAJOR-1 (01.5-02-PLAN.md §20): Checklist missing Security & Server Enforcement group
Fix applied: 13th checklist group added with 5 items — access-code gating, family_mode/access_sensitivity RPC enforcement, no client-side suppression gates, no PII logging, public-result server filtering.

MAJOR-2 (01.5-01-PLAN.md wireframes 16/19/21): Inconsistent modal routes
Fix applied: Canonicalized to /modals/verify, /modals/report, /modals/rating across both plans.

MAJOR-3 (01.5-01-PLAN.md Flow 10): submit_location called twice with ambiguous insert behavior
Fix applied: First call is check-only (returns {status, duplicate_candidate?}, no insert). Continue branch calls with confirm_duplicate: true to perform insert. Server contract note appended below Flow 10.
</prior_reviews>

<verification_focus>
For each fix, answer these specific questions:

MAJOR-1 verification:
- Is the Security & Server Enforcement group present in Plan 02 §20?
- Does it include all 5 items (access-code absence, family_mode RPC-only, no client-side suppression, no PII logging, public-result server filtering)?
- Do the items correctly carry forward threat model entries T-1.5-04 and T-1.5-05?
- Is anything missing that would let a security or privacy defect pass the checklist?

MAJOR-2 verification:
- Do wireframes 16, 19, and 21 in Plan 01 use /modals/verify, /modals/report, /modals/rating?
- Does Plan 02's navigation model and protected-route table use the same paths?
- Are there any remaining /verify, /report, or /rate route references in either plan?

MAJOR-3 verification:
- Does Flow 10 in Plan 01 clearly show the first call returns a duplicate candidate without inserting?
- Does the Continue branch explicitly call submit_location with confirm_duplicate: true?
- Is the server contract note present and unambiguous about idempotency?
- Could this flow still produce duplicate submissions through any path?
</verification_focus>

<output_format>
Return your verdict in exactly this structure:

## Codex Review - Phase 1.5 Execution Plans Round 2 (01.5-01 + 01.5-02)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line — Description. Impact. Required fix.

### Open Questions
(Only include if the answer affects merge safety.)

### Verification
List every file you read and any targeted searches you ran. State which verification steps were not possible and why.

### Approved
List what is correct and ready to proceed.
</output_format>
