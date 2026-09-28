# Claude Project Router

Status: active, intentionally lean. This file is auto-loaded by Claude Code, so it routes to current sources instead of embedding long project, stack, and review manuals.

## Required Startup

1. Read `AGENTS.md`.
2. Read `docs/context-router.md`.
3. Read `.planning/STATE.md`.
4. If recovering after compaction or a new terminal session, read `.beads/context/execution-state.md` if present.
5. Invoke `superpowers:using-superpowers` and the task-relevant Superpowers skills.
6. For artifact work, load `.claude/skills/artifact_qa_gate.md` and apply the shared core.

After that, load only the context tier selected by `docs/context-router.md`. Do not read the full roster, product spec, schema contract, roadmap, stale scan, Codex guide, or Antigravity guide unless the router makes that file relevant to the current task.

## Workflow Entry Points

GSD is installed in its lean `core` profile (frozen at 1.42.3; the upstream package is deprecated). Use it for phase work unless the user explicitly asks to bypass it:

- `/gsd-discuss-phase`, `/gsd-plan-phase`, and `/gsd-execute-phase` for phase work. Phase 5 plans already exist; executing them does not require re-planning.
- Small fixes, docs, and ad-hoc maintenance: do them directly, with the same verification and review rules.
- Bug investigation: `superpowers:systematic-debugging`.
- `/review-gate` for non-trivial changes that need both reviewers.

For file-changing work, keep `.claude/review-queue.txt` current. For code or behavior changes under `app/src/**`, follow the TDD and verification rules in `docs/agent-harness.md`.

## Current Reviewer Contract

Claude writes packets. The user runs reviewers.

- `/codex-prompt` (or `/antigravity-review`, the same flow): Claude writes `.claude/review-claims.md` and runs `node .claude/hooks/review-packets.js`, which stages the queue and writes `.claude/codex-prompt-latest.md` and, in the full tier, `.claude/antigravity-prompt-latest.md`. Each packet carries its reviewer's `### Required Skills`.
- Full tier: the user runs `agy` or `antigravity`, points it at its packet, and saves the policy-allowed verdict to `.claude/antigravity-review-latest.md`.
- The user runs `codex exec` with a short prompt pointing at its packet and saves the verdict to `.claude/codex-review-latest.md`.
- Low tier (policy `lowRiskCodexOnly`; every queued path is Markdown under `docs/` (except `docs/agent-harness.md`, `docs/review-severity.md`, `docs/schema-contract.md`, and `docs/legal/`) or `AGENTS_ROSTER.md`, and the claims declare `risk_level: low`): Codex alone reviews. Commands, skills, and this file are never low tier. The full rule is in `AGENTS.md`.
- Findings only in lines a batch did not change are follow-ups in `.planning/todos/pending/`, not blockers, unless the change depends on them.

Generate every required initial packet before any reviewer runs. Do not expose one reviewer
verdict to the other until both exact verdicts have been archived with
`.claude/hooks/archive-review-artifact.js`. During Antigravity probation, its clean
verdict is `ADVISORY`; Codex remains the approval-bearing independent reviewer.

Do not invoke Antigravity or Codex directly from Claude unless the user explicitly overrides this rule. Do not inline full packet contents into a command line.

## Superpowers And TDD

Use the relevant Superpowers skills before task actions. In this project, that usually means:

- `superpowers:using-superpowers` at task start.
- `superpowers:brainstorming` for behavior or workflow design.
- `superpowers:systematic-debugging` before investigating failures.
- `superpowers:test-driven-development` before non-trivial app behavior changes.
- `superpowers:writing-skills` for skill creation or revision.
- `superpowers:receiving-code-review` before applying reviewer findings.
- `superpowers:verification-before-completion` before claiming work is complete.

Probity is active for `app/src/**` source work (`probity.config.ts`; migrated from TDD Guard 2026-07-31). Do not bypass hooks without explicit user approval and a recorded reason.

## Project Sources

Use the router instead of embedding these here:

- Product and safety: `SPEC.md`
- Current planning state: `.planning/STATE.md`
- Roadmap and phase scope: `.planning/ROADMAP.md`
- Verification commands: `docs/verification.md`
- Schema and Supabase contract: `docs/schema-contract.md`
- Agent/review contract: `docs/agent-harness.md`
- Codex details: `CODEX.md`
- Antigravity details: `ANTIGRAVITY.md`

## Current Recovery Rule

If `bd` is unavailable, do not run `bd prime` or block on it. Read `.beads/context/execution-state.md` and `.planning/STATE.md` instead. `.beads/plans/active-plan.md` is not authoritative unless its status matches those current-state files.
