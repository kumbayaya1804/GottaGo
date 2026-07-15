# Skill: Artifact QA Gate

## Purpose

Apply evidence-backed quality control whenever an agent creates, changes, reviews,
debugs, refactors, or finalizes a project artifact. Scale the proof to risk and do not
claim completion, approval, or production readiness beyond the evidence obtained.

This skill is shared by Codex and Antigravity. The shared core is mandatory; each
reviewer also applies its own overlay below. Sharing the gate does not merge reviewer
roles or permit one reviewer to substitute for the other.

## Trigger

Load this skill for:

- code, SQL, migration, config, prompt, workflow, skill, plan, report, or documentation changes;
- debugging, audit, review, production-readiness, or artifact-finalization requests;
- Antigravity and Codex review-packet execution;
- handoff or state reconciliation that changes what a future agent will trust.

For trivial read-only questions with no artifact or review claim, do not load it.

## Shared Preflight

Before editing or reviewing:

1. Name the exact target, desired result, audience, format, and exclusions.
2. Read the target plus the routed authority sources and nearest dependencies.
3. Inspect `git status`, current queue, staged scope, and overlapping user changes.
4. Classify risk:
   - low: narrow, reversible text or deterministic formatting;
   - medium: multi-file behavior, shared contracts, user-facing output, or automation;
   - high: security, privacy, auth, location, RLS, PostGIS, trust, migrations, production operations, or approval claims.
5. Choose the evidence level required before completion.

Preserve user work. Do not clean, reset, deploy, push live changes, or broaden scope
without the authority required for that action.

## Evidence Ladder

- **Level 0:** exact-target readback.
- **Level 1:** diff plus parser, schema, syntax, link, or structural checks.
- **Level 2:** focused tests, sample execution, render inspection, or behavioral checks.
- **Level 3:** relevant full suite plus caller/callee, permission, lifecycle, runtime, and mock-boundary audit.
- **Level 4:** separately authorized live verification, deployment smoke test, migration execution, or device UAT.

Use the lowest sufficient level, increasing it for blast radius and irreversibility.
Static inspection is not runtime proof; mocks are not database, provider, device, or
production proof. Record any unavailable higher-level evidence instead of silently
lowering the standard.

## Shared Workflow

1. Discover the exact artifact, authority, consumers, tests, and current state.
2. Plan the proof, including the likeliest failure or stale-state boundary.
3. Make or assess the smallest coherent change.
4. Read the saved artifact and inspect its diff or structured output.
5. Run the selected checks and capture actual exit status and material output.
6. Stress the highest-risk misuse, denied path, concurrency edge, or mock/runtime mismatch.
7. Repair and rerun affected checks when implementing; issue a finding when reviewing.
8. Close honestly with what passed, failed, remained unavailable, and still needs authorization.

For a reviewer packet, independently confirm the queue, staged diff, exact
`scope_hash`, every queued file's material role, verification evidence, and runtime/mock
boundary. Packet prose and prior verdicts are claims, not proof.

## Superpowers Composition

When the current harness exposes Superpowers, invoke `superpowers:using-superpowers`
before task actions and then load only the process skills whose trigger matches the
work. The Artifact QA Gate supplies the evidence contract; Superpowers supplies the
task method. Neither replaces the other.

- behavior, workflow, or feature design: `superpowers:brainstorming` until the design is approved;
- multi-step implementation planning: `superpowers:writing-plans`;
- feature or bug-fix implementation: `superpowers:test-driven-development`;
- bug, failure, or unexpected behavior: `superpowers:systematic-debugging`;
- skill creation or revision: `superpowers:writing-skills` plus its required TDD background;
- executing an approved plan: `superpowers:executing-plans` or `superpowers:subagent-driven-development` when project delegation rules permit it;
- applying reviewer feedback: `superpowers:receiving-code-review`;
- before a completion, approval, or commit claim: `superpowers:verification-before-completion`.

Every reviewer packet must contain `### Required Skills`. Every verdict must contain
`### Skills Applied`, naming the shared gate, the role overlay, and each Superpowers or
project skill actually used. If a named skill is unavailable, report that gap instead
of pretending it ran. Skill instructions never broaden permissions, permit
self-approval, or replace the independent reviewer gate.

## Codex Overlay

Codex owns implementation quality, security and privacy, TypeScript correctness, test
quality, user-visible failure states, and practical production risk.

In addition to the shared workflow:

- trace callers, providers, layouts, route guards, hooks, RPC wrappers, async ordering, and error recovery;
- compare mocks with production auth, routing, Supabase, GPS, Mapbox, and network behavior;
- check loading, empty, denied, offline, retry, and urgent-user paths;
- verify that client code is not the enforcement boundary for trust, GPS, shadowban, moderation, or RLS;
- require precise `file:line` findings and the packet's exact `scope_hash`.

Codex must not self-approve work implemented by the same Codex orchestration session.
A fresh independent Codex review run is still required.

## Antigravity Overlay

Antigravity owns architecture, PostGIS, RLS placement, trust/confidence math,
migrations, concurrency, aggregate correctness, and system data integrity.

In addition to the shared workflow:

- treat every changed or recreated `SECURITY DEFINER` function as reachable attack surface;
- inspect full return shape, `SELECT` list, row filters, caller validation, owner-RLS bypass, safe `search_path`, and execute ACLs;
- verify SRID 4326, geography/geometry semantics, meters, spatial-index use, and nearest-search ordering;
- verify allowed and denied policy/RPC paths, distinct-user rules, row locking, retry idempotency, atomic transitions, append-only evidence, and rollback behavior;
- reconcile migrations, generated types, live claims, active state, and handoffs;
- require a Claim And State Audit plus precise `file:line` findings and the packet's exact `scope_hash`.

Antigravity remains read-only during review unless the human explicitly assigns a
bounded implementation task.

## Review Independence

- Use the same staged bytes and shared evidence contract for both reviewers.
- Preserve distinct reviewer overlays, separate runs, separate artifacts, and separate verdicts.
- Do not let one review quote or inherit the other's conclusions as proof.
- Regenerate both packets and obtain both verdicts whenever queued staged bytes change.
- An implementing Claude or Codex session cannot satisfy either independent reviewer gate.

## Fail Closed

Do not approve or claim completion when the exact target was unavailable, the queue or
fingerprint is stale, a required command failed or did not exit, a material queued file
was not inspected, or high-risk enforcement remains supported only by mocks/static
claims. Report the strongest verified partial result and the precise next boundary.
