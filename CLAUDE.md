# Project Instructions

This project uses [metaswarm](https://github.com/dsifry/metaswarm) for multi-agent orchestration.

**First-time setup:** Run `/metaswarm-setup` in Claude Code to detect your project and configure everything.

**Update metaswarm:** Run `/metaswarm-update-version` to check for and apply updates.

---

## Session Startup Protocol — Read These Before Any Work

Before writing a single line of code, reviewing a file, or making a plan, every agent (Claude, Antigravity, Codex) must read the following files in full:

1. **`AGENTS_ROSTER.md`** — all agents, roles, invocation, and the complete review workflow
2. **`AGENTS.md`** — coordination rules, conflict resolution, non-negotiables
3. **`SPEC.md`** — product scope, user flows, GPS, privacy, trust, shadowban, gamification
4. **`docs/schema-contract.md`** — database contract, RLS rules, migration review checklist
5. **`docs/review-severity.md`** — APPROVE / REQUEST CHANGES / BLOCK verdict definitions
6. **`docs/verification.md`** — required verification commands and reporting format
7. **`docs/stale-info-scan.md`** — periodic scan cadence for stale docs, prompts, schema, dependencies, and plans
8. **`.planning/PROJECT.md`** — current requirements, constraints, key decisions, build order
9. **`ANTIGRAVITY.md`** — Antigravity's operating instructions
10. **`CODEX.md`** — Codex's operating instructions

All agents must also read `docs/agent-harness.md` before any planning, implementation, or review work. It is the source of truth for Claude/Antigravity/Codex orchestration, review artifacts, handoffs, permission posture, and commit gates.

Claude must run `/stale-info-scan` on the cadence in `docs/stale-info-scan.md`: every 30 days while active, before phase transitions, before milestone close, after dependency/tool/schema/harness changes, and before release or new-market launch.

**If you are Antigravity:** also read `ANTIGRAVITY.md` before reviewing anything.
**If you are Codex:** also read `CODEX.md` and the current `.claude/codex-prompt-latest.md` before reviewing anything. If the prompt file is missing for a review request, say so instead of guessing the scope.

Skipping this startup read is not allowed. These documents are the source of truth. Implementation that conflicts with them must either update the docs in the same change or flag the conflict for human review.

---

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Gotta Go**

Gotta Go is a crowdsourced mobile app that helps people find usable bathrooms when they urgently need one. Unlike static directories, it collects time-sensitive bathroom access codes (PINs), community-verified policy tags, quality ratings, and optimal timing windows — the kind of hyperlocal knowledge that exists only in people's heads. The parent segment is the primary acquisition wedge: parents with toddlers face bathroom urgency as a genuine crisis, and changing table data is a high-signal differentiator nobody else is collecting systematically.

**Core Value:** When you urgently need a bathroom, Gotta Go finds you one with accurate, community-verified access info — including the current door code.

### Constraints

- **Tech Stack**: Expo (React Native) — iOS + Android, GPS-first UX. Supabase + PostGIS for DB/auth. Mapbox for mapping. Already committed to from prior design work.
- **Data Integrity**: Minimum 2 independent GPS verifications (or 1 + 48hr no-flag window) before location publishes. Single-verification threshold is an unacceptable abuse surface.
- **Liability**: Policy tags use community-reported framing, not declarative. "Users report this as accessible" not "this place allows free use." Moves liability to crowd, not platform.
- **Gamification ordering**: If reward tiers are implemented, "Just used this" freshness confirmation must be lowest-reward or capped per location/user/window — not 3rd highest as in original design.
- **Eugene density requirement**: 50 locations is the floor, but coverage type matters more than count.
- **Security**: No raw SQL strings unless migrations or safely parameterized server-only code. GPS coordinates in PostGIS geometry/geography columns only. No PII in logs.
- **Review gate**: No commit without APPROVE from both Antigravity and Codex (or all BLOCK/REQUEST CHANGES resolved).
- **Multi-agent review (Claude + Antigravity + Codex)**: No self-approval; PostGIS correctness audited by Antigravity; security/privacy audited by Codex. Review workflow: Claude implements → logs files to `.claude/review-queue.txt` → Antigravity + Codex review → address all BLOCK/REQUEST CHANGES → commit with reviewer verdicts.
- **Harness contract**: Follow `docs/agent-harness.md`. Reviewer artifacts are `.claude/antigravity-review-latest.md`, `.claude/codex-prompt-latest.md`, and `.claude/codex-review-latest.md`.
- **Stale-info scan**: Follow `docs/stale-info-scan.md`. The latest scan artifact is `.planning/stale-info-scan-latest.md`; unresolved findings that affect the current task must be fixed or explicitly deferred before commit.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
