# Antigravity Review Request — Phase 1.5 Plans Round 4

## Context

Project: Gotta Go — crowdsourced bathroom finder (React Native / Expo / Supabase / PostGIS / Mapbox)
Review scope: Documentation only — single targeted fix to 01.5-01-PLAN.md Flow 10 server contract.
Model: You are Antigravity (Gemini 3.5). You are the senior architect and lead auditor.
You APPROVEd in Round 3. One more fix was made in response to Codex Round 3 REQUEST CHANGES.

---

## Your Role

Read `ANTIGRAVITY.md`. Verdict thresholds (read `docs/review-severity.md`):
- **BLOCK**: Architectural defect or data integrity violation that must not ship.
- **REQUEST CHANGES**: Logic error or missing enforcement that creates meaningful risk.
- **APPROVE**: Inspected and ready.

Read the actual file from disk.

---

## Required Reading

1. `ANTIGRAVITY.md`
2. `docs/review-severity.md`
3. `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md` — Flow 10 and server contract note (around lines 128–131)

---

## Prior Review History

- Antigravity Round 3: APPROVE
- Codex Round 3: REQUEST CHANGES — 1 MAJOR (fixed, committed de625e3)

**Codex finding:** `confirm_duplicate: true` claimed to "insert unconditionally" while also claiming idempotency — a contradiction. A double-tap, retry, or network replay could create duplicate pending submissions.

**Fix applied:**
- Client generates a `submission_id` (UUID) at Submit Step 1 entry, passed on every call.
- RPC is idempotent on `submission_id`: repeat calls return `{ status: 'success', location_id }` without inserting a new row.
- `confirm_duplicate: true` upserts by `submission_id` (not an unconditional blind insert).
- Server contract note rewritten to cover all three branches explicitly.

---

## Your Verification Focus

This is an architectural data-integrity question — your domain.

1. Is the `submission_id` idempotency pattern sound for a PostGIS/Supabase RPC context?
2. Does upsert-by-`submission_id` correctly prevent duplicate `submissions` rows under concurrent or retry conditions?
3. Is the server contract note complete and unambiguous for all three execution paths?
4. Did this fix introduce any new architectural or data-integrity risk?

---

## Output Format

## Antigravity Review - Phase 1.5 Round 4 (01.5-01 Flow 10 server contract targeted)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Issues
- [CRITICAL/MAJOR/MINOR] file:line — Description. Impact. Required fix.

### Concerns
Non-blocking notes.

### Verification
Files read. Checks performed.

### Approved
What is architecturally sound and ready to proceed.
