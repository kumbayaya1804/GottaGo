# Agent Router

Status: active, intentionally short. This file is auto-loaded by Codex and may be read by other agents, so it must route context instead of duplicating the full operating manual.

## Load Order

1. Read this file.
2. Read `docs/context-router.md`.
3. Use the router to choose the smallest task-appropriate context set.
4. When Superpowers is installed, invoke `superpowers:using-superpowers` and each task-relevant Superpowers skill before acting.
5. For artifact creation, modification, review, or finalization, load `.claude/skills/artifact_qa_gate.md` and apply the role-specific overlay.
6. Load full source docs only when the router says the whole document is directly relevant.

Do not start by loading `SPEC.md`, `docs/schema-contract.md`, `AGENTS_ROSTER.md`, `CODEX.md`, `ANTIGRAVITY.md`, `.planning/PROJECT.md`, or `.planning/ROADMAP.md` in full. Those are source documents, not default startup context.

## Roles

- Claude is the default implementer and GSD orchestrator.
- Antigravity supplies architecture, PostGIS, RLS, trust, and data-integrity findings under `.claude/antigravity-review-policy.json`; it is advisory during probation.
- Codex is the implementation-quality, security, privacy, TypeScript, test-quality, and user-failure-state reviewer.
- GSD owns phase lifecycle, planning, execution, verification, and state.

Claude does not self-approve. Non-trivial code, workflow, schema, security, privacy, or review-gate changes require a separate Codex approval. While Antigravity is enabled, they also require its policy-valid review and resolution of every finding; probationary `ADVISORY` is not an approval.

## Current Review Workflow

Claude prepares review artifacts. The user runs the reviewer CLIs.

Both reviewers apply the shared `.claude/skills/artifact_qa_gate.md` core to the exact
same staged bytes. Codex applies the Codex overlay; Antigravity applies the Antigravity
overlay. Antigravity also invokes `superpowers:using-superpowers`, the task-relevant
Superpowers skills, and `superpowers:verification-before-completion` before its verdict.
Their initial runs, evidence, artifacts, and verdicts remain blind and independent. Generate both packets before either run, then archive each exact verdict before revealing the other reviewer's output.

1. Claude verifies the task locally and ensures `.claude/review-queue.txt` lists the changed files for the current task.
2. Claude runs `/antigravity-review` to write `.claude/antigravity-prompt-latest.md`.
3. The user runs Antigravity (`agy` or `antigravity`) with a short prompt pointing at that packet. The verdict is saved to `.claude/antigravity-review-latest.md`.
4. Claude runs `/codex-prompt` to write `.claude/codex-prompt-latest.md`.
5. The user runs `codex exec` with a short prompt pointing at that packet. The verdict is saved to `.claude/codex-review-latest.md`.
6. Claude fixes all BLOCK and REQUEST CHANGES findings and regenerates affected packets.
7. Commit only after Codex is APPROVE, Antigravity has the verdict permitted by its current policy (`ADVISORY` during probation), all findings are resolved, both verdicts are archived, and the relevant verification is reported.

The packet files are inputs, not proof. Reviewers must inspect the actual files from disk and cite exact `file:line` evidence.

## User Advocacy Gate

Every implementation, plan, and review must ask:

> Does this decision serve someone with 60 seconds before an emergency?

Flag or block changes that create blank maps, silent failures, excessive friction, unavailable results, or undocumented accuracy-vs-availability tradeoffs for high-urgency users.

## Non-Negotiables

- Never commit with a BLOCK verdict outstanding.
- Never bypass shadowban, trust, GPS verification, privacy, or RLS checks for convenience.
- Never store coordinates outside approved PostGIS geometry/geography fields.
- Never log PII, auth tokens, user IDs, emails, or precise location data in client-visible contexts.
- Never treat client code as the security boundary for trust, GPS authority, shadowban, or RLS behavior.
- Never approve from intent; inspect implementation, tests, runtime boundaries, and failure paths.
- Never use full-document prompt dumps when focused excerpts, diffs, and dependency chains answer the review question.

## Beads And Recovery

Use `bd` only when the CLI is available on PATH. If `bd` is missing, do not fail the session or inject stale Beads state. Read these files instead:

- `.beads/context/execution-state.md`
- `.beads/context/project-context.md` only when recovery or historical tooling context is needed
- `.planning/STATE.md`

If Beads state conflicts with `.planning/STATE.md`, treat `.planning/STATE.md` and `.beads/context/execution-state.md` as the current recovery sources and flag the conflict.
