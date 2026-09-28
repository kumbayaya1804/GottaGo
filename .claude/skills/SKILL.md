# Project Skills: Gotta Go

These skills define specialized workflows and audit rules for Gotta Go. Load this index first, then load only the specific skill that matches the current task.

## Domain Review Skills

- [PostGIS Optimizer](postgis_optimizer.md) - Geospatial SQL, RPC, index, SRID, and meter-unit audits.
- [RLS Security Guard](rls_security_guard.md) - RLS, privacy, role, public-read, and shadowban enforcement audits.
- [Trust Engine Validator](trust_engine_validator.md) - Trust, confidence, decay, publication, and aggregate validation.

## Workflow Skills

- [Artifact QA Gate](artifact_qa_gate.md) - Mandatory shared evidence gate for artifact work, with separate Codex and Antigravity reviewer overlays.
- [Pitfall Scan](pitfall_scan.md) - Focused checks against `.planning/research/PITFALLS.md`.
- [Stale Info Scan](stale_info_scan.md) - Periodic drift scans across docs, code, migrations, prompts, and planning artifacts.
- [Review Packet Generator](review_packet_generator.md) - Tiered Antigravity and Codex packet generation.

## Superpowers Composition

When the current harness exposes Superpowers, invoke `superpowers:using-superpowers`
before task actions, then only the skills whose trigger matches the task. The most
common pairings are `systematic-debugging` for failures, `test-driven-development` for
implementation, `writing-skills` for skill work, `receiving-code-review` for finding
remediation, and `verification-before-completion` before completion or approval claims.
The shared Artifact QA Gate remains mandatory for artifact work and review.

Vendored Supabase and Postgres best-practices references may exist under `.claude/skills/` or `.agents/skills/`; load them only for Supabase/Postgres tasks.

Phase lifecycle management is handled by the globally installed GSD plugin in its lean `core` profile (`/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase`). No project-local `gsd_orchestrator.md` is needed.
