## Codex Review - Phase 1.5 Execution Plans (01.5-01 + 01.5-02)

**VERDICT: REQUEST CHANGES**

### Findings

- [MAJOR] `.planning/phases/01.5-ux-foundation-design-system/01.5-02-PLAN.md:1027` - The Component Acceptance Checklist omits required security/server-enforcement gates even though the plan's own threat model treats them as mitigations. The checklist currently covers visual tokens, accessibility, error states, emergency mode, loading, map pins, bottom sheets, and GPS consent, but it does not require reviewers to verify that access codes are absent from unauthenticated payloads/UI, family-mode `access_sensitivity` filtering is RPC-side only, public searches exclude deleted/shadowbanned/suppressed locations, or client code avoids logging PII/precise coordinates. Impact: Phase 2+ plans can copy this checklist and still pass review while implementing security-sensitive filtering or privacy behavior in the wrong layer. Required fix: add a `Security & Server Enforcement` checklist group that explicitly includes access-code gating, family-mode/access-sensitivity RPC enforcement, no client-side trust/shadowban/suppression gates, no PII/precise-coordinate logging, and public-result filtering expectations. This should carry forward the mitigations already named at `.planning/phases/01.5-ux-foundation-design-system/01.5-02-PLAN.md:1139` and `.planning/phases/01.5-ux-foundation-design-system/01.5-02-PLAN.md:1140`.

- [MAJOR] `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md:254` - Modal route names are inconsistent between the two plans. Plan 01 wireframes use `router.push('/verify')`, `router.push('/report')`, and `router.push('/rate')`, while Plan 02's navigation model defines `/modals/verify`, `/modals/report`, and `/modals/rating` at `.planning/phases/01.5-ux-foundation-design-system/01.5-02-PLAN.md:688` and the protected-route table at `.planning/phases/01.5-ux-foundation-design-system/01.5-02-PLAN.md:706`. Impact: the generated `flows.md`, `wireframes.md`, and `design-system.md` can disagree on canonical routes, causing Phase 2+ implementors to create or review against the wrong Expo Router paths. Required fix: choose one canonical route convention and update both plans, the wireframe index, and the navigation model to match the existing/future `app/src/app` layout.

- [MAJOR] `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md:128` - The Submit duplicate-detection flow calls `submit_location` before the duplicate decision, then calls `submit_location` again if the user chooses Continue. Impact: this is ambiguous about whether the first RPC writes a pending location or only returns a duplicate warning, and that ambiguity can become duplicate writes or a non-idempotent retry path in Phase 4. Required fix: specify the server contract explicitly, for example `submit_location` returns `duplicate_candidate` without inserting until the user confirms with a `confirm_duplicate=true` parameter, or use a separate `check_duplicate_location` RPC before the insert. The "Continue" branch must be idempotent and must not create two submissions for one user action.

### Open Questions

- None.

### Verification

- Read `.claude/codex-prompt-latest.md`.
- Read `CODEX.md`, `docs/review-severity.md`, `docs/agent-harness.md`, `docs/stale-info-scan.md`, and `.planning/stale-info-scan-latest.md`.
- Read the reviewed plan files from disk: `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md` and `.planning/phases/01.5-ux-foundation-design-system/01.5-02-PLAN.md`.
- Read context files from disk: `SPEC.md`, `docs/schema-contract.md`, `supabase/migrations/20260519010000_remote_schema.sql`, `.planning/phases/01.5-ux-foundation-design-system/01-5-CONTEXT.md`, and `.planning/phases/01.5-ux-foundation-design-system/01.5-REVIEW.md`.
- Ran targeted `rg`/PowerShell inspections for `duplicate_location`, `has_changing_table`, `changing_surface_cleanliness`, `reports.report_type`, `gps_consent`, `family_mode`, `access_sensitivity`, `submitter_id`, route names, error-state rows, and checklist items.
- No code tests, typecheck, lint, or Supabase live checks were run because this review scope is documentation-only execution plans. Local migration/schema files were inspected instead.
- Note: `.planning/stale-info-scan-latest.md` is dated 2026-05-20 with next review due 2026-06-19. I did not treat it as current evidence; schema/status claims above were checked directly against the inspected files.

### Approved

- The prior GSD findings are materially resolved: `01.5-02-PLAN.md` now uses `wave: 2`, Plan 01 documents the `duplicate_location` migration dependency, and both plans document that `has_changing_table` is derived from the `tags` table rather than a `locations` column.
- Locked Phase 1.5 context decisions are mostly preserved: GPS consent is gated on OS `granted`, emergency FAB is single-tap with mode chips in the sheet, pending pins require `submissions.submitter_id` server-side handling, ERR-09 remains generic, and access-code UI is not exposed to unauthenticated users.
- Error-state copy for ERR-01 through ERR-11 is concrete and mostly implementation-ready once the checklist/server-enforcement gaps above are fixed.
