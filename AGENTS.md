# Agent Router

Status: active, intentionally short. This file is auto-loaded by Codex and may be read by other agents, so it must route context instead of duplicating the full operating manual.

## Load Order

1. Read this file once; use the auto-loaded copy when already present in context.
2. Read `docs/context-router.md`.
3. Use the router to choose the smallest task-appropriate context set.
4. When Superpowers is installed, invoke `superpowers:using-superpowers` and each task-relevant Superpowers skill before acting.
5. For artifact creation, modification, review, or finalization, load `.claude/skills/artifact_qa_gate.md` and apply the role-specific overlay.
6. Load full source docs only when the router says the whole document is directly relevant. Reuse unchanged context within a task; fresh reviews still inspect current bytes.

Do not start by loading `SPEC.md`, `docs/schema-contract.md`, `AGENTS_ROSTER.md`, `CODEX.md`, `ANTIGRAVITY.md`, `.planning/PROJECT.md`, or `.planning/ROADMAP.md` in full. Those are source documents, not default startup context.

## Roles

- Claude is the default implementer and GSD orchestrator.
- Antigravity supplies architecture, PostGIS, RLS, trust, and data-integrity findings on the batches the policy requires it for (defined below) under `.claude/antigravity-review-policy.json`; it is advisory during probation.
- Codex is the implementation-quality, security, privacy, TypeScript, test-quality, and user-failure-state reviewer.
- GSD owns phase lifecycle, planning, execution, verification, and state.

Claude does not self-approve. Non-trivial code, workflow, schema, security, privacy, or review-gate changes require a separate Codex approval. Batches where Antigravity is required (below) also need its policy-valid review and resolution of every finding; probationary `ADVISORY` is not an approval.

## Current Review Workflow

Before packet preparation, review, staging for review, or commit, read
`docs/agent-harness.md` for the full workflow, evidence contract, tier rules, and
commit gate. Claude prepares packets; the user runs the reviewer CLIs. Each required
reviewer applies the shared Artifact QA core and its own overlay to the same staged bytes.
Generate required packets before any run; keep initial reviews blind and independent
until all required exact verdicts are archived. Changed queued bytes require fresh packets and reviews.

Commit only after Codex is APPROVE, Antigravity, when required, has its policy-valid verdict
(`ADVISORY` during probation), findings are resolved under the harness rules, required
verdicts are archived, verification is reported, and the user agrees. An implementing
Codex session cannot supply its own independent approval.

Who reviews: Codex reviews every batch. Whether Antigravity is also required is set by `antigravityScope` in `.claude/antigravity-review-policy.json`. With `database`, the current setting, it is required only for a database batch: the staged queue touches anything under `supabase/`, `docs/schema-contract.md`, or `app/src/lib/database.types.ts`. With `all`, or with the key absent, it is required for every batch outside the low tier. With policy `mode: disabled` it is never required. `node .claude/hooks/review-packets.js` prints the reviewers a batch requires and writes a packet for each of them; follow that list. Where Antigravity is not required (under the current setting that includes app code that calls database RPCs) it is optional. While the policy mode is `probation` or `active`, an objection saved in `.claude/antigravity-review-latest.md` for the current scope still blocks; with `mode: disabled` every Antigravity artifact is ignored.

Low tier: when `lowRiskCodexOnly` is on in the policy, every queued path is Markdown under `docs/` (except `docs/agent-harness.md`, `docs/review-severity.md`, `docs/schema-contract.md`, and `docs/legal/`) or `AGENTS_ROSTER.md`, and the Codex packet declares `risk_level: low`, the batch is low tier and Codex alone reviews it at low risk. Every other batch must declare `medium` or `high`: slash commands and skills (they can run shell commands and widen tool permissions when invoked), `CLAUDE.md`, `AGENTS.md`, `CODEX.md`, `ANTIGRAVITY.md`, and all app, database, hook, settings, policy, and spec files; declaring `low` there blocks. The gate computes both rules from the staged queue, counting a rename as its old path plus its new path.

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

## Recovery

Load recovery state when the router requires it; a general question does not require
it. Read these files:

- `.beads/context/execution-state.md`
- `.beads/context/project-context.md` only when recovery or historical tooling context is needed
- `.planning/STATE.md`

`.planning/STATE.md` and `.beads/context/execution-state.md` are the current recovery sources; if they conflict with each other or with `git log`, flag the conflict. The `.beads/` directory is only a path: it holds the tracked git hooks and these context files. The project does not use an issue-tracker CLI there.
