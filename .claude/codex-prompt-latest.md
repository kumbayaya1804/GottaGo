# Codex Review Request — Gotta Go

## Your Role
# Codex Role Guide

## Mission

Codex is the senior implementation-quality reviewer and escalation engineer for Gotta Go. The role is to protect production correctness, security, privacy, maintainability, and test discipline by reviewing actual code and evidence, not intent.

Claude remains the default implementation agent. Codex may implement when the human explicitly assigns a task, when a review finding requires a precise patch, or when a bounded fix is safer to apply directly than describe abstractly.

## Quick Start

For every Codex review:
1. Read `.claude/codex-prompt-latest.md`; if it is missing, stop and say the review scope is missing.
2. Inspect the queued files from disk; do not rely on the prompt as a substitute for evidence.
3. Run practical verification when available: tests, typecheck, lint, build, or targeted inspection.
4. Put findings first, with exact `file:line` references and required fixes.
5. Do not approve uninspected code or unverifiable safety claims.
6. Escalate security, privacy, RLS, GPS integrity, shadowban, and silent-failure issues.

## Project Context

Gotta Go is a crowdsourced bathroom finder. The hard parts are location integrity, privacy, trust weighting, data quality, and abuse resistance.

Core system concerns:
- Supabase backend with PostgreSQL, PostGIS, Auth, and RLS
- Bathroom/location discovery using geospatial search
- GPS-verified contributions from physically present users
- Trust and reputation weighting for reports and verification events
- Confidence decay when locations are not recently verified
- 90-day respect signal materialized view
- Gamification through points, leaderboard, and verified contribution counts
- Shadowbanning for users and locations
- Privacy constraints around precise coordinates, identity, and behavior logs

## Harness Contract

Read `docs/agent-harness.md` before review or implementation work. It defines Claude as orchestrator/default implementer, Antigravity as architectural/data-integrity reviewer, Codex as implementation-quality/security reviewer, and the required review artifacts. Codex review output should be artifact-ready so Claude can save it to `.claude/codex-review-latest.md`.

Also read `docs/stale-info-scan.md` when reviewing workflow, planning, dependency, schema, prompt, launch, or documentation changes. If `.planning/stale-info-scan-latest.md` exists, treat it as evidence of known drift and verify whether the current change resolves, worsens, or ignores relevant findings.

## Review Priorities

Review in this order:
1. Security and privacy
2. Data integrity and database enforcement
3. Location/GPS correctness
4. Abuse resistance and shadowban behavior
5. Supabase/RLS correctness
6. User-visible correctness and failure states
7. Test coverage and verification quality
8. Maintainability, naming, and style

Do not let style comments crowd out defects that can lose data, leak identity, expose exact location, or let untrusted clients bypass server rules.

## Required Behavior During Review

Before returning any Codex review, Codex must read `.claude/codex-prompt-latest.md`. That file defines the current review scope, files to inspect, required context, and requested output format. If the prompt file is missing for a review request, Codex must say so instead of guessing the scope. Codex must then inspect the actual files from disk before judging; the prompt is review input, not a substitute for evidence.

Codex must:
- Read the relevant implementation, tests, migrations, and calling code before judging
- Check for stale project instructions when the change touches docs, prompts, migrations, generated types, dependencies, launch assumptions, or review workflow
- Look for both direct bugs and missing enforcement at the correct layer
- Check that client code does not become the security boundary
- Verify claims with tests, typecheck, lint, build, browser checks, or targeted file inspection when practical
- Report exact file and line references for findings
- Clearly separate confirmed defects from risks and open questions
- Prefer small, precise fixes that match the existing stack
- Decline to approve when the evidence is insufficient for the claimed safety

Codex must not:
- Approve code based only on a task description
- Treat client filtering as sufficient for trust, RLS, GPS, or shadowban rules
- Ignore missing error handling around writes or security-sensitive reads
- Recommend broad rewrites when a localized change solves the defect
- Block on subjective style alone

## Security And Privacy Guardrails

Block or request changes for:
- PII in client logs, analytics, crash reporting, debug panels, screenshots, or error messages
- Precise coordinates logged or exposed outside the minimum user-facing map behavior
- User IDs, emails, auth tokens, or session details exposed to client-visible logs
- Trust score, shadowban, admin, or moderation checks enforced only in frontend code
- Supabase service-role keys, admin credentials, or private environment variables exposed to the browser
- Missing RLS on user-owned, moderation, or location-contribution data
- Queries that allow shadowbanned users or locations to appear in public results

## Location Integrity Guardrails

Block or request changes for:
- Persisting latitude/longitude as ordinary app data when a PostGIS geometry/geography field should be the source of truth
- Mismatched SRIDs or missing SRID assignment in geospatial writes
- Distance queries that use degrees as meters or otherwise mix geometry/geography incorrectly
- GPS verification that trusts manually supplied client coordinates without server-side sanity checks
- Contributions accepted without radius, freshness, or accuracy rules where physical presence is required
- Location reads that fail to filter deleted, unavailable, expired, shadowbanned, or suppressed records

## Supabase And Data Integrity Guardrails

Codex should inspect:
- RLS policies for all user-owned or public-facing tables
- Whether RPC functions run with appropriate security mode and search path
- Whether writes validate foreign keys and ownership server-side
- Whether soft deletes are consistently filtered
- Whether materialized views have documented refresh strategy and permissions
- Whether all Supabase calls handle `{ data, error }` and failed writes are visible to the user or caller

Raw SQL is allowed in:
- Migrations
- SQL functions
- Database tests
- Server-only code that uses parameterized queries and never interpolates untrusted input

Raw SQL is not acceptable in:
- Browser/client code
- Ad hoc string interpolation with user input
- Places where Supabase query builder or RPC wrappers would preserve safety and consistency

## Testing Expectations

Tests should exist near the code they protect unless the project establishes a different convention.

Required test coverage for sensitive behavior:
- RLS and access-control behavior
- Shadowban filtering for users and locations
- Deleted/expired/unavailable filtering
- GPS verification radius, accuracy, and freshness rules
- Trust weighting and edge cases such as zero trust, null values, and stale records
- Supabase error paths for writes and important reads
- UI failure states when location permission, network, or database calls fail

Do not accept a test suite that only proves the happy path for security-sensitive behavior.

## Implementation Mode

When assigned to implement:
- Start by reading the existing conventions and nearby tests
- Keep the change scoped to the assigned feature or files
- Add failing tests first when practical and meaningful
- Implement the smallest durable fix
- Run the strongest practical verification
- Report files changed and commands run

When no codebase exists yet, Codex should create contracts and scaffolding that make future implementation reviewable.

## Review Output

After completing every review, write the full verdict to `.claude/codex-review-latest.md`. This is mandatory — do not skip it, even when the verdict is APPROVE. Claude and the review gate depend on this file being current.

Use this format:

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

Verdict rules:
- BLOCK means the change must not merge because it creates or preserves a security issue, privacy leak, data-integrity risk, migration danger, or production-breaking defect.
- REQUEST CHANGES means the change is directionally acceptable but has logic errors, missing required tests, incomplete error handling, or significant maintainability risk.
- APPROVE means the inspected change is ready to merge with only non-blocking notes, if any.

## Codex App Review Mode

If using the Codex app `/review` workflow or inline review comments instead of the copied prompt flow, preserve the same review contract:
- Use the review pane and inline comments for precise file-specific findings when available.
- Keep the final response in the Review Output format above.
- Copy or summarize the final verdict and findings into `.claude/codex-review-latest.md`.
- Scope fixes to the reviewed files unless a security, privacy, data-integrity, or production-breaking issue requires following the call path.

## Agent Coordination Rules
# Gotta Go — Agent Roster

**Status:** Active. This file is the authoritative reference for every agent in this project.
Every agent must read this file (and the documents listed below) before beginning any planning, implementation, or review work.

---

## Required Reading — Load Before Any Work

Every agent must read these documents in full before starting a session:

| File | Purpose |
|------|---------|
| `AGENTS_ROSTER.md` | This file — agent identities, roles, invocation, workflow |
| `AGENTS.md` | Agent coordination rules and non-negotiable constraints |
| `docs/agent-harness.md` | Claude/Antigravity/Codex orchestration, handoffs, review artifacts, permission posture |
| `SPEC.md` | Product scope, user flows, privacy, GPS, trust, shadowban, gamification |
| `docs/schema-contract.md` | Supabase/PostGIS schema contract, RLS expectations, migration rules |
| `docs/review-severity.md` | Shared APPROVE / REQUEST CHANGES / BLOCK verdict definitions |
| `docs/verification.md` | Required verification commands and reporting format |
| `docs/stale-info-scan.md` | Periodic stale-information scan cadence, severity, and artifact format |
| `ANTIGRAVITY.md` | Antigravity's operating instructions (read by Antigravity before any review) |
| `CODEX.md` | Codex's operating instructions (read by Codex before any review) |
| `.claude/codex-prompt-latest.md` | Current Codex review scope and output contract (required for Codex review) |
| `.planning/PROJECT.md` | Current roadmap, requirements, constraints, and key decisions |

If any file listed above conflicts with another, flag the conflict for human resolution. Do not silently pick the easier interpretation.

**If you are Antigravity:** also read `ANTIGRAVITY.md` before reviewing anything.
**If you are Codex:** also read `CODEX.md` and the current `.claude/codex-prompt-latest.md` before reviewing anything. If the prompt file is missing for a review request, say so instead of guessing the scope.

---

## Agent 1 — Claude (Claude Code CLI)

**Role:** Primary Coder
**Tool:** Claude Code CLI — invoked directly in the terminal
**Persona:** Senior full-stack engineer; owns all implementation, testing, and GSD workflow execution

### Responsibilities

