# Codex Review Request — Gotta Go / Phase 1.5 Plans

## Your Role

Read `CODEX.md` from the project root before reviewing. Summary:
- You are the senior implementation-quality reviewer for Gotta Go.
- Review actual files from disk — do not approve based on intent.
- Priorities: security → data integrity → GPS correctness → abuse resistance → RLS → user-visible correctness → test coverage → maintainability.
- BLOCK: security/privacy/data-integrity/production-breaking defects.
- REQUEST CHANGES: logic errors, missing tests, incomplete error handling, significant maintainability risk.
- APPROVE: inspected and ready, only non-blocking notes remain.

Read `docs/review-severity.md` for verdict definitions and project-specific BLOCK/REQUEST CHANGES examples.

---

## What You Are Reviewing

**Phase 1.5: UX Foundation & Design System** — documentation only, no code.

These are execution plan files (PLAN.md). They define the design contract that all Phase 2–8 client-facing implementation phases will implement against. No TypeScript, no migrations, no RLS. The output when executed will be three markdown docs in `docs/design/`.

**Files in scope (from `.claude/review-queue.txt`):**
- `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md` — Flows + Wireframes plan
- `.planning/phases/01.5-ux-foundation-design-system/01.5-02-PLAN.md` — Design System plan

**Context files to read from disk:**
- `CODEX.md` — your operating instructions
- `docs/review-severity.md` — verdict definitions
- `SPEC.md` — product scope and user flows
- `docs/schema-contract.md` — DB field names, RLS rules (read for schema alignment)
- `supabase/migrations/20260519010000_remote_schema.sql` — live schema (ratings and reports tables especially)
- `.planning/phases/01.5-ux-foundation-design-system/01-5-CONTEXT.md` — locked UX decisions these plans must honor
- `.planning/phases/01.5-ux-foundation-design-system/01.5-REVIEW.md` — GSD review findings already resolved

---

## Prior Review Results

### GSD Review — REQUEST CHANGES (resolved, committed 7ed06ba)

Three findings, all fixed:
- **RC-01**: `wave: 1` → `wave: 2` in Plan 02 frontmatter (dependency conflict)
- **RC-02**: "Duplicate Location" report type not in live `reports.report_type` CHECK constraint — mapping table + Phase 7 migration note added to Plan 01
- **RC-03**: `has_changing_table` stored in `tags` table (not a `locations` column) — derivation note added to Plan 01 Wireframe 21 and Plan 02 Section 13

### Antigravity Review — APPROVE

No issues. Concerns (non-blocking):
- Duplicate Location schema migration noted for Phase 7
- `changing_surface_cleanliness` column needed for Phase 8 ratings table
- Phase 5 must test ERR-02 GPS accuracy guidance + button disabled state

All locked CONTEXT.md decisions verified correct:
- Emergency FAB single-tap (no expand), mode chips inside sheet ✓
- GPS consent gated to OS dialog `granted` resolution ✓
- Pending pin: server-side JOIN on `submissions.submitter_id` only ✓
- Family mode: RPC layer only, client-side JS filter forbidden ✓
- ERR-09 copy: intentionally generic, no rejection reason revealed ✓
- WCAG 2.1 AA contrast verified, textPrimary on yellow/orange ✓

---

## Your Review Focus

These are planning documents, so focus on:

1. **Security and privacy specification correctness** — Are any of the planned UX flows or design rules incorrectly specified in a way that would lead to security/privacy defects when implemented? Examples: access code visible to unauthenticated users, GPS consent written before OS dialog, family mode checked client-side.

2. **Schema alignment** — Does the design spec reference schema fields or behaviors inconsistent with the live DB? (Cross-reference `docs/schema-contract.md` and the live migrations)

3. **Component Acceptance Checklist (Plan 02 Section 20)** — Is the checklist complete and correct as a pre-review gate for all Phase 2+ UI screens? Any missing items that would let a security or accessibility defect through?

4. **Error-state copy matrix (Plan 02 Section 15, ERR-01 through ERR-11)** — Are all 11 error states correctly specified? Any that reveal security-sensitive info, or leave users in a dead-end state?

5. **Navigation model (Plan 02 Section 16)** — Are protected routes correctly identified? Is the auth behavior safe (inline modal returning to action — not a hard redirect losing state)?

6. **Any other defects** in the planned UX flows or design system that would cause production issues when implemented.

---

## Verification Available

Phase 1.5 produces documentation only. No code to typecheck, lint, or test. Verification is:
- Read plan files and context files from disk
- Cross-reference plans against `docs/schema-contract.md` and live migrations
- Cross-reference plans against `01-5-CONTEXT.md` locked decisions
- Cross-reference plans against `SPEC.md` user flows

---

## Output Format

```md
## Codex Review - Phase 1.5 Execution Plans (01.5-01 + 01.5-02)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line — Description, impact, required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Approved
- What is correct or ready to proceed.
```

After returning your verdict, paste it into this Claude session and it will be saved to `.claude/codex-review-latest.md`.
