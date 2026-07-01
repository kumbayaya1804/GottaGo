# Skill: Stale Info Scan

## Purpose
Run the periodic stale-information scan so drift in docs, code, migrations, prompts, and planning artifacts is caught before it misleads Claude, Antigravity, Codex, or a human decision.

## Trigger
- Every 30 calendar days while the project is active.
- Before any phase transition, including `/gsd-transition`.
- Before closing a milestone, including `/gsd:complete-milestone`.
- After dependency, SDK, Supabase, Mapbox, Expo, auth, schema, migration, or harness changes.
- Before TestFlight, app-store submission, public launch, or a new market launch.
- Whenever a reviewer reports possible drift between docs, code, migrations, or generated types.

Claude's Stop hook also checks whether `.planning/stale-info-scan-latest.md` is missing or older than 30 days and reminds the agent to run this.

## Workflow
1. Read the full procedure in [docs/stale-info-scan.md](file:///C:/Users/mrsai/Gotta%20Go/docs/stale-info-scan.md) — it defines the Required Checks (Agent Harness Drift, Product And Brand Drift, Schema And Supabase Drift, Dependency And Tool Drift, Claude Model Drift, Codex And Antigravity Prompt Drift, Planning And Status Drift, Security And Privacy Drift) and the Standard Local Commands to run.
2. Run the commands listed under "Standard Local Commands" in that doc, plus any that apply to the current trigger (e.g. a schema check after a migration change).
3. Classify every finding as `BLOCKING STALE INFO`, `UPDATE REQUIRED`, `WATCH`, or `CURRENT` per the severity definitions in the doc.
4. Write or refresh `.planning/stale-info-scan-latest.md` using the Scan Report Template at the bottom of `docs/stale-info-scan.md`.
5. Fix or explicitly defer (with owner and reason) every `BLOCKING STALE INFO` and `UPDATE REQUIRED` finding before the related phase, milestone, release, or commit closes.
