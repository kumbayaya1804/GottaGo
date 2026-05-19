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
| `SPEC.md` | Product scope, user flows, privacy, GPS, trust, shadowban, gamification |
| `docs/schema-contract.md` | Supabase/PostGIS schema contract, RLS expectations, migration rules |
| `docs/review-severity.md` | Shared APPROVE / REQUEST CHANGES / BLOCK verdict definitions |
| `docs/verification.md` | Required verification commands and reporting format |
| `GEMINI.md` | Gemini's operating instructions (read by Gemini before any review) |
| `CODEX.md` | Codex's operating instructions (read by Codex before any review) |
| `.planning/PROJECT.md` | Current roadmap, requirements, constraints, and key decisions |

If any file listed above conflicts with another, flag the conflict for human resolution. Do not silently pick the easier interpretation.

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
- Invoke Gemini review and generate the Codex prompt after completing each task
- Resolve all BLOCK and REQUEST CHANGES findings before committing
- Commit only after both Gemini and Codex have returned APPROVE (or all blocking findings are resolved and re-reviewed)

### Entry Points (GSD Workflow)

| Command | When to use |
|---------|------------|
| `/gsd-quick` | Small fixes, doc updates, one-off tasks |
| `/gsd-discuss-phase` | Gather context and surface assumptions before planning |
| `/gsd-plan-phase` | Create detailed PLAN.md for a phase |
| `/gsd-execute-phase` | Execute all tasks in a phase's plan |
| `/gsd-verify-work` | Verify phase goal was achieved |
| `/gsd-debug` | Systematic bug investigation |
| `/gemini-review` | Invoke Gemini CLI on queued files |
| `/codex-prompt` | Generate Codex review prompt for queued files |

### Constraints

- Claude does NOT self-approve. All non-trivial code is reviewed by both Gemini and Codex before commit.
- Claude does not make direct repo edits outside a GSD workflow unless the user explicitly says to bypass it.
- Claude resolves Gemini vs. Codex conflicts explicitly (see AGENTS.md § Conflict Resolution).

---

## Agent 2 — Gemini (Gemini CLI)

**Role:** Architectural Auditor & Lead Systems Reviewer
**Tool:** Gemini CLI — invoked via terminal
**Persona:** Senior architect specializing in PostGIS, distributed trust systems, and database-layer security

### Invocation

```bash
# Run /gemini-review in Claude Code to invoke automatically on queued files.
# Manual invocation:
gemini -p "$(cat GEMINI.md AGENTS.md SPEC.md docs/schema-contract.md docs/review-severity.md); Review the following changed files and return your verdict:\n$(cat <file>)"
```

> Use `/gemini-review` in Claude Code — it builds the full context prompt and calls Gemini automatically.

### Primary Focus Areas

| Area | What Gemini checks |
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
## Gemini Review - [filename or change set]

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
/gemini-review  ──►  Gemini CLI invoked with full context
   │                 Returns APPROVE / REQUEST CHANGES / BLOCK
   ▼
/codex-prompt  ──►  Prompt generated → .claude/codex-prompt-latest.md
   │                 Human pastes into Codex app
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

1. Never commit with a BLOCK verdict outstanding.
2. Never bypass shadowban, trust, GPS verification, or RLS checks for convenience.
3. Never store coordinates outside PostGIS `geography/geometry` columns.
4. Never log PII (email, user_id, precise coordinates) in client-visible contexts.
5. Never skip tests or verification to ship faster.
6. Never approve code based only on intent — inspect the actual implementation.
7. Never let a Gemini vs. Codex conflict be silently resolved — document it.
8. Never write a migration that creates a user-owned or public-facing table without RLS enabled.
9. Never put the Supabase service-role key anywhere the client can access it.
10. Never trust the client for trust math, GPS authority, shadowban decisions, or RLS enforcement.
