# Codex Review Request — Gotta Go / Phase 1.5 Plans (Round 2)

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

### Codex Review Round 1 — REQUEST CHANGES (resolved, committed bf507d3)

Three MAJOR findings, all fixed:

- **MAJOR-1** (`01.5-02-PLAN.md` §20 checklist): Missing Security & Server Enforcement checklist group — **Fixed:** Added 13th checklist group at §20 with 5 items covering access-code absence for unauthenticated users (T-1.5-05), `access_sensitivity`/`family_mode` RPC-only enforcement (T-1.5-04), no client-side suppression/shadowban gates, no PII/precise-coordinate logging, and public-result filtering expectations.

- **MAJOR-2** (`01.5-01-PLAN.md` wireframes): Inconsistent modal route names between the two plans — **Fixed:** Canonicalized Plan 01 wireframe routes to `/modals/verify`, `/modals/report`, `/modals/rating` matching Plan 02's navigation model and protected-route table.

- **MAJOR-3** (`01.5-01-PLAN.md` Flow 10): `submit_location` RPC called twice with ambiguous insert behavior — **Fixed:** Flow 10 now explicitly states the first call is check-only (no insert; returns `{status, duplicate_candidate?}`); the Continue branch calls with `confirm_duplicate: true` to perform the insert. A server contract note is appended below the flow.

---

## Your Review Focus

**Primary:** Verify the three Round 1 fixes are correctly resolved. Read the actual file content on disk — do not assume the fixes are correct based on the descriptions above.

1. **Security & Server Enforcement checklist (Plan 02 §20)** — Is the new 13th checklist group present? Are all 5 items correct, complete, and non-redundant with other groups? Do they actually carry forward mitigations T-1.5-04 and T-1.5-05 from the threat model at the bottom of the plan?

2. **Modal route canonicalization (Plan 01 wireframes 16, 19, 21)** — Do the wireframe routes now match `/modals/verify`, `/modals/report`, `/modals/rating`? Does Plan 02's navigation model and protected-route table use the same canonical paths? Are there any remaining references to the old `/verify`, `/report`, `/rate` routes in either plan?

3. **submit_location server contract (Plan 01 Flow 10)** — Is the flow now unambiguous? Does the server contract note correctly specify the two-call protocol (`confirm_duplicate: true` for the second call)? Is the "Continue" branch idempotent (no double-insert risk)?

**Secondary:** Any new issues introduced by the fixes, or any remaining issues not addressed in Round 1.

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
## Codex Review - Phase 1.5 Execution Plans Round 2 (01.5-01 + 01.5-02)

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