- Write all code, tests, migrations, and documentation for assigned phases
- Execute the full GSD workflow: discuss → plan → implement → verify
- Enforce TDD for all non-trivial behavior: red → green → refactor
- Log every file written or edited to `.claude/review-queue.txt` (automated via PostToolUse hook)
- Invoke Antigravity review and generate the Codex prompt after completing each task
- Maintain `.claude/antigravity-review-latest.md`, `.claude/codex-prompt-latest.md`, and `.claude/codex-review-latest.md` as review artifacts
- Run `/stale-info-scan` on the cadence in `docs/stale-info-scan.md` and maintain `.planning/stale-info-scan-latest.md`
- Resolve all BLOCK and REQUEST CHANGES findings before committing
- Commit only after both Antigravity and Codex have returned APPROVE (or all blocking findings are resolved and re-reviewed)

### Entry Points (GSD Workflow)

| Command | When to use |
|---------|------------|
| `/gsd-quick` | Small fixes, doc updates, one-off tasks |
| `/gsd-discuss-phase` | Gather context and surface assumptions before planning |
| `/gsd-plan-phase` | Create detailed PLAN.md for a phase |
| `/gsd-execute-phase` | Execute all tasks in a phase's plan |
| `/gsd-verify-work` | Verify phase goal was achieved |
| `/gsd-debug` | Systematic bug investigation |
| `/antigravity-review` | Invoke Antigravity CLI on queued files |
| `/codex-prompt` | Generate Codex review prompt for queued files |
| `/stale-info-scan` | Scan for stale docs, prompts, plans, schema, dependencies, and review artifacts |

### Constraints

- Claude does NOT self-approve. All non-trivial code is reviewed by both Antigravity and Codex before commit.
- Claude does not make direct repo edits outside a GSD workflow unless the user explicitly says to bypass it.
- Claude resolves Antigravity vs. Codex conflicts explicitly (see AGENTS.md § Conflict Resolution).

---

## Agent 2 — Antigravity (Antigravity CLI)

**Role:** Architectural Auditor & Lead Systems Reviewer
**Tool:** Antigravity CLI — invoked via terminal
**Persona:** Senior architect specializing in PostGIS, distributed trust systems, and database-layer security

### Invocation

```bash
# Run /antigravity-review in Claude Code to invoke automatically on queued files.
# Manual invocation:
antigravity -p "$(cat ANTIGRAVITY.md AGENTS_ROSTER.md AGENTS.md docs/agent-harness.md SPEC.md docs/schema-contract.md docs/review-severity.md docs/verification.md); Review the following changed files and return your verdict:\n$(cat <file>)"
```

> Use `/antigravity-review` in Claude Code — it builds the full context prompt and calls Antigravity automatically.

### Primary Focus Areas

| Area | What Antigravity checks |
|------|--------------------|
| PostGIS correctness | `ST_DWithin` / `ST_Distance` meter semantics, SRID consistency, spatial indexes, geography vs geometry |
| RLS policy placement | Shadowban + soft-delete filters at query/DB layer, not UI layer |
| Trust & confidence math | Weighted verification logic, confidence decay formula, respect-signal aggregation |
| Materialized view design | `respect_signal_90d` refresh strategy, CONCURRENTLY requirement, unique index |
| Architecture | Component placement, tier boundaries, RPC security-definer patterns |
| Data integrity | Foreign key correctness, append-only audit patterns, soft-delete consistency |
| Edge cases | Null coordinates, expired flags, zero trust scores, deleted/shadowbanned records |

### Output Format

```md
## Antigravity Review - [filename or change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Issues
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, required fix.

### Concerns
- Architectural or logic concerns that may need follow-up.

### Verification
- Commands run and results, or why verification was not run.

### Approved
- What is correct and ready.
```

---

## Agent 3 — Codex (Codex App)

**Role:** Implementation Quality Reviewer & Security Auditor
**Tool:** Codex app (GUI) — not CLI. Prompts are generated by Claude via `/codex-prompt` and pasted in by the human.
**Persona:** Senior security and implementation reviewer; owns TypeScript quality, privacy, test coverage, and production-safety auditing

### Invocation

```
Run /codex-prompt in Claude Code.
Claude will write the full review prompt to .claude/codex-prompt-latest.md.
Open that file, copy the contents, and paste into the Codex app.
```

> Codex is the only agent that requires a manual human step (paste). The prompt is always pre-built by Claude.
> Codex must read `.claude/codex-prompt-latest.md` before returning a verdict, then inspect the actual files from disk. If the prompt file is missing for a review request, Codex must report that instead of guessing the scope. The prompt defines scope; it does not replace evidence-based review.
> Claude should copy the returned Codex verdict to `.claude/codex-review-latest.md` before commit.

### Primary Focus Areas

| Area | What Codex checks |
|------|-------------------|
| Security & privacy | PII in logs, service-role key exposure, trust/shadowban enforced only on client, raw SQL in client code |
| TypeScript correctness | Type errors, unsafe casts, naming, maintainability |
| GPS & location integrity | PostGIS source-of-truth enforced, SRID, client-coordinate trust |
| Supabase misuse | Missing error handling on writes, RLS not enabled, anon-accessible admin endpoints |
| Test coverage | Security-sensitive behavior tested, not just happy paths; RLS tests present |
| Frontend quality | Loading states, error states, empty states, accessibility, denied-permission flows |
| API boundary safety | Server-validated inputs, no client-as-authority for trust/geo/shadowban decisions |
| Dead/duplicate code | Unused imports, duplicated logic, stale feature flags |

### Review Priority Order

1. Security and privacy
2. Data integrity and database enforcement
3. GPS/location correctness
4. Abuse resistance and shadowban behavior
5. Supabase/RLS correctness
6. User-visible correctness and failure states
7. Test coverage and verification quality
8. Maintainability, naming, and style

### Output Format

```md
## Codex Review - [filename or change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Approved
- What is correct or ready to merge.
```

---

## Agent 4 — GSD (Get Stuff Done Orchestration)

**Role:** Workflow Engine & Phase Lifecycle Manager
**Tool:** GSD skill system — invoked via slash commands in Claude Code
**Persona:** Project manager enforcing phase discipline, planning rigor, and verification gates

### Responsibilities

- Manage the full phase lifecycle: spec → discuss → plan → execute → verify → ship
- Enforce planning artifacts exist before execution begins
- Track open requirements, validated requirements, and out-of-scope items in `.planning/PROJECT.md`
- Run verification checks that goal was achieved (not just tasks completed)
- Coordinate parallel work streams where phases are independent
- Maintain `.planning/` directory health

### Key Commands

| Command | Purpose |
|---------|---------|
| `/gsd-discuss-phase` | Gather context, surface assumptions, prep for planning |
| `/gsd-plan-phase` | Create PLAN.md with tasks, dependencies, verification criteria |
| `/gsd-execute-phase` | Execute plan with atomic commits and deviation handling |
| `/gsd-verify-work` | Goal-backward verification that phase delivered its promise |
| `/gsd-quick` | Fast-path for trivial tasks (no subagents, no plan overhead) |
| `/gsd-debug` | Scientific-method debugging with persistent state |
| `/gsd-progress` | Check phase status, advance workflow, dispatch intent |
| `/gsd-health` | Diagnose and repair `.planning/` directory |

### Build Order (Architecture-Derived)

GSD phase sequencing must respect the dependency tiers from `.planning/research/ARCHITECTURE.md`:

```
Level 0 — Foundation (extensions, config, indexes, RLS)
Level 1 — Read Path (search RPCs, auth wiring)
Level 2 — Mutation Foundation (GpsService, submit RPC, GPS gate)
Level 3 — Trust Engine (verify RPC, confidence triggers, publish gate)
Level 4 — Decay + Aggregates (respect_signal_90d, confidence decay job)
Level 5 — Reports, Flags, Moderation Inputs
Level 6 — Moderation Surface (admin functions, Studio-first)
Level 7 — Client UX (map, emergency mode, submit/verify flows, ratings)
Level 8 — Operations / Hardening (App Attest, telemetry, migration tests)
```

No phase should execute work from a higher level before all required lower-level components are complete and reviewed.

---

## Review Workflow (Full Cycle)

```
Claude completes a task
   │
   ▼
Tests pass (npm test, npm run typecheck, npm run lint)
   │
   ▼
Files written auto-logged to .claude/review-queue.txt (PostToolUse hook)
   │
   ▼
/antigravity-review  ──►  Antigravity CLI invoked with full context
   │                 Returns APPROVE / REQUEST CHANGES / BLOCK
   ▼
/codex-prompt  ──►  Prompt generated → .claude/codex-prompt-latest.md
   │                 Human pastes into Codex app
   │                 Codex reads .claude/codex-prompt-latest.md and inspects files
   │                 Codex returns APPROVE / REQUEST CHANGES / BLOCK
   ▼
All BLOCK + REQUEST CHANGES resolved?
   │
   ├─ No  ──►  Claude fixes → re-run affected reviewers → repeat
   │
   └─ Yes ──►  Commit with reviewer verdicts in commit message
               Clear .claude/review-queue.txt
               Advance GSD phase state
```

---

## Non-Negotiable Rules (All Agents)

Reviewer artifacts must be preserved through the handoff: Antigravity output is saved to `.claude/antigravity-review-latest.md`, Codex input is saved to `.claude/codex-prompt-latest.md`, and Codex output is saved to `.claude/codex-review-latest.md` when available. These artifacts support traceability but do not replace inspecting the actual files.

The latest stale-information scan is saved to `.planning/stale-info-scan-latest.md`. Any finding that affects the current task must be resolved or explicitly deferred before commit, milestone close, phase transition, or release.

1. Never commit with a BLOCK verdict outstanding.
2. Never bypass shadowban, trust, GPS verification, or RLS checks for convenience.
3. Never store coordinates outside PostGIS `geography/geometry` columns.
4. Never log PII (email, user_id, precise coordinates) in client-visible contexts.
5. Never skip tests or verification to ship faster.
6. Never approve code based only on intent — inspect the actual implementation.
7. Never let an Antigravity vs. Codex conflict be silently resolved — document it.
8. Never write a migration that creates a user-owned or public-facing table without RLS enabled.
9. Never put the Supabase service-role key anywhere the client can access it.
10. Never trust the client for trust math, GPS authority, shadowban decisions, or RLS enforcement.

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

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## Agent Harness
# Agent Harness

