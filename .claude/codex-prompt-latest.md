# Codex Review Request — Phase 1.5 Plans Round 4

<context>
Project: Gotta Go — crowdsourced bathroom finder (React Native / Expo / Supabase / PostGIS)
Review scope: Documentation only — single targeted fix to 01.5-01-PLAN.md Flow 10 server contract.
Model: You are Codex (GPT-5.5). You are the senior implementation-quality reviewer.
This is a targeted re-review of one fix only. You APPROVEd everything else in Round 2.
</context>

<role>
Senior implementation-quality reviewer. APPROVE unless the fix left the original issue unresolved or introduced a new defect. Read the actual file from disk.

Verdict thresholds (read `docs/review-severity.md`):
- BLOCK: defect that must not ship
- REQUEST CHANGES: unresolved issue or new production risk
- APPROVE: ready; non-blocking notes permitted
</role>

<instructions>
Step 1 — Read: `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md`, Flow 10 and the server contract note (around lines 128–131).

Step 2 — Verify the Round 3 finding is resolved (see prior_reviews below).

Step 3 — Return your verdict.
</instructions>

<prior_reviews>
Codex Round 3: REQUEST CHANGES — 1 MAJOR (now fixed, committed de625e3):

"confirm_duplicate: true inserts unconditionally" + "idempotent" were contradictory.
A double-tap, retry, or network replay after the user taps Continue could create
multiple pending submissions for one user action.

Fix applied:
- Client generates a submission_id (UUID) when the user enters Submit Step 1.
- submission_id is passed on every submit_location call.
- RPC is idempotent on submission_id: repeat calls return existing {status:'success', location_id} without inserting a new row.
- confirm_duplicate:true upserts by submission_id (not an unconditional insert).
- Server contract note rewritten to cover all three cases: happy path, duplicate candidate, and confirm — each now safe against retries and replays.
</prior_reviews>

<verification_focus>
1. Is submission_id clearly specified as client-generated (UUID) at Step 1 entry?
2. Is the idempotency guarantee on submission_id explicit — repeat calls return existing result, no new row?
3. Does confirm_duplicate:true now upsert by submission_id rather than insert unconditionally?
4. Are double-tap, retry, and network replay scenarios covered by the contract?
5. Did the fix introduce any new implementation-quality or production risk?
</verification_focus>

<output_format>
## Codex Review - Phase 1.5 Round 4 (01.5-01 Flow 10 server contract targeted)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line — Description. Impact. Required fix.

### Verification
Files read and checks performed.

### Approved
What is correct and ready to proceed.
</output_format>
