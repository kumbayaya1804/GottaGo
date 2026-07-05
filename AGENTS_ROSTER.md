# Gotta Go Agent Roster

Status: active. This is the role index, not the startup context bundle.

## Context Loading

Every agent starts with:

1. `AGENTS.md`
2. `docs/context-router.md`
3. The task-specific files selected by that router

Do not load every project source document before work. Full-document reads are reserved for tasks where the whole document is the object being edited or reviewed.

## Agent 1 - Claude

Role: primary implementer and GSD orchestrator.

Responsibilities:
- Execute GSD workflows.
- Write code, tests, migrations, docs, and review packets.
- Maintain `.claude/review-queue.txt`.
- Run local verification or report exact blockers.
- Prepare Antigravity and Codex packets.
- Resolve reviewer findings before commit.

Claude does not self-approve.

## Agent 2 - Antigravity

Role: architectural auditor and systems reviewer.

Primary focus:
- PostGIS correctness and performance.
- RLS policy placement.
- Trust, confidence, decay, and respect-signal logic.
- Data integrity and cross-boundary runtime behavior.
- Accuracy-vs-availability tradeoffs for emergency users.

Invocation model:
- Claude writes `.claude/antigravity-prompt-latest.md`.
- The user runs `agy` or `antigravity` with a short prompt pointing at that packet.
- The verdict is saved to `.claude/antigravity-review-latest.md`.

Antigravity reads the packet, inspects actual files from disk, and returns the format defined in `ANTIGRAVITY.md`.

## Agent 3 - Codex

Role: implementation-quality, security, privacy, and test-quality reviewer.

Primary focus:
- TypeScript and React Native correctness.
- Supabase misuse, auth/session boundaries, RLS-sensitive reads, and unsafe client trust.
- Privacy leaks and PII/precise-location exposure.
- Missing error, empty, loading, and denied-permission states.
- Tests that mock away production behavior.

Invocation model:
- Claude writes `.claude/codex-prompt-latest.md`.
- The user runs `codex exec` with a short prompt pointing at that packet.
- The verdict is saved to `.claude/codex-review-latest.md`.

Codex reads the packet, inspects actual files from disk, and returns the format defined in `CODEX.md`.

## Agent 4 - GSD

Role: phase lifecycle and planning engine.

Key commands:
- `/gsd-discuss-phase`
- `/gsd-plan-phase`
- `/gsd-execute-phase`
- `/gsd-verify-work`
- `/gsd-code-review`
- `/gsd-quick`
- `/gsd-debug`

GSD state files do not replace implementation evidence. Agents still inspect actual files and run verification.

## Review Cycle

1. Claude finishes a scoped task and verifies it.
2. `.claude/review-queue.txt` lists current changed files.
3. Claude prepares Antigravity packet.
4. User runs Antigravity and saves verdict.
5. Claude prepares Codex packet.
6. User runs Codex and saves verdict.
7. Claude fixes all BLOCK and REQUEST CHANGES findings.
8. Affected files re-enter the queue and reviewers re-review.
9. Commit only after both reviewers APPROVE.

## Non-Negotiables

1. Never commit with a BLOCK verdict outstanding.
2. Never skip both reviewers for non-trivial code, workflow, schema, security, privacy, or review-gate changes.
3. Never store coordinates outside PostGIS geometry/geography columns.
4. Never log PII, auth tokens, user IDs, emails, or precise location data in client-visible contexts.
5. Never trust the client for trust math, GPS authority, shadowban decisions, or RLS enforcement.
6. Never approve without inspecting actual files.
7. Never let Antigravity/Codex conflicts be resolved silently.
