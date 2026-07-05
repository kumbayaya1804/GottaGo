# Skill: Pitfall Scan

## Purpose

Detect known Gotta Go domain traps before implementation or review approval.

## Source

Primary pitfalls file: `.planning/research/PITFALLS.md`.

If that file is missing, stop and report the missing source instead of inventing pitfalls.

## Workflow

1. Read only the relevant headings or search hits from `.planning/research/PITFALLS.md`.
2. Map proposed changes to CRITICAL and MAJOR pitfalls first.
3. For each match, cite the pitfall and require the documented prevention strategy in the plan or implementation.
4. Expand to full pitfall sections only when the excerpt is insufficient.

## Common Trigger Areas

- PostGIS units, SRID, and index usage.
- GPS verification and physical-presence assumptions.
- Shadowban filtering and RLS placement.
- Trust/confidence weighting.
- Emergency UX fallback behavior.
- Prompt, review, and planning artifacts that can drift from actual code.
