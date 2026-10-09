# Project Skills: Gotta Go

These skills define specialized workflows and audit rules for Gotta Go. Load this index first, then load only the specific skill that matches the current task.

## Domain Review Skills

- [PostGIS Optimizer](postgis-optimizer/SKILL.md) - Geospatial SQL, RPC, index, SRID, and meter-unit audits.
- [RLS Security Guard](rls-security-guard/SKILL.md) - RLS, grants, privacy, role, public-read, and shadowban enforcement audits.
- [Trust Engine Validator](trust-engine-validator/SKILL.md) - Trust, confidence, decay, publication, locking, and aggregate validation.
- [pgTAP Testing](pgtap-testing/SKILL.md) - Role and claims discipline, isolated runner, and two-session race tests.
- [User Advocacy Gate](user-advocacy-gate/SKILL.md) - Emergency UX, dead ends, locked error copy, and backend changes users can feel.
- [Privacy PII Guard](privacy-pii-guard/SKILL.md) - Client logging, analytics, and crash-reporting privacy.

## Workflow Skills

- [Artifact QA Gate](artifact_qa_gate.md) - Mandatory shared evidence gate for artifact work, with separate Codex and Antigravity reviewer overlays.
- [Pitfall Scan](pitfall-scan/SKILL.md) - Focused checks against `.planning/research/PITFALLS.md`.
- [Stale Info Scan](stale_info_scan.md) - Periodic drift scans across docs, code, migrations, prompts, and planning artifacts.
- [Review Packet Generator](review_packet_generator.md) - Tiered Antigravity and Codex packet generation.

## Superpowers Composition

When the current harness exposes Superpowers, invoke `superpowers:using-superpowers`
before task actions, then only the skills whose trigger matches the task. The most
common pairings are `systematic-debugging` for failures, `test-driven-development` for
implementation, `writing-skills` for skill work, `receiving-code-review` for finding
remediation, and `verification-before-completion` before completion or approval claims.
The shared Artifact QA Gate remains mandatory for artifact work and review.

Vendored Supabase and Postgres best-practices skills live under `.claude/skills/` (Claude Code) and, as identical copies, under `.agents/skills/` (where Codex discovers repository skills); keep the two copies in sync and load them only for Supabase/Postgres tasks.

Phase lifecycle management is handled by the globally installed GSD plugin in its lean `core` profile (`/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase`). No project-local `gsd_orchestrator.md` is needed.
