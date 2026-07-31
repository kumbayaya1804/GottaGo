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

Use GSD for project work unless the user explicitly asks to bypass it:

- `/gsd-quick` for small fixes, docs, and ad-hoc maintenance.
- `/gsd-debug` for bug investigation.
- `/gsd-plan-phase` and `/gsd-execute-phase` for phase work.
- `/review-gate` for non-trivial changes that need both reviewers.

For file-changing work, keep `.claude/review-queue.txt` current. For code or behavior changes under `app/src/**`, follow the TDD and verification rules in `docs/agent-harness.md`.

## Current Reviewer Contract

Claude writes packets. The user runs reviewers.

- `/antigravity-review` writes `.claude/antigravity-prompt-latest.md`.
- The packet includes `### Required Skills`: the shared Artifact QA Gate, Antigravity overlay, Superpowers bootstrap, completion verification, and task-relevant domain/process skills.
- The user runs `agy` or `antigravity` with the strongest high-reasoning model available, points it at that file, and saves the policy-allowed verdict to `.claude/antigravity-review-latest.md`. Flash-class output is advisory only.
- `/codex-prompt` writes `.claude/codex-prompt-latest.md`.
- The packet includes `### Required Skills`: the shared Artifact QA Gate, Codex overlay, and task-relevant skills available in the Codex harness.
- The user runs `codex exec` with a short prompt pointing at that file and saves the verdict to `.claude/codex-review-latest.md`.

Generate both initial packets before either reviewer runs. Do not expose one reviewer
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

TDD Guard is active for app source work. Do not bypass hooks without explicit user approval and a recorded reason.

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
- Tool profile: `.metaswarm/project-profile.json`

## Current Recovery Rule

If `bd` is unavailable, do not run `bd prime` or block on it. Read `.beads/context/execution-state.md` and `.planning/STATE.md` instead. `.beads/plans/active-plan.md` is not authoritative unless its status matches those current-state files.
