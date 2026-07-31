# Review Severity Rules

Use this document to keep Claude, Antigravity, and Codex aligned on what blocks a merge.

## Verdicts

### ADVISORY

The reviewer found no blocking issue within the evidence obtained, but the result has
no approval authority. Use this only when machine policy places that reviewer in
probation. It cannot substitute for APPROVE from an approval-bearing independent
reviewer.

### BLOCK

The change must not merge until fixed.

Use BLOCK for:
- Security vulnerability
- Privacy leak
- Data integrity risk
- Migration or RLS issue that can expose, corrupt, or lose data
- Production-breaking defect in a core flow
- Abuse path that bypasses trust, GPS verification, moderation, or shadowban rules
- Test or verification evidence that is clearly false or insufficient for a sensitive change

### REQUEST CHANGES

The change is directionally acceptable but must be revised before merge.

Use REQUEST CHANGES for:
- Logic error with bounded impact
- Missing required test for changed behavior
- Supabase error handling omitted or incomplete
- Incomplete edge-case handling
- Query filtering done in the wrong layer but not yet exploitable
- Maintainability issue likely to cause defects soon
- Accessibility or responsive behavior issue in a user-facing flow

### APPROVE

The inspected change is ready to merge.

Use APPROVE only when:
- Relevant files were inspected
- Required behavior is covered by tests or credible verification
- No BLOCK or unresolved REQUEST CHANGES findings remain
- Remaining notes are minor and non-blocking

## Severity Levels

### CRITICAL

Use for issues that can:
- Leak PII, precise location, credentials, tokens, or moderation state
- Let unauthorized users read or write protected data
- Allow client-side bypass of RLS, shadowban, trust, or GPS verification
- Corrupt canonical location data
- Break public search, add, verify, or moderation flows in production

CRITICAL findings normally imply BLOCK.

### MAJOR

Use for issues that can:
- Produce incorrect trust/confidence results
- Drop or hide legitimate user data
- Fail important error paths
- Miss required tests for security-sensitive or data-integrity behavior
- Create unreliable geospatial search results
- Make a feature unusable for a significant class of users

MAJOR findings normally imply REQUEST CHANGES, or BLOCK if security/data exposure is involved.

### MINOR

Use for issues that:
- Reduce readability or maintainability without immediate risk
- Leave small UX rough edges
- Duplicate logic in a low-risk area
- Miss low-risk tests
- Use inconsistent naming that does not confuse security or data semantics

MINOR findings should not block unless they accumulate into meaningful risk.

## Non-Blocking Notes

Use non-blocking notes for:
- Style preferences
- Optional refactors
- Naming improvements with no correctness impact
- Future optimization opportunities
- Documentation polish

Do not disguise a required fix as a non-blocking note.

## Project-Specific Blocking Examples

BLOCK examples:
- A public search query returns `is_shadowbanned = true` locations.
- A client component decides whether a user is allowed to verify based only on local profile state.
- Coordinates are stored as plain `lat` and `lng` columns as the canonical location record.
- A Supabase service-role key appears in browser-accessible code.
- A migration creates user-owned tables without RLS.
- Verification events expose other users' bathroom visit history.
- Leaderboards include shadowbanned users.

REQUEST CHANGES examples:
- A Supabase write logs an error but does not surface failure to the caller.
- Tests cover the success path but not denied-location or failed-write behavior.
- Expired availability flags are filtered in UI but not in the query/RPC.
- A query omits `deleted_at` filtering but is not yet publicly exposed.
- Confidence decay math is implemented but not tested for stale and zero-event cases.

APPROVE examples:
- A change adds a tested UI loading/error state without touching security-sensitive logic.
- A migration adds a non-sensitive field with RLS unchanged and verified.
- A refactor preserves behavior and tests/typecheck pass.
