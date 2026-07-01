# Project Skills: Gotta Go

These skills define specialized workflows and subagent personas used to support the development and auditing of the Gotta Go project.

## Review Skills

- [PostGIS Optimizer](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/postgis_optimizer.md) - Auditing geospatial queries and indexing.
- [RLS Security Guard](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/rls_security_guard.md) - Auditing Row Level Security and privacy leaks.
- [Trust Engine Validator](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/trust_engine_validator.md) - Verifying trust math and decay logic.

## Workflow Skills

- [Pitfall Scan](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/pitfall_scan.md) - Automated cross-referencing against PITFALLS.md.
- [Stale Info Scan](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/stale_info_scan.md) - Periodic drift scan across docs, code, migrations, and planning artifacts.
- [Review Packet Generator](file:///C:/Users/mrsai/Gotta%20Go/.claude/skills/review_packet_generator.md) - Generating the Antigravity + Codex review packets correctly.

Phase lifecycle management is handled by the globally-installed GSD plugin (`/gsd-execute-phase`, `/gsd-progress`, etc.) rather than a project-local skill — no `gsd_orchestrator.md` exists here, and none is needed.