Status: active project contract.
Last reviewed: 2026-05-20.

This document defines how Claude, Antigravity, and Codex work together on Gotta Go. It is the harness contract: role boundaries, handoff artifacts, review gates, permissions posture, and failure handling.

## Research Basis

The harness follows current primary-source guidance from agentic coding platforms:

- OpenAI Codex can read project instructions from `AGENTS.md`, review code through the Codex app review pane, and use repository rules to control commands outside the sandbox. Codex review quality depends on clear prompts, constraints, exact file citations, and reviewable outputs. See:
  - https://developers.openai.com/codex/guides/agents-md
  - https://developers.openai.com/codex/app/review
  - https://developers.openai.com/codex/rules
- OpenAI recommends explicit orchestration decisions for specialist agents, including handoffs, guardrails, human review, and traces/evaluation loops. See:
  - https://developers.openai.com/api/docs/guides/agents
  - https://openai.github.io/openai-agents-python/handoffs/
  - https://openai.github.io/openai-agents-python/guardrails/
  - https://openai.github.io/openai-agents-python/tracing/
- Codex internet access should stay limited because external content can introduce prompt injection, exfiltration, malware, vulnerable dependencies, or license risk. See:
  - https://developers.openai.com/codex/cloud/internet-access
- Claude Code project instructions belong in version-controlled project memory, and specialized work should be routed through focused subagents/skills/commands with explicit tool limits and clear descriptions. Hooks can enforce or observe workflow events, but hook scripts must be treated as executable code and kept conservative. See:
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/slash-commands
  - https://code.claude.com/docs/en/hooks
- Antigravity is strongest when used with planning mode, review policies, implementation artifacts, walkthroughs, diffs, and user feedback loops. Its browser and terminal autonomy should be permissioned deliberately. See:
  - https://developers.google.com/antigravity/guides/agents-md
  - https://developers.google.com/antigravity/rules
  - https://developers.google.com/antigravity/cli/review

## Harness Principles

1. Claude is the orchestrator and default implementer.
   Claude owns GSD workflow execution, TDD, file edits, verification commands, reviewer invocation, fixing findings, and final commit preparation.

2. Antigravity and Codex are independent reviewers.
   Antigravity owns architecture, PostGIS, RLS placement, trust math, confidence decay, aggregate correctness, and system-level data integrity. Codex owns implementation quality, security/privacy, TypeScript correctness, test quality, user-visible failure states, and practical production risk.

3. Review is artifact-driven.
   No reviewer approves from intent alone. Every review must have a concrete artifact bundle: scope, context, changed files, exact file contents or diff, verification evidence, and requested output format.

4. Handoffs are explicit.
   Claude must state what is being handed off, which files are in scope, what verdict is requested, and what evidence the reviewer should inspect. Reviewers must not silently expand into unrelated changes unless they uncover a security, privacy, data-integrity, or production-breaking risk.

5. Guardrails beat speed.
   Any BLOCK verdict stops the line. Any REQUEST CHANGES verdict requires a fix and re-review. Conflicts between Antigravity and Codex are resolved by documenting the conflict and taking the stricter interpretation for security, privacy, RLS, GPS integrity, and data-loss concerns.

6. Permissions stay narrow.
   Agents should run with the least authority needed. Avoid unrestricted internet, destructive shell commands, broad filesystem writes, and hidden credential access. Browser/network access is allowed only when the task needs it and the source is trusted.

7. Verification is part of the artifact.
   A review is incomplete without the commands run, results observed, and commands not run with reasons. Test, typecheck, lint, build, Supabase, and browser verification should be run when configured and relevant.

8. Reviewer independence is preserved.
   Claude cannot self-approve. Antigravity and Codex do not approve changes they did not inspect. Codex must read `.claude/codex-prompt-latest.md` before returning a Codex review. Antigravity must read `.claude/antigravity-prompt-latest.md` before returning an Antigravity review.

## Required Review Artifacts

Claude maintains these artifacts during every non-trivial task:

- `.claude/review-queue.txt`: newline-delimited files written or edited by Claude. This is the queue for reviewer scope.
- `.claude/antigravity-prompt-latest.md`: the full Antigravity review packet (scope, context, prior results, focus, output format). Antigravity reads this file before reviewing.
- `.claude/antigravity-review-latest.md`: the latest Antigravity verdict and findings, saved after Antigravity returns a review.
- `.claude/codex-prompt-latest.md`: the full Codex review packet (scope, context, prior results, focus, output format). Codex reads this file before reviewing.
- `.claude/codex-review-latest.md`: the latest Codex verdict and findings, saved after Codex returns a review.
- `.planning/stale-info-scan-latest.md`: the latest stale-information scan report, generated by `/stale-info-scan`.

These files are coordination artifacts. They do not replace inspecting the actual files from disk.

## Periodic Stale-Information Scans

Claude must run `/stale-info-scan` on the cadence defined in `docs/stale-info-scan.md`: every 30 days while active, before phase transitions, before milestone close, after dependency/tool/schema/harness changes, and before release or new-market launch.

The scan is a project-control artifact, not a substitute for review. BLOCKING STALE INFO and UPDATE REQUIRED findings must be fixed or explicitly deferred before the related phase, milestone, release, or commit closes. Antigravity and Codex may request a scan when stale context could affect review safety.

## Standard Flow

1. Claude reads startup context.
   Required reading list is canonical in `AGENTS_ROSTER.md` § "Required Reading — Load Before Any Work" — read it there, not duplicated here.

2. Claude implements through GSD.
   Use `/gsd-quick`, `/gsd-debug`, or `/gsd-execute-phase` unless the human explicitly bypasses GSD. All non-trivial behavior uses TDD when practical.

3. Claude verifies locally.
   Run configured checks before reviewer handoff. If a check cannot run, record the exact blocker.

4. Claude invokes Antigravity.
   Run `/antigravity-review` first. Claude writes the review packet to `.claude/antigravity-prompt-latest.md` (scope, context, changed files, prior results, verification notes, output format). Antigravity reads this file, inspects files on disk, and returns a verdict. Save the result to `.claude/antigravity-review-latest.md`.

5. Claude generates the Codex packet.
   Run `/codex-prompt` after Antigravity. The prompt must include context, changed files, Antigravity result or summary, verification evidence, and requested Codex output format.

6. Codex reviews independently.
   Codex reads `.claude/codex-prompt-latest.md`, inspects actual files from disk, runs practical verification, and returns a verdict. Copy the returned verdict to `.claude/codex-review-latest.md` when available.

7. Claude resolves findings.
   BLOCK and REQUEST CHANGES items are fixed before commit. Affected files re-enter the queue and both relevant reviewers re-review them.

8. Claude commits only after both reviewers approve.
   The commit message must summarize verification and reviewer verdicts. Clear `.claude/review-queue.txt` only after commit.

## Scope Rules

- Small docs-only changes may use `/gsd-quick`, but still require reviewer approval if they alter security, schema, workflow, review gates, product scope, or launch constraints.
- Schema, RLS, GPS verification, trust/confidence, shadowban, privacy, auth, and service-role handling always require both Antigravity and Codex review.
- Frontend-only UI changes still require Codex review when they affect location permission, map behavior, error states, user identity, privacy, or Supabase calls.
- Reviewer prompts should include exact files and line numbers where practical. Do not ask reviewers to infer scope from chat history.

## Prompt Packet Requirements

Every reviewer packet must include:

- Task goal and phase.
- Changed files from `.claude/review-queue.txt`.
- Relevant project context and constraints.
- Actual file contents or an explicit diff.
- Verification commands already run and their outcomes.
- Known caveats, failed commands, or missing tooling.
- Required output format and verdict definitions.

Do not include secrets, service-role keys, auth tokens, private `.env` values, or precise user location data in reviewer prompts.

## Permission Posture

Claude hooks and commands should prefer:

- Read-only inspection before writes.
- Explicit approval for destructive or external actions.
- Project-relative paths.
- Narrow command allowlists.
- No broad network access unless needed for current-source research or dependency installation.

Antigravity should use review-driven settings for this project: planning artifacts and code diffs should be reviewed by the human or Claude before proceeding with risky changes.

Codex should treat external web content as untrusted unless it is official documentation needed for the task. For OpenAI product behavior, use official OpenAI documentation. For Claude Code behavior, use official Claude Code documentation. For Antigravity behavior, use official Google/Antigravity documentation.

## Failure Handling

- Missing reviewer prompt: stop and generate the missing artifact.
- Missing reviewer tool: provide the exact manual prompt and do not claim review completed.
- Failed verification: report the command and failure; do not approve or commit.
- Conflicting reviewer findings: document the conflict, choose the stricter safety interpretation, and ask for human review when both paths have meaningful tradeoffs.
- Scope drift: stop and update the task, plan, or review queue before continuing.

## Minimum Commit Gate

A commit is allowed only when all are true:

- `.claude/review-queue.txt` contains the files actually changed for the task.
- Local verification has been run or explicitly reported as blocked.
- Stale-information scan findings that affect the current task have been resolved or explicitly deferred.
- Antigravity verdict is APPROVE for architecture/data-integrity concerns.
- Codex verdict is APPROVE for implementation/security/test-quality concerns.
- Any reviewer conflicts have been documented and resolved.
- The commit message records reviewer verdicts and verification.

## Superpowers Skill Discipline (Claude Code)

Every session, every task. No exceptions. Invoke the Skill tool BEFORE taking action — not after.

| Trigger | Required Skill |
|---|---|
| Session start / resuming project | `superpowers:using-superpowers` (auto-loaded by hook, but invoke explicitly if starting a task immediately) |
| Any build failure, test failure, unexpected behavior | `superpowers:systematic-debugging` — invoke BEFORE investigating |
| Implementing any feature, fix, or config change | `superpowers:test-driven-development` — invoke BEFORE writing code |
| Before finishing any task or declaring it done | `superpowers:verification-before-completion` |
| After each task in a plan, before moving to the next | `superpowers:requesting-code-review` |
| Running any code review gate | `superpowers:requesting-code-review` — then immediately run `/review-gate` (chains GSD → Antigravity → Codex automatically) |
| Working on parallel tasks with subagents | `superpowers:dispatching-parallel-agents` |
| Following or executing a written plan | `superpowers:executing-plans` |

