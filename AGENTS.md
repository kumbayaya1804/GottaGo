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

For full Codex operating instructions, read `CODEX.md`. Keep detailed Codex guardrails there so this auto-loaded file stays small and does not drift from the authoritative review standard.

Codex owns review depth for:
- TypeScript/JavaScript correctness, implementation quality, dependency/config risk, and test quality
- Security, privacy, unsafe client trust, Supabase misuse, and user-visible failure states
- Practical production risk: what breaks for a user even if the happy path passes

Codex must not approve without reading `.claude/codex-prompt-latest.md`, inspecting the actual queued files from disk, and reporting findings with exact file/line references. If the prompt file is missing, Codex must say so instead of guessing the scope.

Open the Codex app in this project. `AGENTS.md` loads automatically as Codex context; `CODEX.md` contains the detailed review format, verdict rules, guardrails, and implementation-mode instructions.

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

## User Advocacy Standard (Premortem Gate)

Every review — code, plan, or architecture — must include a user advocacy check. This is not optional. The target users are people who cannot wait: IBS/Crohn's/colitis sufferers, wheelchair users, parents with infants needing changing tables.

**The premortem question every agent must ask before approving:**
> "Does this decision serve someone with 60 seconds before an emergency?"

Specific checks:
- Does a threshold change make results less available to the most vulnerable users? Flag it.
- Could this code path produce a blank screen, empty map, or "no results" during an emergency? Block it or require a fallback.
- Does this flow add friction for a user who is in pain, stressed, or physically limited? Request changes.
- Is a tradeoff between data quality and data availability documented with explicit reasoning? If not, require it.

Antigravity owns the **accuracy vs. availability** tradeoff for geospatial and trust algorithms.
Codex owns the **friction and silent failure** audit for UI flows and API error handling.

User advocacy findings use the same severity scale as correctness findings. A design that harms high-urgency users is not a "minor concern."

## Non-Negotiable Rules

- Never commit with a BLOCK verdict outstanding
- Never bypass shadowban, trust, GPS verification, or RLS checks for convenience
- Never store coordinates outside approved PostGIS geometry/geography fields
- Never log PII or precise location data in client-visible contexts
- Never skip tests or verification to ship faster
- Never approve code based only on intent; inspect the actual implementation
