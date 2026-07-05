# Skill: Stale Info Scan

## Purpose

Run the periodic stale-information scan so drift in docs, code, migrations, prompts, and planning artifacts is caught before it misleads Claude, Antigravity, Codex, or a human decision.

## Trigger

- Every 30 calendar days while the project is active.
- Before any phase transition.
- Before closing a milestone.
- After dependency, SDK, Supabase, Mapbox, Expo, auth, schema, migration, or harness changes.
- Before TestFlight, app-store submission, public launch, or a new market launch.
- Whenever a reviewer reports possible drift between docs, code, migrations, or generated types.

## Workflow

1. Read `docs/context-router.md`.
2. Read the relevant sections of `docs/stale-info-scan.md`.
3. Search first; expand to full files only after a hit or when the whole file is the scan target.
4. Run the standard local commands from `docs/stale-info-scan.md`, plus trigger-specific checks.
5. Classify findings as `BLOCKING STALE INFO`, `UPDATE REQUIRED`, `WATCH`, or `CURRENT`.
6. Write or refresh `.planning/stale-info-scan-latest.md` using the template in `docs/stale-info-scan.md`.
7. Fix or explicitly defer every `BLOCKING STALE INFO` and `UPDATE REQUIRED` finding before the related phase, milestone, release, or commit closes.
