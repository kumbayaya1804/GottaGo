# Project Skills: Gotta Go

These skills define specialized workflows and audit rules for Gotta Go. Load this index first, then load only the specific skill that matches the current task.

## Domain Review Skills

- [PostGIS Optimizer](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/postgis_optimizer.md) - Geospatial SQL, RPC, index, SRID, and meter-unit audits.
- [RLS Security Guard](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/rls_security_guard.md) - RLS, privacy, role, public-read, and shadowban enforcement audits.
- [Trust Engine Validator](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/trust_engine_validator.md) - Trust, confidence, decay, publication, and aggregate validation.

## Workflow Skills

- [Pitfall Scan](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/pitfall_scan.md) - Focused checks against `.planning/research/PITFALLS.md`.
- [Stale Info Scan](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/stale_info_scan.md) - Periodic drift scans across docs, code, migrations, prompts, and planning artifacts.
- [Review Packet Generator](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/review_packet_generator.md) - Tiered Antigravity and Codex packet generation.

Vendored Supabase and Postgres best-practices references may exist under `.claude/skills/` or `.agents/skills/`; load them only for Supabase/Postgres tasks.

Phase lifecycle management is handled by the globally installed GSD plugin (`/gsd-execute-phase`, `/gsd-progress`, etc.). No project-local `gsd_orchestrator.md` is needed.