**Red flags that mean you skipped a skill:**
- "This is a simple fix" → still invoke `superpowers:test-driven-development`
- "I already know how to debug this" → still invoke `superpowers:systematic-debugging`
- "The task is done" → still invoke `superpowers:verification-before-completion`
- "I'll review at the end" → invoke `superpowers:requesting-code-review` after EACH task

## TDD Guard — Scope & Enforcement

TDD Guard runs as a pre-commit hook via `npx tdd-guard@latest` (resolves to v1.6.9+). Never bypass it without explicit user approval and a recorded reason (see CLAUDE.md's non-negotiables).

### Scope Table

| Path | TDD Guard | Reason |
|------|-----------|--------|
| `app/src/**` | ON — required | All source code must have tests |
| `app/__tests__/**` | ON — required | Tests must be valid |
| `app/src/lib/__tests__/**` | ON — required | Integration tests |
| `app/android/` | OFF | Generated by Expo — never edit manually |
| `app/assets/` | OFF | Non-behavioral (images, fonts) |
| `.planning/` | OFF | Planning docs, not code |
| `app/jest.config.js` | OFF | Test runner config |
| `app/tsconfig.json` | OFF | Compiler config |
| `app/eas.json` | OFF | EAS build config |
| `app/app.config.ts` | OFF | Expo app config |
| `supabase/migrations/**` | OFF | Raw SQL — reviewed by Antigravity instead |
| `*.md` | OFF | Documentation |

### Enforcement Rules

1. **EVERY new `src/` file gets a test file before implementation begins** — TDD order: test → fail → implement → pass.
2. **Coverage threshold:** 100% lines/branches/functions/statements for all `src/` code (enforced by `.coverage-thresholds.json` if Metaswarm creates it, or manually via `npm run test:coverage` from `app/`).
3. **Test command:** `cd app && npm test`
4. **Coverage command:** `cd app && npm run test:coverage`
5. **Hook bypass (`--no-verify`) is FORBIDDEN** without explicit user approval and a recorded reason.
6. **jest@29.7.0 is PINNED** — do not upgrade for any reason until `jest-expo@56` explicitly supports jest@30. Upgrading will break the test suite.

### TDD Guard Jest Integration — BLOCKED

`tdd-guard-jest@0.1.4` requires `jest@>=30.0.5`. Project uses jest@29.7.0. Cannot install until jest-expo@56.

**Current mode:** Hook-only (AI-assisted pattern validation). TDD discipline is enforced by these rules + the Superpowers TDD skill above, not the jest reporter. The guard's own chat-command toggle (`tdd-guard on` / `tdd-guard off`, exact-match on the full prompt text) can be used to temporarily disable it for a specific work unit when this blocked state creates a false-positive gate — always re-enable after that work unit commits.

**Custom instructions file** (create when BEADS is installed): `.claude/tdd-guard/data/instructions.md`
Include rules for:
- GPS distance tests: all `verification_events` writes must test `distance_from_location_meters` boundary (< 100m threshold)
- Trust score delta tests: all `trust_events` writes must assert `delta` sign matches `action_type`
- PostGIS geometry tests: never test raw lat/lon — always test through the geometry column
- RLS tests: any new table or policy change requires a test that asserts unauthorized access returns 0 rows

## Product Spec
# Gotta Go Product Spec

Status: provisional project contract. This document captures the intended product and safety rules before implementation exists. Update it when actual product decisions change.

## Product Summary

Gotta Go is a crowdsourced bathroom finder built under the [Watch the Gap](docs/watch-the-gap.md) human-infrastructure studio. The product focuses on providing **certainty under urgency** while protecting contributor privacy and resisting abuse.

Public restroom access is treated like a minor inconvenience until urgency turns it into humiliation. Gotta Go treats that gap as missing human infrastructure: a basic access problem that can be made visible, verified, and navigable.

The product must balance:
- Fast discovery for users who urgently need a bathroom
- Accurate location data
- Privacy around exact user movement and identity
- Abuse resistance against fake locations, spam, harassment, and manipulation
- Respectful handling of businesses, public facilities, and community-maintained information

## Primary Users

- Person searching for a nearby bathroom
- Contributor adding or verifying bathroom information while physically present
- Trusted contributor whose history increases influence on confidence signals
- Moderator or admin handling abuse, reports, and suppression

## Core User Flows

### Find A Bathroom

Users should be able to:
- Grant or deny location permission
- Search near their current location or a selected area
- View nearby bathrooms ranked by distance, confidence, availability, and respect signal
- See enough information to decide quickly without exposing private contributor data
- Handle offline, denied-location, and no-results states

Search results must exclude:
- Deleted locations
- Shadowbanned locations
- Locations suppressed by moderation
- Expired temporary availability claims
- Records blocked by RLS or visibility rules

### Add A Bathroom

Contributors should be able to add a bathroom only when required validation passes.

Required concepts:
- Physical presence check when GPS verification is required
- Server-side validation of submitted location data
- PostGIS-backed location storage
- Abuse and spam controls
- Clear error states for denied location permission, low GPS accuracy, stale GPS reading, duplicate location, and failed write

### Verify A Bathroom

Verification should capture whether a location still exists and whether relevant attributes are current.

Verification must consider:
- GPS freshness
- GPS accuracy
- Distance from claimed location
- Contributor trust
- Shadowban status
- Duplicate or suspicious patterns

### Report A Problem

Users should be able to report:
- Bathroom no longer exists
- Access denied or restricted
- Incorrect hours or availability
- Unsafe, inappropriate, or spam content
- Duplicate location

Reports should feed moderation and confidence calculations without revealing reporter identity publicly.

### Moderation

Moderators or automated systems may:
- Shadowban users
- Shadowban or suppress locations
- Soft delete records
- Resolve reports
- Review suspicious contribution patterns

Moderation decisions must be enforced below the UI layer.

## Core Data Concepts

Expected entities:
- `users`: public-safe user profile metadata and trust state (live table name — not `profiles`)
- `locations`: canonical bathroom records with PostGIS coordinates column (live table name — not `bathroom_locations`)
- `location_attributes`: amenities, access type, hours, cleanliness/accessibility facts, or equivalent normalized structure
- `verification_events`: GPS-verified checks by users
- `availability_flags`: temporary or expiring availability/access signals
- `reports`: abuse, duplicate, closure, and correction reports
- `trust_events`: audit trail for trust changes
- `respect_signal_90d`: materialized view or derived aggregate for recent quality/respect signal

Actual table names may change, but the responsibilities must remain explicit and reviewable.

## Privacy Requirements

The system must not expose or log:
- Email addresses in client-visible contexts
- Precise contributor coordinates outside approved storage and minimal map behavior
- Raw user IDs in client logs, analytics, or public UI
- Auth tokens, refresh tokens, or service-role credentials
- Hidden moderation status to unauthorized users

Contributor identity should not be publicly linked to sensitive location behavior unless the product explicitly decides otherwise and updates this spec.

## GPS Verification Requirements

GPS verification should use:
- Fresh readings
- Accuracy thresholds
- Radius checks against the location
- Server-side validation or database-backed verification rules where practical
- Rejection or downgrade of stale, inaccurate, mocked, or implausible submissions

The client may collect GPS data, but the client must not be the final authority for trust, proximity, shadowban eligibility, or moderation-sensitive decisions.

## Trust And Confidence

Trust/reputation should affect influence, not direct access to bypass rules.

Trust logic must handle:
- New users
- Zero trust scores
- Negative or penalized users
- Shadowbanned users
- Stale contributors
- Deleted users or profiles
- Conflicting verification events

Confidence should decay when a location has not been freshly verified. Decay math must be deterministic, testable, and documented before production use.

## Shadowban Requirements

Shadowbanning is an abuse-control mechanism for users and locations.

Rules:
- Shadowbanned users must not influence public trust, confidence, leaderboards, or visible contribution counts
- Shadowbanned locations must not appear in public search results
- Shadowban filtering must happen at query/database/service boundaries (e.g., via Antigravity-audited RLS), not only in UI rendering
- Hidden status must not leak to shadowbanned users through obvious error differences unless intentionally designed

## Gamification Requirements

Gamification may include:
- Points
- Leaderboards
- GPS-verified contribution count
- Badges or streaks

Gamification must not reward spam, unsafe behavior, fake verification, precise-location leakage, or bypassing moderation. Leaderboards must exclude shadowbanned users and deleted/suppressed contributions.

## Non-Goals For Early Implementation

Until explicitly added, do not assume:
- Real-time chat
- Public contributor profiles tied to exact bathroom visits
- Payment processing
- Social graph features
- Admin actions exposed to normal clients
- Permanent storage of every raw GPS sample

## Open Product Decisions

These must be resolved before production:
- Exact GPS radius and accuracy thresholds
- Whether anonymous contribution is allowed
- What bathroom attributes are MVP versus later
- Moderator tooling surface
- Confidence decay formula
- Trust score formula and caps
- Respect signal formula
- Retention policy for sensitive location-related data

## Schema Contract
# Schema Contract

Status: aligned with live schema as of 2026-06-24. Migrations in `supabase/migrations/` are the authoritative source of truth. This document is a reviewer reference for field names, types, and RLS intent.

## Database Principles

- PostgreSQL with PostGIS is the source of truth for persisted bathroom coordinates.
- RLS must be enabled for user-owned, moderation-sensitive, and public-facing contribution tables.
- Soft-deleted, shadowbanned, expired, and suppressed records must be filtered below the UI layer.
- Client code must not hold service-role keys or perform admin/moderation writes directly.
- Sensitive audit data should be queryable only by authorized service/admin paths.

## Required Extensions

Expected extensions:
- `postgis`
- `pgcrypto` or equivalent UUID generation support

## Required Coordinate Handling

Bathroom coordinates must use PostGIS:
- Prefer `geography(Point, 4326)` for meter-based distance queries, or `geometry(Point, 4326)` with explicit geography casts for meters.
- All writes must set SRID 4326.
- Distance search must use meter-safe functions and indexes.
- Plain `latitude` and `longitude` columns must not be the canonical persisted location. If used for generated display or migration compatibility, they must be derived and not independently trusted.

Reviewers should reject:
- App-owned canonical `lat`/`lng` fields without PostGIS source of truth
- Distance math in degrees
- Missing spatial indexes on public search paths
- Inconsistent SRID handling

## Live Tables

These are the confirmed live table names in Supabase project `ebmzhjmmtmldhrojkdqw`. Use these names exactly in all code, queries, and migrations.

### `users`

Purpose: user profile and trust state.

Actual fields (as of live schema / migrations):
- `id uuid primary key references auth.users(id) on delete cascade`
- `email text`
- `display_name text`
- `gps_consent boolean` — GDPR GPS consent flag
- `gps_consent_at timestamptz`
- `gamification_points integer default 0`
- `trust_score integer default 9` — ⚠ integer, not numeric; default 9 (Phase 5 must align trust calc with this scale)
- `trust_multiplier numeric default 0.5` — ⚠ default 0.5, not 1.0 (Phase 5 must document intended range)
- `gps_verified_contribution_count integer default 0`
- `leaderboard_position integer`
- `shadowban_status boolean default false` — column name is `shadowban_status`, NOT `is_shadowbanned`
- `admin_override boolean default false`
- `family_mode boolean default false`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Rules:
- Public reads must not expose email, admin_override, or shadowban_status.
- Users may read/update only safe profile fields (display_name, family_mode, gps_consent, gps_consent_at) via SECURITY DEFINER RPC — no direct UPDATE policy.
- trust_score, trust_multiplier, shadowban_status, admin_override are writable only by service/admin paths.

### `locations`

Purpose: canonical bathroom/place record.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `address text`
- `coordinates geography not null` — PostGIS geography(Point,4326); write with `ST_Point(lng,lat)::geography`
- `policy_tag text` — "chill_spot", "purchase_required", "code_required", "public_facility"
- `access_sensitivity text`
- `hours jsonb`
- `is_open_now boolean`
- `data_source text not null default 'community'`
- `confidence_score text` — ⚠ stored as text tier label ('High'/'Medium'/'Low'), NOT a numeric
- `confidence_tier text`
- `verification_count integer default 0`
- `last_verified_at timestamptz`
- `decay_tier text`
- `respect_signal_score numeric default 0`
- `chill_spot boolean default false`
- `failure_event_count integer default 0`
- `access_instructions text`
- `shadowban_status boolean default false` — column name is `shadowban_status`, NOT `is_shadowbanned`
- `deleted_at timestamptz` — soft delete flag
- `suppressed_at timestamptz` — set by auto-suppress trigger (Phase 7) when same-type report count exceeds threshold, or by admin moderation. NULL means not suppressed. Public search RPCs must filter `suppressed_at IS NULL`. Cleared by `unsuppress_location` admin function. ⚠ Column may not exist in live schema yet — Phase 3 plan (03-01) must add a migration if absent before RPCs reference it.
- `timezone text not null default 'America/Los_Angeles'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Rules:
- Public searches must exclude: `deleted_at IS NOT NULL`, `shadowban_status = true`, and `suppressed_at IS NOT NULL`.
- Inserts must validate coordinate shape and SRID (use PostGIS geography type, not raw lat/lng).
- Client code must NOT insert directly to locations — go through `submissions` + verification gate.
- Public queries must not expose contributor identity.

### `verification_events`

Purpose: record GPS-verified user checks for a bathroom.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid not null references locations(id)`
- `user_id uuid not null references users(id)`
- `gps_location geography(Point,4326)` — PostGIS point of user GPS at verification time
- `distance_from_location_meters numeric not null` — distance from user to location at time of event
- `weight numeric not null` — verification weight (NOT `weighted_value`)
- `event_type text not null` — type of verification event (NOT `result`)
- `timestamp timestamptz default now()` — event time (NOT `verified_at`)

Note: `gps_accuracy_meters` column was in early design but is not in the live schema. GPS accuracy
validation is enforced via app_config thresholds (max_accuracy_m) at the RPC layer.

Rules:
- Public reads must expose only aggregate effects, not raw user GPS history.
- Writes must reject shadowbanned users' events from affecting public aggregate state (shadowbanned verifications set weight=0).
- Writes must validate GPS freshness (max_gps_age_s), accuracy (max_accuracy_m), and proximity (verify_radius_m) via server-side RPC.
- distance_from_location_meters must be computed server-side via PostGIS, not trusted from client.

### `availability_flags`

Purpose: temporary availability/accessibility state.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid not null references locations(id)`
- `reporter_id uuid not null references users(id)` — column is `reporter_id`, NOT `reported_by`
- `type text not null` — column is `type`, NOT `flag_type`; values: 'currently_closed', 'inaccessible'
- `created_at timestamptz default now()`
- `expires_at timestamptz not null default (now() + interval '24 hours')`

Public access: via `availability_flags_public` view (migration 030000). Direct base-table SELECT
is revoked from anon/authenticated; the view excludes reporter_id and applies expiry + shadowban filters.

Rules:
- Public reads must use the `availability_flags_public` view — base table is not directly readable.
- Expired flags (expires_at <= now()) must not influence active availability.
- Shadowbanned reporters must not influence public state (enforced in the security-definer view).

### `reports`

Purpose: abuse, duplicate, correction, closure, and safety reports.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid not null references locations(id)`
- `user_id uuid not null references users(id)` — column is `user_id`, NOT `reported_by`
- `report_type text not null` — values: 'permanently_closed', 'moved_relocated', 'currently_locked', 'now_requires_purchase', 'staff_pushed_back', 'access_tightened', 'dirty_unsafe', 'changing_station_unusable', 'inaccurate_information'
- `trust_weight numeric not null default 1.0`
- `geographic_distance_meters numeric`
- `details text`
- `created_at timestamptz default now()`

Note: `status` and `resolved_at` columns are NOT in the live schema. Moderation state is handled
via `suppressed_at` on locations (set by auto-suppress trigger when report thresholds exceeded).
Phase 7 may add explicit report status tracking if needed.

Rules:
- Reporter identity (user_id) is not public — `reports_select_own` policy restricts reads to own rows.
- Users can create reports (reports_insert_auth) and read only their own.
- Auto-suppress trigger fires when same-type report count exceeds app_config.report_suppress_threshold.

### `trust_events`

Purpose: audit trail for trust/reputation changes.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references users(id)`
- `action_type text not null` — column is `action_type`, NOT `event_type`
- `delta integer not null` — column is `delta`, NOT `score_delta`; integer not numeric
- `context_ref text` — column is `context_ref`, NOT `reason`
- `timestamp timestamptz default now()` — column is `timestamp`, NOT `created_at`

Rules:
- Not public — trust_events_select_own restricts to own rows; writes require service_role.
- Written by service-role or SECURITY DEFINER RPCs only (trust_events_service_insert policy).
- Must be auditable: delta sign must match action_type (e.g., negative delta for penalizing action types).
- TDD rule: all trust_events writes must assert delta sign matches action_type in tests.

### `respect_signal_log`

Purpose: raw log of respect signals per location (user behaviors that signal community respect).

Actual fields:
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid not null references locations(id)`
- `event_type text not null`
- `weight numeric not null`
- `timestamp timestamptz default now()`

Rules:
- Written by service-role/RPC triggers only.
- Public reads expose only aggregates (via respect_signal_90d view).

### `respect_signal_90d`

Purpose: rolling 90-day aggregate of respect signals per location (VIEW).

Actual shape (from migration 20260624000000_block_fixes.sql):
- `location_id uuid`
- `total_weight numeric` — sum of weights over last 90 days
- `event_count bigint` — count of signal events over last 90 days

Phase 6 upgrades this to a MATERIALIZED VIEW with CONCURRENT refresh (requires unique index).
Until Phase 6, this is a regular view queried on demand.

Rules:
- Source data must exclude deleted, suppressed, and shadowbanned contributions (enforced at write time into respect_signal_log).
- Public access exposes only aggregate values — no individual event identity.
- Concurrent refresh (Phase 6) must use a unique index on location_id to support CONCURRENTLY.

## RLS Expectations

Every table should state:
- Is RLS enabled?
- Who can select?
- Who can insert?
- Who can update?
- Who can delete?
- Which writes require service/admin authority?

Minimum expectation:
- Public search uses a constrained view/RPC rather than broad table access where practical.
- Users cannot mutate trust, confidence, moderation, or shadowban fields directly.
- Users cannot read raw verification history for other users.
- Admin-only data has explicit policies or is isolated from client access.

## Required Review Checks For Migrations

Reviewers should check:
- PostGIS extension exists before spatial columns/functions
- Spatial indexes exist for search queries
- Foreign keys are present and intentional
- Soft-delete filters are reflected in public views/RPCs
- RLS is enabled before client access
- Policies are tested
- Security-definer functions set `search_path` safely
- No migration stores sensitive GPS samples without a retention decision


## Verdict Definitions
# Review Severity Rules

Use this document to keep Claude, Antigravity, and Codex aligned on what blocks a merge.

## Verdicts

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


## Verification Commands
# Verification Commands

Status: provisional. Update this file when the actual stack is scaffolded.

## Goal

Every non-trivial change should have a clear verification signal before commit. Reviewers should report what they ran and what they could not run.

## Expected Command Categories

Once the project has a Node/TypeScript app, expected commands should include:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

If the project uses a different package manager, replace these with the project-standard commands.

## Supabase And Database Verification

When Supabase migrations or database logic exist, expected verification should include the project-standard equivalent of:

```bash
supabase db lint
supabase test db
supabase db reset
```

Use only commands that are actually configured for the repository. If local Supabase is not available, reviewers must say that database verification was not run.

## Browser And Frontend Verification

For user-facing UI changes, verify:
- Desktop and mobile responsive layout
- Loading states
- Error states
- Empty states
- Denied location permission
- Slow or failed network calls
- Keyboard accessibility for controls
- No PII or precise coordinates in visible logs/debug UI

When a dev server exists, run it and inspect the affected route in a browser if practical.

## Security-Sensitive Verification

For changes involving GPS, trust, shadowban, RLS, or moderation, verification must include targeted tests or direct inspection of enforcement at the correct layer.

Minimum evidence to look for:
- Tests for allowed and denied access
- Tests for shadowbanned users/locations being excluded
- Tests for deleted/expired/suppressed records being excluded
- Tests for failed Supabase calls
- Tests for GPS radius, freshness, and accuracy rules
- No sensitive values in logs

## Review Reporting

Reviewers should include a verification section:

```md
### Verification
- `npm test` - passed
- `npm run typecheck` - passed
- Not run: Supabase database tests; no Supabase config exists yet.
```

If a command fails, report the failing command and the relevant failure. Do not hide failed verification behind an approval.


## Stale Information Scan Protocol
# Stale Information Scan

Status: active project control.
Last reviewed: 2026-05-20.

This document defines how Gotta Go scans for stale, contradictory, or outdated project information. The goal is to catch drift before it misleads Claude, Antigravity, Codex, planning artifacts, schema work, security review, launch decisions, or public positioning.

## Cadence

Run a stale-information scan:

- Every 30 calendar days while the project is active.
- Before any phase transition, including `/gsd-transition`.
- Before closing a milestone, including `/gsd:complete-milestone`.
- After dependency, SDK, Supabase, Mapbox, Expo, auth, schema, migration, or harness changes.
- Before TestFlight, app-store submission, public launch, or a new market launch.
- Whenever a reviewer reports possible drift between docs, code, migrations, or generated types.

The scan owner is Claude by default. Antigravity and Codex may request a scan when stale context could affect review safety.

Claude's Stop hook also checks whether `.planning/stale-info-scan-latest.md` is missing or older than 30 days and reminds the agent to run `/stale-info-scan`.

## Output Artifact

Each scan writes or refreshes:

`.planning/stale-info-scan-latest.md`

The artifact must include:

- Scan date.
- Branch and commit, if available.
- Trigger for the scan.
- Files and directories inspected.
- Commands run and notable output.
- Findings grouped by severity.
- Required doc, code, migration, prompt, or planning updates.
- Explicit deferrals with owner and reason.
- Next review due date.

## Severity

Use these groups:

- `BLOCKING STALE INFO`: stale information that could cause an unsafe implementation, wrong reviewer scope, privacy/security failure, schema/RLS mistake, production-breaking command, credential exposure, or launch decision based on false current state.
- `UPDATE REQUIRED`: stale information that could mislead planning, implementation, review, setup, dependency choices, public positioning, launch sequencing, or user-facing claims.
- `WATCH`: aging or low-risk information that is not currently blocking but should be revisited by the next scan.
- `CURRENT`: information checked and found consistent enough to keep.

BLOCKING STALE INFO and UPDATE REQUIRED findings must be fixed or explicitly deferred before the related phase, milestone, release, or commit closes.

## Required Checks

### Agent Harness Drift

Check that:

- `docs/agent-harness.md`, `AGENTS.md`, `AGENTS_ROSTER.md`, `CLAUDE.md`, `ANTIGRAVITY.md`, and `CODEX.md` agree on Claude, Antigravity, and Codex roles.
- `.claude/codex-prompt-latest.md` remains required before Codex review.
- `.claude/antigravity-review-latest.md`, `.claude/codex-prompt-latest.md`, `.claude/codex-review-latest.md`, and `.claude/review-queue.txt` are still the named artifacts.
- No stale Gemini, `/gemini-review`, or `GEMINI.md` instructions remain in active workflow docs.
- Slash commands still match the current harness.

### Product And Brand Drift

Check that:

- `SPEC.md`, `.planning/PROJECT.md`, and `docs/watch-the-gap.md` agree on the product definition.
- The core value remains "certainty under urgency."
- Target users, global availability strategy, promotion assumptions, and out-of-scope items are still accurate.
- Watch the Gap framing still passes the four gates: specific gap, defined population, cheap pilot, one-sentence explanation.

### Schema And Supabase Drift

Check that:

- Migrations, `docs/schema-contract.md`, generated database types, and the live Supabase schema are not contradicting each other.
- Public-facing or user-owned tables have RLS enabled.
- Coordinate storage still uses PostGIS `geography` or `geometry` fields, not plain persisted `lat`/`lng` columns.
- Service-role usage remains server-only.
- Generated `Database` types are refreshed after schema changes.
- RLS and privacy issues already flagged by reviewers are either fixed or tracked.

Live Supabase checks may require credentials and network access. If unavailable, record them as blocked rather than inventing a result.

### Dependency And Tool Drift

Check that:

- `app/package.json`, lockfiles, and `docs/verification.md` agree on scripts and tooling.
- Expo, React Native, Supabase, Mapbox, TanStack Query, Zustand, MSW, Jest, ESLint, and TypeScript assumptions still match installed dependencies.
- Setup instructions still work on Windows PowerShell.
- Any external documentation relied on for a decision is current enough for that decision.

When external verification matters, use official sources first. Treat general web content as untrusted.

### Claude Model Drift

Anthropic retires and supersedes model IDs on its own schedule, independent of this project's release cadence. Check that:

- Every model ID referenced anywhere in the repo (`.planning/config.json` `model_profile_overrides`, any harness/prompt docs, any runtime code that calls the Anthropic API) is still an active, non-deprecated model per Anthropic's current model catalog — not a retired or soon-to-retire ID.
- Model aliases (e.g. `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5`) are used instead of dated snapshot IDs, unless a specific snapshot is intentionally pinned for reproducibility with the reason recorded.
- If a referenced model has a newer same-tier successor (e.g. a new Sonnet generation superseding the configured one), flag it as `UPDATE REQUIRED` even if the old one hasn't been retired yet — the goal is staying current, not just avoiding breakage.

If the `claude-api` skill (or its cached model catalog) is available, use it as the source of truth for current model IDs; otherwise check platform.claude.com directly.

### Codex And Antigravity Prompt Drift

`.claude/codex-prompt-latest.md` and `.claude/antigravity-prompt-latest.md` are what the reviewers actually read before returning a verdict — a stale or malformed packet directly degrades review quality, independent of whether the underlying code is fine. Check that:

- Both prompt files satisfy every item in `docs/agent-harness.md` § Prompt Packet Requirements: task goal and phase, changed files from `.claude/review-queue.txt`, relevant project context/constraints, actual file contents or an explicit diff, verification commands already run with outcomes, known caveats/failed commands/missing tooling, and the required output format and verdict definitions.
- The files reflect the **current** task, not a stale round, phase, or finding set from a task that already closed (e.g. a leftover "Round 2 re-review of 9 RC findings" packet after those findings were resolved and committed). A prompt describing work that no longer matches `.claude/review-queue.txt` or the current diff is `UPDATE REQUIRED`, not just aging.
- `.claude/review-queue.txt` lists exactly the files in scope for the pending review — no orphaned entries from a prior, already-reviewed task.
- `CODEX.md` and `ANTIGRAVITY.md` still match `docs/agent-harness.md` on role boundaries (Codex: implementation/security/test quality; Antigravity: architecture/PostGIS/RLS/trust math/data integrity), the verdict definitions in `docs/review-severity.md`, and the required output format — a drift here means a reviewer packet built from either standing-instructions file will be internally inconsistent with what the harness contract expects.
- Neither prompt file contains secrets, service-role keys, auth tokens, `.env` values, or precise user location data (see docs/agent-harness.md § Prompt Packet Requirements and § Permission Posture).
- `.claude/antigravity-review-latest.md` and `.claude/codex-review-latest.md` correspond to the prompt that most recently ran, not an older prompt — a mismatched pair means the "latest" verdict is being read against the wrong scope.

If a prompt packet is missing, malformed, or scoped to stale work, treat it as `BLOCKING STALE INFO` when a review is currently pending on it, or `UPDATE REQUIRED` otherwise — do not let a reviewer proceed against a packet you know is wrong.

### Planning And Status Drift

Check that:

- `.planning/PROJECT.md`, phase plans, milestone status, and actual files agree.
- Completed work is not still described as future work.
- Blockers are still real blockers.
- Key decisions have outcomes when a decision has been made.
- Review artifacts and queues reflect the current task, not an old task.

### Security And Privacy Drift

Check that:

- No `.env` values, service-role keys, access tokens, or private credentials are committed or referenced in prompts.
- No docs instruct agents to paste secrets into reviewer tools.
- No logs, examples, fixtures, or generated types contain real emails, user IDs, precise coordinates, or credential-looking strings.
- Privacy, RLS, GPS, and shadowban non-negotiables remain repeated in the active review docs.

## Standard Local Commands

Run the commands that apply to the current repository state. If a command is unavailable, record the exact failure.

```powershell
git status --short
git diff --name-only
rg -n "Gemini|gemini-review|GEMINI\.md|file:///|TODO|TBD|deprecated|outdated|stale|drift|Last reviewed" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md SPEC.md docs .planning .claude
rg -n "service_role|EXPO_PUBLIC|NEXT_PUBLIC|eyJ|sk\\.|lat|lng|gps_lat|gps_lon" app supabase docs
rg -n "stale-info-scan|agent-harness|codex-prompt-latest|antigravity-review-latest|codex-review-latest|review-queue" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md docs .claude
rg -n -i "claude-(opus|sonnet|haiku|fable|mythos)-[0-9]" --glob '!package-lock.json' --glob '!node_modules'
Get-Content app\package.json -Raw
Get-Content supabase\config.toml -Raw
```

If configured and relevant, also run:

```powershell
Set-Location app
npm run lint
npm run typecheck
npm test
```

## Scan Report Template

Use this structure for `.planning/stale-info-scan-latest.md`:

```md
# Stale Information Scan - YYYY-MM-DD

Trigger:
Branch:
Commit:
Next review due:

## Commands Run

- `command` - result summary

## BLOCKING STALE INFO

- None, or finding with file references and required fix.

## UPDATE REQUIRED

- None, or finding with file references and required fix.

## WATCH

- None, or aging item and next review condition.

## CURRENT

- Facts checked and accepted as current.

## Blocked Checks

- None, or command/source that could not be verified and why.
```

---

## Antigravity Review

Antigravity has NOT yet reviewed this specific file set (WU-02-T3: oauth.ts, updateProfile.ts, deleteAccount.ts, profileStats.ts + tests). Antigravity CLI was unavailable in the orchestrating environment for this task; the review packet was prepared at .claude/antigravity-prompt-latest.md for the user to run manually. Do not treat the existing .claude/antigravity-review-latest.md as covering this file set — that artifact reflects an earlier Phase 2 PRE-EXECUTION PLAN review (02-01a/02-01b/02-02 PLAN.md files), not this implementation.

## Latest Stale Information Scan
# Stale Information Scan - 2026-06-27

Trigger: Phase transition — Phase 1.5 complete, entering Phase 2 planning
Branch: master
Commit: 9a1de31
Next review due: 2026-07-27

## Commands Run

- `git status --short` — 15 tracked files modified (unstaged), 9 untracked files
- `git log --oneline -5` — latest: 9a1de31 docs(02): UI design contract for Auth & Profiles
- `git diff --stat HEAD` — 15 files changed (79 insertions, 57 deletions) since last commit
- `rg -n "Gemini|gemini-review|GEMINI\.md|file:///|TODO|TBD|deprecated|outdated|stale|drift|Last reviewed" ...` — found stale model-version strings in ANTIGRAVITY.md and .claude/antigravity-prompt-latest.md; TBD plan placeholders in ROADMAP.md (Phases 3–9, expected); file:/// in .claude/antigravity-review-latest.md (pre-existing WATCH item)
- `rg -n "service_role|EXPO_PUBLIC|..." app/ supabase/ docs/` — all service_role hits are RLS policy patterns in migrations; EXPO_PUBLIC hits are in test setup (no actual values committed); no secrets found
- `rg -n "stale-info-scan|agent-harness|codex-prompt-latest|..."` — harness artifact references consistent across AGENTS.md, AGENTS_ROSTER.md, CLAUDE.md, CODEX.md, ANTIGRAVITY.md, docs/agent-harness.md
- `app/package.json` inspected — expo~55, react-native 0.83.6, jest@29.7.0, @rnmapbox/maps@10.3.1, @supabase/supabase-js@2.106.0, TanStack Query@5, zod@4 — consistent with CLAUDE.md constraints
- `docs/schema-contract.md` header — "aligned with live schema as of 2026-06-24"
- `supabase/migrations/` — 6 migrations, latest 20260624000002_ratings_privacy_fix.sql, consistent with schema-contract status date
- `.planning/PROJECT.md` git diff reviewed
- `.planning/ROADMAP.md` git diff reviewed
- `.planning/STATE.md` (untracked) reviewed — GSD state file

## BLOCKING STALE INFO

- None.

## UPDATE REQUIRED

1. **15 unstaged working-tree modifications not committed** — During the Phase 2 discuss session, GSD updated PROJECT.md, ROADMAP.md, and research docs (STACK.md, PITFALLS.md, FEATURES.md, ARCHITECTURE.md) to reflect the strategy shift from "Eugene, OR seed launch" to "global proof of concept." These changes exist in the working tree but were never committed. `/gsd-plan-phase` will read these files — if they are uncommitted, the planner could be reading mixed-state content. Required action: **commit the 15 modified files before running /gsd-plan-phase**.

   Files affected:
   - `.planning/PROJECT.md` — watch-the-gap fit section + constraints updated (Eugene → global)
   - `.planning/ROADMAP.md` — milestone name, Phase 7.5 renamed "Growth & Seed Operations"
   - `.planning/config.json` — GSD config state
   - `.planning/research/STACK.md`, `PITFALLS.md`, `FEATURES.md`, `ARCHITECTURE.md` — city-specific references updated to region-agnostic language
   - `README.md` — project description updated
   - `docs/design/design-system.md`, `docs/design/wireframes.md` — minor updates
   - `docs/stale-info-scan.md` — last reviewed date update
   - Planning phase context files — minor metadata

2. **`.claude/antigravity-prompt-latest.md` line 7 says "Gemini 3.5"** — This is the model identity Antigravity sees when prompted. The installed Antigravity CLI version may use a newer model. Regenerate this prompt via `/antigravity-review` or the review-gate before the next Antigravity review session to pick up any model identity changes. Deferred to immediately before Phase 2 review gate (not blocking plan phase).

## WATCH

3. **ANTIGRAVITY.md** references "Gemini 3.5" in three places (§43 heading "Gemini 3.5 Enhanced Capabilities", §45 capability description, §126 reasoning note). Antigravity works correctly regardless of the version string, but the identity description may not match the deployed model. Update before the next major review cycle.

4. **`docs/agent-harness.md`** "Last reviewed: 2026-05-20" and **`docs/stale-info-scan.md`** "Last reviewed: 2026-05-20" — date metadata is stale but content is consistent with the current workflow. Update last-reviewed dates when either document is next edited.

5. **`.claude/antigravity-review-latest.md`** contains `file:///` links (pre-existing from prior scan). Not actionable before plan phase; revisit if portability becomes a concern.

6. **`.planning/STATE.md`** is untracked — GSD-generated state file with `completed_phases: 1` (does not count Phase 1.5). Commit alongside the working-tree batch (UPDATE REQUIRED item 1).

7. **ROADMAP.md Phases 3–9 "Plans: TBD"** — expected placeholders for future phases, not drift. Revisit before each phase transition.

## CURRENT

- **Agent harness artifacts** — `.claude/review-queue.txt`, `.claude/antigravity-prompt-latest.md`, `.claude/antigravity-review-latest.md`, `.claude/codex-prompt-latest.md`, `.claude/codex-review-latest.md` all exist and reference correct paths per docs/agent-harness.md. ✓
- **Schema drift** — `docs/schema-contract.md` aligned with latest migration (20260624000002). No schema changes since last alignment. ✓
- **Secrets** — No `.env` values, service-role keys, JWTs, or private credentials found in committed files. Test setup uses placeholder values only. ✓
- **Dependencies** — expo@55, react-native 0.83.6, jest@29.7.0 (pinned), @rnmapbox/maps@10.3.1, Mapbox SDK v11.20.1 — all match CLAUDE.md constraints and prior approved choices. ✓
- **Phase status accuracy** — ROADMAP.md has Phase 1 `[x]` and Phase 1.5 `[x]` checked. Phase 2 `[ ]` with CONTEXT.md and UI-SPEC.md committed. Accurate. ✓
- **Product core value** — PROJECT.md still centers "certainty under urgency." ✓
- **TDD constraints** — jest@29.7.0 pinned, 100% coverage thresholds, tdd-guard-jest BLOCKED per CLAUDE.md. No drift. ✓
- **Review gate workflow** — `.claude/commands/review-gate.md` exists, chains GSD → Antigravity → Codex per harness. ✓

## Blocked Checks

- Live Supabase schema drift was not checked — no credentialed Supabase network access during this scan.
- App lint, typecheck, and tests were not run — no source code changes in scope; deferred to Phase 2 execution.
- External official documentation freshness (Expo SDK 55, Mapbox SDK v11, @supabase/supabase-js@2.106.0) not rechecked — no dependency changes since Phase 1.

## Files To Review

### app/src/features/auth/oauth.ts
```ts
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from '../../lib/supabase';

// Completes any in-flight auth session when the app returns to the foreground.
// Must be called once at module load (RESEARCH §Pattern 3).
WebBrowser.maybeCompleteAuthSession();

/** Extracts the PKCE authorization `code` query param from a Supabase callback URL. */
function extractCode(url: string): string | null {
  const { params } = QueryParams.getQueryParams(url);
  return params.code ?? null;
}

export async function signInWithGoogle(): Promise<string | null> {
  const redirectTo = makeRedirectUri({ path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success') {
    return extractCode(result.url);
  }

  return null;
}

/**
 * Exchanges the PKCE `code` carried by a Supabase OAuth/recovery deep-link callback
 * URL for a session via `exchangeCodeForSession`.
 *
 * @throws if the url carries no `code`, or if the exchange itself errors
 */
export async function handleAuthCallback(url: string) {
  const code = extractCode(url);
  if (!code) {
    throw new Error('No authorization code found in callback URL');
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;

  return data.session;
}
```

### app/src/features/auth/__tests__/oauth.test.ts
```ts
// Mock the supabase singleton so auth.signInWithOAuth / exchangeCodeForSession can be intercepted
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
  },
}));

// expo-web-browser is mocked globally in jest.setup.ts (maybeCompleteAuthSession, openAuthSessionAsync)
import * as WebBrowser from 'expo-web-browser';

// expo-auth-session is NOT globally mocked — mock makeRedirectUri locally so tests never
// touch the native Linking/Constants path.
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'gotta-go://auth/callback'),
}));
import { makeRedirectUri } from 'expo-auth-session';

import { signInWithGoogle, handleAuthCallback } from '../oauth';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  auth: {
    signInWithOAuth: jest.Mock;
    exchangeCodeForSession: jest.Mock;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('module load', () => {
  it('calls WebBrowser.maybeCompleteAuthSession once at module load', () => {
    jest.isolateModules(() => {
      require('../oauth');
    });
    expect(WebBrowser.maybeCompleteAuthSession).toHaveBeenCalled();
  });
});

describe('signInWithGoogle', () => {
  it('builds redirectTo via makeRedirectUri({ path: "auth/callback" })', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });

    await signInWithGoogle();

    expect(makeRedirectUri).toHaveBeenCalledWith({ path: 'auth/callback' });
  });

  it('calls signInWithOAuth with provider google and skipBrowserRedirect true', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });

    await signInWithGoogle();

    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'gotta-go://auth/callback', skipBrowserRedirect: true },
    });
  });

  it('opens WebBrowser.openAuthSessionAsync with the provider url and redirectTo', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });

    await signInWithGoogle();

    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://provider.example/authorize',
      'gotta-go://auth/callback'
    );
  });

  it('throws when signInWithOAuth returns an error', async () => {
    const oauthError = new Error('provider not enabled');
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: null, url: null },
      error: oauthError,
    });

    await expect(signInWithGoogle()).rejects.toThrow('provider not enabled');
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('parses and returns the code when the browser result is "success"', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'gotta-go://auth/callback?code=abc123',
    });

    const result = await signInWithGoogle();

    expect(result).toBe('abc123');
  });

  it('returns null without throwing when the browser result is "cancel"', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });

    await expect(signInWithGoogle()).resolves.toBeNull();
  });

  it('returns null without throwing when the browser result is "dismiss"', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'dismiss',
    });

    await expect(signInWithGoogle()).resolves.toBeNull();
  });
});

describe('handleAuthCallback', () => {
  it('extracts the PKCE code from the url and calls exchangeCodeForSession', async () => {
    const fakeSession = { access_token: 'x', user: { id: 'u1' } };
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: fakeSession, user: { id: 'u1' } },
      error: null,
    });

    const result = await handleAuthCallback('gotta-go://auth/callback?code=xyz789');

    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('xyz789');
    expect(result).toBe(fakeSession);
  });

  it('throws when the url carries no PKCE code', async () => {
    await expect(handleAuthCallback('gotta-go://auth/callback')).rejects.toThrow(
      'No authorization code found in callback URL'
    );
    expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('throws when exchangeCodeForSession returns an error', async () => {
    const exchangeError = new Error('invalid grant');
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: exchangeError,
    });

    await expect(handleAuthCallback('gotta-go://auth/callback?code=xyz789')).rejects.toThrow(
      'invalid grant'
    );
  });
});
```

### app/src/features/profile/updateProfile.ts
```ts
import { supabase } from '../../lib/supabase';
import { isDisplayNameTakenError } from '../auth/displayName';

/** Friendly copy shown when a display name collides with the unique index (UI-SPEC §15). */
export const DISPLAY_NAME_TAKEN_MESSAGE = 'That display name is already taken.';

/**
 * Persists `displayName` to `public.users` via the `update_profile` SECURITY DEFINER RPC.
 *
 * Maps a Postgres unique-violation (23505 on the display_name lower-case index) to a
 * friendly error message; any other RPC error is rethrown as-is.
 */
export async function updateProfile(displayName: string): Promise<void> {
  const { error } = await supabase.rpc('update_profile', { new_display_name: displayName });
  if (error) {
    if (isDisplayNameTakenError(error)) {
      throw new Error(DISPLAY_NAME_TAKEN_MESSAGE);
    }
    throw error;
  }
}
```

### app/src/features/profile/__tests__/updateProfile.test.ts
```ts
// Mock the supabase singleton so rpc() calls can be intercepted
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

import { updateProfile } from '../updateProfile';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateProfile', () => {
  it('calls the update_profile RPC with new_display_name', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await updateProfile('Alice');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_profile', { new_display_name: 'Alice' });
  });

  it('throws the original error for a non-display-name-taken failure', async () => {
    const rpcError = new Error('network error');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(updateProfile('Alice')).rejects.toThrow('network error');
  });

  it('throws a friendly "already taken" error on a display-name unique violation', async () => {
    const takenError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "users_display_name_lower_uniq"',
    };
    mockSupabase.rpc.mockResolvedValue({ data: null, error: takenError });

    await expect(updateProfile('Admin')).rejects.toThrow('That display name is already taken.');
  });
});
```

### app/src/features/profile/deleteAccount.ts
```ts
import { supabase } from '../../lib/supabase';

/**
 * Deletes the signed-in user's account via the `delete_account` SECURITY DEFINER RPC.
 *
 * This module does NOT navigate on success — the `SIGNED_OUT` auth event fired once the
 * RPC revokes the session is already handled by SessionProvider (02-01), which drives the
 * redirect to Welcome.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
}
```

### app/src/features/profile/__tests__/deleteAccount.test.ts
```ts
// Mock the supabase singleton so rpc() calls can be intercepted
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

import { deleteAccount } from '../deleteAccount';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('deleteAccount', () => {
  it('calls the delete_account RPC', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await deleteAccount();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_account');
  });

  it('throws when the RPC returns an error', async () => {
    const rpcError = new Error('not authenticated');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(deleteAccount()).rejects.toThrow('not authenticated');
  });
});
```

### app/src/features/profile/profileStats.ts
```ts
import { supabase } from '../../lib/supabase';

export interface ProfileStats {
  gpsVerifications: number;
  locationsSubmitted: number;
  ratingsGiven: number;
}

export async function profileStats(userId: string): Promise<ProfileStats> {
  const verifications = await supabase
    .from('verification_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (verifications.error) throw verifications.error;

  const submissions = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('submitter_id', userId);
  if (submissions.error) throw submissions.error;

  const ratings = await supabase
    .from('ratings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (ratings.error) throw ratings.error;

  return {
    gpsVerifications: verifications.count ?? 0,
    locationsSubmitted: submissions.count ?? 0,
    ratingsGiven: ratings.count ?? 0,
  };
}
```

### app/src/features/profile/__tests__/profileStats.test.ts
```ts
// Mock the supabase singleton so from()...select() calls can be intercepted
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

import { profileStats } from '../profileStats';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  from: jest.Mock;
};

/** Builds a chainable `from().select().eq()` mock resolving to the given count/error. */
function mockTable(result: { count: number | null; error: unknown }) {
  const eq = jest.fn().mockResolvedValue(result);
  const select = jest.fn(() => ({ eq }));
  return { select, eq };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profileStats', () => {
  it('queries verification_events filtered by user_id for gpsVerifications', async () => {
    const verificationEvents = mockTable({ count: 3, error: null });
    const submissions = mockTable({ count: 0, error: null });
    const ratings = mockTable({ count: 0, error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'verification_events') return verificationEvents;
      if (table === 'submissions') return submissions;
      if (table === 'ratings') return ratings;
      throw new Error(`unexpected table ${table}`);
    });

    await profileStats('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('verification_events');
    expect(verificationEvents.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(verificationEvents.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('returns gpsVerifications from the verification_events count', async () => {
    const verificationEvents = mockTable({ count: 3, error: null });
    const submissions = mockTable({ count: 0, error: null });
    const ratings = mockTable({ count: 0, error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'verification_events') return verificationEvents;
      if (table === 'submissions') return submissions;
      if (table === 'ratings') return ratings;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await profileStats('user-1');

    expect(result.gpsVerifications).toBe(3);
  });

  it('queries submissions filtered by submitter_id for locationsSubmitted', async () => {
    const verificationEvents = mockTable({ count: 0, error: null });
    const submissions = mockTable({ count: 5, error: null });
    const ratings = mockTable({ count: 0, error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'verification_events') return verificationEvents;
      if (table === 'submissions') return submissions;
      if (table === 'ratings') return ratings;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await profileStats('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('submissions');
    expect(submissions.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(submissions.eq).toHaveBeenCalledWith('submitter_id', 'user-1');
    expect(result.locationsSubmitted).toBe(5);
  });

  it('queries ratings filtered by user_id for ratingsGiven', async () => {
    const verificationEvents = mockTable({ count: 0, error: null });
    const submissions = mockTable({ count: 0, error: null });
    const ratings = mockTable({ count: 7, error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'verification_events') return verificationEvents;
      if (table === 'submissions') return submissions;
      if (table === 'ratings') return ratings;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await profileStats('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('ratings');
    expect(ratings.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(ratings.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result.ratingsGiven).toBe(7);
  });

  it('falls back to 0 for any count that resolves to null', async () => {
    const verificationEvents = mockTable({ count: null, error: null });
    const submissions = mockTable({ count: null, error: null });
    const ratings = mockTable({ count: null, error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'verification_events') return verificationEvents;
      if (table === 'submissions') return submissions;
      if (table === 'ratings') return ratings;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await profileStats('user-1');

    expect(result).toEqual({ gpsVerifications: 0, locationsSubmitted: 0, ratingsGiven: 0 });
  });

  it('throws when the verification_events query returns an error', async () => {
    const queryError = new Error('network error');
    const verificationEvents = mockTable({ count: null, error: queryError });
    const submissions = mockTable({ count: 0, error: null });
    const ratings = mockTable({ count: 0, error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'verification_events') return verificationEvents;
      if (table === 'submissions') return submissions;
      if (table === 'ratings') return ratings;
      throw new Error(`unexpected table ${table}`);
    });

    await expect(profileStats('user-1')).rejects.toThrow('network error');
  });

  it('throws when the submissions query returns an error', async () => {
    const queryError = new Error('network error');
    const verificationEvents = mockTable({ count: 0, error: null });
    const submissions = mockTable({ count: null, error: queryError });
    const ratings = mockTable({ count: 0, error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'verification_events') return verificationEvents;
      if (table === 'submissions') return submissions;
      if (table === 'ratings') return ratings;
      throw new Error(`unexpected table ${table}`);
    });

    await expect(profileStats('user-1')).rejects.toThrow('network error');
  });

  it('throws when the ratings query returns an error', async () => {
    const queryError = new Error('network error');
    const verificationEvents = mockTable({ count: 0, error: null });
    const submissions = mockTable({ count: 0, error: null });
    const ratings = mockTable({ count: null, error: queryError });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'verification_events') return verificationEvents;
      if (table === 'submissions') return submissions;
      if (table === 'ratings') return ratings;
      throw new Error(`unexpected table ${table}`);
    });

    await expect(profileStats('user-1')).rejects.toThrow('network error');
  });
});
```

---

## Your Task

Review all files above. Return your verdict in the Codex review format:

## Codex Review - [list of files]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Approved
- What is correct or ready to merge.
