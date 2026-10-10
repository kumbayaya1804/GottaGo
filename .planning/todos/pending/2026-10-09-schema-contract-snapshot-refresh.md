# Refresh the docs/schema-contract.md snapshot after Phase 5

Created: 2026-10-09 from a Codex follow-up note (skills-restructure review, attempt 2).

`docs/schema-contract.md:3` still carries its July snapshot, and its table and RPC descriptions predate the
Phase 5 migrations (`20260717*`, `20260731*`: verification events, numeric confidence, notification outbox,
verify/publish RPCs). Migrations remain the authority. Refresh the snapshot from the live schema in a
full-tier batch (`docs/schema-contract.md` is never low tier).
