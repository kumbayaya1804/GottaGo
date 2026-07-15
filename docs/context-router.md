# Context Router

Status: active. This file controls context loading for Claude, GSD agents, Antigravity packets, and Codex packets.

## Goal

Keep review quality high while avoiding default full-document dumps. Start from the smallest context that can answer the current question, then expand only when the task crosses a boundary.

## Always Read

- `AGENTS.md`
- `.planning/STATE.md`
- `.metaswarm/project-profile.json`
- `.beads/context/execution-state.md` when recovering, resuming, or checking current phase state

For any artifact creation, change, review, debugging, finalization, or handoff-state
update, also read `.claude/skills/artifact_qa_gate.md` and apply the current role's
overlay. Skip it only for read-only questions that create no artifact or review claim.

When Superpowers is installed, start with `superpowers:using-superpowers`, then invoke
only the skills whose trigger matches the task. The shared Artifact QA Gate remains
mandatory for artifact work and composes with those process skills; it does not replace
them. Every review packet names its required skills, and every verdict names the skills
actually applied.

Read `CLAUDE.md` only when operating in Claude Code and it was not already auto-loaded. Read `AGENTS_ROSTER.md` only when editing agent roles.

## Never Default To Full Reads

Do not load these in full at startup:

- `SPEC.md`
- `docs/schema-contract.md`
- `docs/agent-harness.md`
- `docs/stale-info-scan.md`
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/stale-info-scan-latest.md`
- `CODEX.md`
- `ANTIGRAVITY.md`
- `.claude/codex-prompt-latest.md`
- `.claude/antigravity-prompt-latest.md`

Use excerpts, headings, frontmatter, grep hits, line windows, diffs, or exact sections unless the whole file is being edited or reviewed.

## Task Routes

### App Implementation

Read:
- Active PLAN or task note.
- Touched source files and nearby tests.
- Nearest callers, providers, route guards, hooks, RPC wrappers, and mocks.
- `docs/verification.md` command section.

Add only when relevant:
- `SPEC.md` excerpts for product/user-flow guarantees.
- `docs/schema-contract.md` excerpts for Supabase, PostGIS, RLS, trust, shadowban, GPS, or migration behavior.
- `.claude/skills/*.md` domain skill that matches the changed boundary.

### Schema, Supabase, RLS, PostGIS, Trust

Read:
- `docs/schema-contract.md` affected table/RPC/policy sections.
- Relevant migrations and SQL functions.
- `docs/verification.md`.
- Matching skills: `postgis_optimizer.md`, `rls_security_guard.md`, `trust_engine_validator.md`.

Also inspect client call sites when a database behavior is consumed by app code.

### UI, Routing, Auth, Location Permission

Read:
- Touched screens/components.
- Parent layouts/providers and route guards.
- Tests and mocks for auth, router, Supabase, GPS, network, and permission boundaries.
- Relevant `SPEC.md` or design excerpts only for the changed user flow.

Do not load the schema contract unless the UI change reads/writes Supabase, GPS, trust, shadowban, or location records.

### Planning

Read:
- `.planning/STATE.md`.
- Current phase `*-CONTEXT.md`, `*-PLAN.md`, or `*-DISCUSSION-LOG.md` as needed.
- The current phase section from `.planning/ROADMAP.md`.
- `.planning/PROJECT.md` excerpts for requirements directly mapped to the phase.

Do not load every prior phase. Prefer summaries, explicit dependencies, and recent decisions.

### Review Packets

Read:
- `.claude/review-queue.txt`.
- `.claude/skills/artifact_qa_gate.md` (shared core plus the target reviewer's overlay).
- The target packet's `### Required Skills`, including task-relevant Superpowers and project domain skills.
- `git status --short`.
- `git diff HEAD -- <queued files>`.
- Full queued files.
- Nearest dependency chain and test mocks.
- Latest reviewer output only if it matches the current queue or diff.

Add context tiers:
- Tier 0, always: role summary, verdict format, queue, diff, verification evidence, runtime/mock boundary audit.
- Tier 1, boundary-specific: product, schema, harness, or stale-info excerpts selected by touched files.
- Tier 2, exceptional: full source docs only when the document itself is in scope or an excerpt would be misleading.

Reviewer packets must include enough evidence to review from disk, not every project document.

### Harness, Skill, Prompt, Or Workflow Changes

Read:
- `docs/agent-harness.md`.
- Affected `.claude/commands/*`, `.claude/skills/*`, `AGENTS.md`, `AGENTS_ROSTER.md`, `CLAUDE.md`, `CODEX.md`, `ANTIGRAVITY.md`.
- `.beads/context/execution-state.md` for current workflow rules.
- `docs/stale-info-scan.md` excerpts for prompt/review drift rules.

Verify with targeted `rg` checks for stale invocation text, full-read mandates, and artifact names.

### Codex Model Or Delegation Decisions

Read:
- `docs/codex-model-routing.md`.
- `docs/agent-harness.md` for review independence and approval boundaries.
- `.beads/context/execution-state.md` for the current orchestrator/recovery state.

Do not load model-routing guidance for ordinary single-agent implementation unless
model choice, reasoning effort, delegation, or an orchestrator contingency is in
scope.

### Stale-Info Scan

Read:
- `docs/stale-info-scan.md`.
- This router.
- Current state and only the active docs being checked.

Use searches first. Load full files only after a hit or when the file is the scan target.

## Packet Freshness Rules

Before treating a review artifact as current, compare:

- Queue entries.
- Git diff or diff base.
- Prompt generated time or visible scope.
- Whether the latest review references the same files and round.

If those do not match, the artifact is stale even if it says APPROVE.

## Beads Fallback

Use `bd prime` only when `bd` is available. If not:

1. Read `.beads/context/execution-state.md`.
2. Read `.planning/STATE.md`.
3. Read `.beads/context/project-context.md` only when recovery requires historical tooling context.
4. Ignore `.beads/plans/active-plan.md` if its phase/status conflicts with the current state files.
