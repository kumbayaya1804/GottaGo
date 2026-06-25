## Antigravity Review - Phase 1.5 Execution Plans Round 2 (01.5-01 + 01.5-02)

**VERDICT: REQUEST CHANGES**

### Issues
- [MAJOR] [.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md:128-130](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md#L128-L130) — Logical Contradiction in `submit_location` Flow 10. The flow diagram states that the first call to `submit_location` is check-only (no insert) and returns `{status, duplicate_candidate?}`. On the `|No|` branch (no duplicate candidate), the user goes straight to the "Submit Success Screen" without any further RPC call. If implemented literally, this means a location that does not trigger duplicate warnings will never actually be inserted into the database.
  *Required Fix*: Clarify the RPC contract such that:
    1. A default call to `submit_location` (without `confirm_duplicate: true`) automatically performs the database insert if no duplicate is found and returns `{ status: 'success', location_id }`. If a duplicate is found, it does *not* insert and returns `{ status: 'duplicate_candidate', candidate: ... }`.
    2. A call with `confirm_duplicate: true` bypasses the duplicate check, performs the insert, and returns `{ status: 'success', location_id }`.

### Concerns
- **Phase 7 and 8 Database Schema Dependencies**: The plan correctly references the need to add `duplicate_location` to `reports.report_type` CHECK constraints in Phase 7 and `changing_surface_cleanliness` to `ratings` in Phase 8. Implementing teams must ensure migrations are run before these fields/types are used in RPCs or queries.

### Verification
- Checked GSD-resolved issues: wave 2 sequencing verified in `01.5-02-PLAN.md` frontmatter, duplicate location mappings, and changing table tag derivation.
- Audited the newly added `Security & Server Enforcement` group in the checklist (Plan 02 §20), verifying coverage for access code gating (T-1.5-05), server-side family mode (T-1.5-04), shadowban/suppression RPC filters, and PII/GPS logging safety.
- Verified route canonicalization for modals (now consistently `/modals/verify`, `/modals/report`, and `/modals/rating` across wireframes and index).

### Approved
- **Checklist Security Reinforcements**: The addition of the "Security & Server Enforcement" group to the pre-review Component Acceptance Checklist provides a strong defensive boundary against client-side safety bypasses in future phases.
- **Modal Path Standardization**: Route canonicalization eliminates navigational ambiguity for modal dialog triggers.
