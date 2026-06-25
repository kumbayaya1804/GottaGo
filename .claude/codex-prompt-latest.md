# Codex Review Request — Phase 1.5 Plans Round 3

<context>
Project: Gotta Go — crowdsourced bathroom finder (React Native / Expo / Supabase / PostGIS)
Review scope: Documentation only — one targeted fix to 01.5-01-PLAN.md Flow 10.
Model: You are Codex (GPT-5.5). You are the senior implementation-quality reviewer.
This is a targeted re-review. Codex already APPROVED in Round 2. Only one thing changed.
</context>

<role>
Senior implementation-quality reviewer. APPROVE unless the fix introduced a new defect or left the original issue unresolved. Read the actual file from disk.

Verdict thresholds (read `docs/review-severity.md`):
- BLOCK: defect that must not ship
- REQUEST CHANGES: logic error or production risk
- APPROVE: ready; non-blocking notes permitted
</role>

<instructions>
Step 1 — Read: `.planning/phases/01.5-ux-foundation-design-system/01.5-01-PLAN.md` (focus on Flow 10 and the server contract note, around lines 128–131)

Step 2 — Verify the fix resolves Antigravity's Round 2 MAJOR finding without introducing new issues (see prior_reviews below).

Step 3 — Return your verdict.
</instructions>

<prior_reviews>
Codex Round 2: APPROVE — all three Round 1 findings resolved.

Antigravity Round 2: REQUEST CHANGES — 1 MAJOR (now fixed, committed 246af93):

The Round 2 submit_location fix made the first call "check-only, no insert." This meant the happy path (no duplicate found) went straight to Submit Success Screen with no insertion ever occurring.

Fix applied:
- Default call: duplicate check runs. No duplicate → inserts, returns {status:'success', location_id}. Duplicate found → no insert, returns {status:'duplicate_candidate', candidate:{id,name,address}}.
- confirm_duplicate:true call: bypasses check, inserts unconditionally, returns {status:'success', location_id}.
- Server contract note rewritten to cover all three cases explicitly.
</prior_reviews>

<verification_focus>
Confirm the fix is correct on disk:
1. Does the happy-path branch (no duplicate) result in an insert on a single call?
2. Is the duplicate path unambiguous — no insert until confirm_duplicate:true?
3. Is the server contract note clear, complete, and free of remaining contradictions?
4. Did the fix introduce any new implementation-quality or production risk?
</verification_focus>

<output_format>
## Codex Review - Phase 1.5 Round 3 (01.5-01 Flow 10 targeted)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line — Description. Impact. Required fix.

### Verification
Files read and checks performed.

### Approved
What is correct and ready to proceed.
</output_format>
