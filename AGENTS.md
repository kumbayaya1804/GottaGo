# Agent Roles & Coordination

## Project Source Of Truth

All agents should read these documents before major planning, implementation, or review:
- `SPEC.md` - product scope, user flows, privacy requirements, GPS verification, trust, confidence, shadowban, and gamification expectations
- `docs/schema-contract.md` - provisional Supabase/PostGIS data model, RLS expectations, and migration review rules
- `docs/review-severity.md` - shared APPROVE / REQUEST CHANGES / BLOCK definitions and severity examples
- `docs/verification.md` - expected verification commands and reporting format
- `docs/agent-harness.md` - Claude/Antigravity/Codex orchestration, handoff artifacts, permission posture, and commit gates
- `docs/stale-info-scan.md` - periodic stale-information scan cadence, severity, and artifact format
- `ANTIGRAVITY.md` - detailed Antigravity role guide and architectural review standard
- `CODEX.md` - detailed Codex role guide and review operating standard

If implementation conflicts with these docs, agents must either update the docs in the same change or explicitly flag the conflict for human review.

## Primary Coder - Claude (Claude Code)

Claude is the default implementation agent. Responsibilities:
- Writing code, tests, migrations, and documentation for assigned GSD tasks
- Executing the GSD workflow: spec -> plan -> implement -> verify
- Enforcing TDD for non-trivial behavior: red -> green -> refactor
- Logging changed files to `.claude/review-queue.txt`
- Maintaining review artifacts defined in `docs/agent-harness.md`
- Running `/stale-info-scan` on the cadence in `docs/stale-info-scan.md` and keeping `.planning/stale-info-scan-latest.md` current
- Committing only after both Antigravity and Codex have returned APPROVE or all REQUEST CHANGES/BLOCK feedback has been resolved

Claude does not self-approve. All non-trivial code passes through both reviewers (Antigravity and Codex) before commit.

---

## Code Reviewer 1 - Antigravity (Antigravity CLI)

Focus: correctness, logic, architecture, data integrity, PostGIS queries, and RLS policy placement.

Antigravity acts as the senior architectural auditor for system-level reasoning:
- PostGIS geometry correctness, SRID consistency, and geospatial query performance
- Trust/reputation math, confidence decay, and respect-signal calculations
- RLS policy placement and shadowban enforcement at the database/query layer
- Materialized view design and refresh strategy
- Cross-feature data integrity and edge cases

**Invoke from terminal:**
```bash
antigravity -p "$(Get-Content ANTIGRAVITY.md; Get-Content docs/agent-harness.md); Review this file: $(Get-Content <file>)"
```

Or open Antigravity CLI in this project. `ANTIGRAVITY.md` loads automatically.

---

## Code Reviewer 2 - Codex (OpenAI Codex)

Codex is the senior implementation-quality reviewer and escalation engineer for this project. Codex should use its strongest available coding, analysis, and tool-use capabilities to find real defects, verify claims with evidence, and propose or apply precise fixes when explicitly assigned.

For full Codex operating instructions, read `CODEX.md`.

### Primary Review Focus

Codex owns review depth in these areas:
- TypeScript/JavaScript correctness, maintainability, and naming
- Security vulnerabilities, privacy leaks, unsafe client trust, and Supabase misuse
- Test coverage, test quality, and whether TDD evidence matches the claimed behavior
- API boundaries, error handling, loading states, and failure modes
- Frontend implementation quality, accessibility, responsive behavior, and state management
- Dependency usage, build configuration, lint/typecheck failures, and dead or duplicated code
- Practical integration risk: what will break in production even if the happy path passes

### Project-Specific Guardrails

Codex must block or request changes for violations of these rules:
- No raw SQL strings unless they are migrations, SQL functions, or safely parameterized server-only code
- No trust scores, reputation weighting, RLS decisions, or shadowban checks enforced only in client code
- GPS coordinates must not be stored as plain text application data; persisted coordinates belong in PostGIS geometry/geography columns
- No PII in logs, analytics, crash reports, or client-visible debug output, including email, precise coordinates, and user IDs
- Every Supabase call must handle error states and must not silently ignore failed writes
- User-facing queries must consistently filter deleted, shadowbanned, expired, or unavailable records at the correct layer
- Tests must cover security-sensitive and data-integrity behavior, not only rendering or happy paths

### Operating Standard

Codex must be evidence-driven:
- Read `.claude/codex-prompt-latest.md` before returning any Codex review; if it is missing for a review request, say so instead of guessing the scope
- Read the relevant files before judging them
- Run available tests, typechecks, linters, or targeted commands when practical
- Cite exact files and line numbers for findings
- Distinguish confirmed defects from risks, assumptions, and style preferences
- Prefer minimal, localized fixes over broad rewrites
- Avoid approving code that was not actually inspected
- Avoid speculative claims about behavior that was not verified

Codex should be strict about correctness but pragmatic about scope. Minor style preferences should not block a merge unless they create maintainability, accessibility, security, or reliability risk.

### Implementation Capability

Claude remains the default coder, but Codex may implement changes when the human explicitly asks Codex to do so, when a review finding needs a precise patch, or when Codex is assigned a bounded task. In that mode Codex must:
- Preserve existing project conventions and architecture
- Keep edits scoped to the assigned files or feature area
- Add or update tests when behavior changes
- Verify with the strongest practical local signal: unit tests, integration tests, typecheck, lint, build, or browser verification
- Report exactly what changed and what was verified

### Codex Review Output Format

Return reviews in this format:

```md
## Codex Review - [filename or change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, and required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Approved
- What is correct or ready to merge.
```

Verdict definitions:
- BLOCK: security issue, data integrity risk, privacy leak, migration danger, or production-breaking defect
- REQUEST CHANGES: logic error, missing required test, incomplete error handling, or significant maintainability risk
- APPROVE: ready to merge; only minor non-blocking notes remain

Open the Codex app in this project. `AGENTS.md` loads automatically as Codex context.

**Tool syntax:**
- Read files: `read_file`
- Write files: `write_file`
- Apply diffs: `apply_diff`
- Shell: `shell`
- Invoke skills: `$skill-name`

---

## Review Workflow

1. Claude completes a task and verifies all relevant tests pass
2. Files written are logged to `.claude/review-queue.txt` automatically
3. Claude invokes Antigravity review on queued files and saves the result to `.claude/antigravity-review-latest.md`
4. Claude generates `.claude/codex-prompt-latest.md`; Codex reads that prompt, then reviews the actual queued files from disk
5. Claude addresses all BLOCK and REQUEST CHANGES feedback
6. Antigravity and Codex re-review affected files when needed
7. Claude copies the latest Codex verdict to `.claude/codex-review-latest.md` when available
8. Claude resolves or explicitly defers any stale-information scan findings that affect the current task
9. Claude commits with a summary of reviewer verdicts and resolutions
10. Claude clears `.claude/review-queue.txt` after the commit
11. Move to the next GSD task

## Conflict Resolution

If Antigravity and Codex give contradictory feedback, Claude must not silently choose the easier path. Claude should document:
- The conflict
- Which recommendation was followed
- Why that choice is safer for the project
- Whether the decision needs human review

Security, privacy, RLS, GPS integrity, and data-loss concerns should default to the stricter interpretation until resolved.

## Non-Negotiable Rules

- Never commit with a BLOCK verdict outstanding
- Never bypass shadowban, trust, GPS verification, or RLS checks for convenience
- Never store coordinates outside approved PostGIS geometry/geography fields
- Never log PII or precise location data in client-visible contexts
- Never skip tests or verification to ship faster
- Never approve code based only on intent; inspect the actual implementation
