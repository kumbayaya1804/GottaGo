# Antigravity Review Request — Phase 1.5 Plans Round 2

## Context

Project: Gotta Go — crowdsourced bathroom finder (React Native / Expo / Supabase / PostGIS / Mapbox)
Review scope: Documentation only — two PLAN.md execution plan files. No TypeScript, no migrations, no RLS.
Model: You are Antigravity (Gemini 3.5). You are the senior architect and lead auditor.

These plans define the design contract all Phase 2–8 implementation phases will implement against. When executed, they produce three markdown docs in `docs/design/` (flows, wireframes, design system). Your findings here will constrain every future implementation review.

---

## Your Role and Priorities

Read `ANTIGRAVITY.md` before reviewing. Your domain and priority order:

1. Architectural correctness — does the specified design produce sound system behavior?
2. Data integrity — will the specified RPC contracts produce safe, idempotent data writes?
3. Server enforcement — are security and filtering constraints specified at the correct layer (RPC, not client)?
4. Schema alignment — do the plans reference fields and behaviors consistent with the live DB?
5. GPS and trust logic — are GPS verification thresholds, trust constraints, and family mode correctly specified?

Verdict thresholds (read `docs/review-severity.md`):
- **BLOCK**: Architectural defect, data integrity violation, or server-enforcement gap that would cause production harm if implemented as specified.
- **REQUEST CHANGES**: Logic error, schema misalignment, or missing server-enforcement rule that creates meaningful risk.
- **APPROVE**: Inspected and ready. Non-blocking notes are permitted.

Do not approve based on intent. Read the actual files from disk.

---

## Required Reading (in this order)

1. `ANTIGRAVITY.md` — your operating instructions
2. `docs/review-severity.md` — verdict definitions
3. `SPEC.md` — product scope, GPS verification, trust/confidence, shadowban, gamification
4. `docs/schema-contract.md` — DB fields, RLS rules, migration review checklist
5. `supabase/migrations/20260519010000_remote_schema.sql` — live schema
6. `.planning/phases/01.5-ux-foundation-design-system/01-5-CONTEXT.md` — locked UX decisions
7. `.planning/phases/01.5-ux-foundation-design-system/01.5-REVIEW.md` — GSD findings already resolved

Then read the files under review:
- `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md`
- `.planning/phases/01.5-ux-foundation-design-system/01.5-02-PLAN.md`

---

## Prior Review History

### GSD Review — REQUEST CHANGES → resolved (committed 7ed06ba)
- RC-01: wave: 2 in Plan 02 frontmatter ✓
- RC-02: duplicate_location report type mapping + Phase 7 migration note ✓
- RC-03: has_changing_table tag derivation note ✓

### Antigravity Round 1 — APPROVE
No issues. Non-blocking concerns:
- Duplicate Location schema migration deferred to Phase 7
- changing_surface_cleanliness column deferred to Phase 8
- Phase 5 must test ERR-02 GPS accuracy guidance and disabled button state

### Codex Round 1 — REQUEST CHANGES → resolved (committed bf507d3)
Three MAJOR findings fixed:

**MAJOR-1** (01.5-02-PLAN.md §20): Checklist missing Security & Server Enforcement group
Fix: 13th checklist group added — access-code gating, family_mode/access_sensitivity RPC enforcement, no client-side suppression gates, no PII logging, public-result server filtering.

**MAJOR-2** (01.5-01-PLAN.md wireframes 16/19/21): Inconsistent modal routes
Fix: Canonicalized to /modals/verify, /modals/report, /modals/rating.

**MAJOR-3** (01.5-01-PLAN.md Flow 10): submit_location RPC contract ambiguous
Fix: First call is check-only (returns {status, duplicate_candidate?}, no insert). Continue branch calls with confirm_duplicate: true to perform insert. Server contract note appended below Flow 10.

---

## Your Verification Focus

### Priority 1 — submit_location server contract (MAJOR-3, your domain)

This is your highest priority because it directly affects data integrity.

Verify on disk:
- Does Flow 10 in Plan 01 clearly differentiate the check call (no insert) from the confirmation call (confirm_duplicate: true)?
- Is the "Continue" branch idempotent — is there any path through the flow that could produce two submissions for one user action?
- Does the server contract note correctly specify the two-call protocol?
- Are there any edge cases in the flow (e.g., GPS timeout between calls, network retry) that the contract does not address and should?

### Priority 2 — Security & Server Enforcement checklist (MAJOR-1, architectural layer correctness)

Verify on disk:
- Is the Security & Server Enforcement group present in Plan 02 §20?
- Do the 5 items correctly target the server/RPC layer (not client-side)?
- Do they carry forward T-1.5-04 (family_mode/access_sensitivity RPC-only) and T-1.5-05 (access code absent from unauthenticated payload) from the plan's own threat model?
- Is any architectural enforcement rule missing that would allow a server-enforcement gap through future phase reviews?

### Priority 3 — Route canonicalization (MAJOR-2, lower priority for your domain)

Verify on disk:
- Do wireframes 16, 19, 21 in Plan 01 now use /modals/verify, /modals/report, /modals/rating?
- Are there any remaining /verify, /report, or /rate references in either plan?

### Secondary — New issues or remaining gaps

Flag anything not addressed in Round 1 that affects architectural soundness, data integrity, or server-enforcement correctness.

---

## Output Format

## Antigravity Review - Phase 1.5 Execution Plans Round 2 (01.5-01 + 01.5-02)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Issues
- [CRITICAL/MAJOR/MINOR] file:line — Description. Architectural impact. Required fix.

### Concerns
Non-blocking notes for implementing phases.

### Verification
Files read. Targeted checks performed. What was not checked and why.

### Approved
What is architecturally sound and ready to proceed.
