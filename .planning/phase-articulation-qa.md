# GSD Phase Articulation QA

Date: 2026-05-20
Reviewer: Codex
Method: Artifact QA review of `.planning/ROADMAP.md`, `.planning/PROJECT.md`, and existing phase artifacts under `.planning/phases/`.

## Summary

The GSD phase sequence is directionally strong and ordered correctly, but only Phase 1 is articulated at execution depth. Phases 2-9 are understandable as roadmap phases, yet they are not fully GSD-ready because they lack phase-specific context, research, validation strategy, task-level plans, threat models, review gates, and current-schema alignment.

Overall verdict: `REQUEST CHANGES` before treating all phases as ready to execute.

## QA Standard Used

Each phase was checked for:

- Clear goal and dependency boundary.
- Concrete success criteria.
- Current schema and table-name alignment.
- Task-level decomposition.
- Verification commands or human checks.
- Security/privacy/data-integrity gates.
- Reviewer handoff expectations.
- Known blockers and assumptions.
- Output artifacts and completion evidence.

## Phase Ratings

| Phase | Current Quality | GSD-Ready? | Reason |
|-------|-----------------|------------|--------|
| Phase 1: Foundation & Scaffold | Strong but stale in places | Partially | Has context, research, validation, and two detailed plans. However 01-01 drifted from the original plan after live schema recovery, and 01-02 still assumes some pre-remediation names/patterns. |
| Phase 2: Auth & Profiles | Roadmap-level | No | Has a goal and success criteria, but no detailed plan, no current `users` table alignment, no profile RPC/trigger design, no auth test strategy. |
| Phase 3: Read Path & Map | Roadmap-level | No | Good user-facing intent, but RPC names, table names, filters, and PostGIS contracts need current-schema detail before implementation. |
| Phase 4: GPS Service & Submission | Roadmap-level | No | Correctly identifies GPS authority and pending lifecycle, but lacks server RPC contract, anti-spoofing details, error contract, and test fixtures. |
| Phase 5: Trust Engine & Verification | Roadmap-level | No | Strong concept, but trust math, trigger order, idempotency, shadowban behavior, and publish rules need a formal plan and tests. |
| Phase 6: Decay, Aggregates & Availability Flags | Roadmap-level with known recent schema interaction | No | Needs update after `availability_flags_public` RLS/view work. Decay and materialized-view refresh require precise SQL and scheduler strategy. |
| Phase 7: Reports & Moderation Inputs | Roadmap-level | No | Needs moderation authority model, report privacy model, auto-suppress rules, and admin function permissions. |
| Phase 8: Client UX & Emergency Modes | Roadmap-level | No | User workflows are clear, but implementation depends on Phases 3, 5, and 6. Needs UX state matrix and privacy/error-state review. |
| Phase 9: Operations & Hardening | Roadmap-level | No | Good targets, but needs concrete Sentry scrubber contract, pgTAP plan, release checklist, and Apple Developer blocker handling. |

## Findings

### 1. Phase 1 Is The Only Fully Planned Phase

Evidence:

- `.planning/phases/01-foundation-scaffold/01-CONTEXT.md`
- `.planning/phases/01-foundation-scaffold/01-RESEARCH.md`
- `.planning/phases/01-foundation-scaffold/01-VALIDATION.md`
- `.planning/phases/01-foundation-scaffold/01-01-PLAN.md`
- `.planning/phases/01-foundation-scaffold/01-02-PLAN.md`
- `.planning/phases/01-foundation-scaffold/01-01-SUMMARY.md`

This is the right level of detail for execution: it includes objective, context, task files, read-first lists, verification, threat model, and review gate.

Required fix:
Create equivalent phase folders and artifacts for Phases 2-9 before execution.

### 2. Roadmap Phases Are Clear But Not Executable

`.planning/ROADMAP.md` gives each Phase 2-9:

- Goal.
- Dependency.
- Requirements.
- Success criteria.
- Proposed plan names.

That is enough for sequencing, but not enough for implementation. A coder would still need to infer interfaces, file ownership, test design, SQL contracts, and security boundaries.

Required fix:
For each phase, create at minimum:

- `NN-CONTEXT.md`
- `NN-RESEARCH.md`
- `NN-VALIDATION.md`
- `NN-01-PLAN.md`

### 3. Schema Drift Must Be Reconciled Before Phase 2+

The Phase 1 summary states that recovered remote schema uses `locations` and `users`, not the earlier `bathroom_locations` and `profiles` names. Some roadmap and planning text still uses the earlier conceptual names or mixed naming.

Risk:
Future plans may build against the wrong table names, wrong generated types, or wrong RLS assumptions.

Required fix:
Before creating Phase 2 plans, update roadmap and phase templates to use the current live schema names, or explicitly define a migration that renames tables. Do not let agents infer the mapping.

### 4. Phase 6 Needs Immediate Refresh After The RLS Review

Recent review work changed the availability flag public-read model:

- Direct `availability_flags` SELECT is revoked from `anon` and `authenticated`.
- Public reads should use `availability_flags_public`.
- Shadowban filtering is enforced in the owner-context view.

Risk:
Phase 6 currently says `flag_location` and availability flags need expiry enforcement, but it does not yet encode this revised view/RLS contract.

Required fix:
Phase 6 context and plan must explicitly treat `availability_flags_public` as the public read path and prevent future grants from reopening base-table `reporter_id`.

### 5. Phase 2 Is The Next Planning Bottleneck

Phase 2 has the highest immediate need for articulation because it unlocks protected routes, profile creation, and the later mutation phases.

Required Phase 2 additions:

- Auth session provider design.
- Current `users` table profile model.
- Signup/profile auto-create trigger or RPC design.
- Google OAuth deep-link contract.
- Apple Sign-In stub and blocker treatment.
- RLS tests for user self-read and no self-update of trust/moderation fields.
- No PII logging rule for auth errors.

### 6. Verification Is Too Thin Outside Phase 1

Phases 2-9 list success criteria but not executable verification commands. For security-sensitive phases, success criteria must map to tests or SQL assertions.

Required fix:
Each phase should include a validation matrix like Phase 1:

- Behavior.
- Test type.
- Command or SQL assertion.
- Expected output.
- Reviewer focus.

## Recommended Remediation Order

1. Update `.planning/ROADMAP.md` to mark Phases 2-9 as "roadmap articulated, plan pending" rather than implicitly execution-ready.
2. Reconcile table names in roadmap and planning docs after the remote schema recovery.
3. Create Phase 2 context, research, validation, and `02-01-PLAN.md`.
4. Refresh Phase 6 notes now that `availability_flags_public` is the public read path.
5. Create phase artifacts for Phases 3-9 one phase at a time, immediately before implementation, so current schema and dependency facts stay fresh.

## Minimum Definition Of A Well-Articulated GSD Phase

A phase is well articulated only when it has:

- `CONTEXT`: current state, decisions, blockers, schema/table contracts, and out-of-scope items.
- `RESEARCH`: implementation patterns, pitfalls, dependency docs, and alternatives rejected.
- `VALIDATION`: behavior-to-test matrix and required commands.
- `PLAN`: task sequence with files, read-first context, exact actions, verification, done state, threat model, review gate, and output summary.
- `SUMMARY`: created after execution with actual results, deviations, verification evidence, and reviewer verdicts.

By this standard, Phase 1 is close. Phases 2-9 are not yet well articulated enough to execute safely.
