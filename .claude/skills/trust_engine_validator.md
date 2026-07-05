# Skill: Trust Engine Validator

## Purpose

Validate trust, confidence, publication, decay, and aggregate logic without hardcoding stale formulas.

## Load When

- migrations, RPCs, triggers, scheduled jobs, or app code touch verification events, confidence, trust scores, respect signals, publication thresholds, or shadowban influence

## Context To Read

- affected SQL functions/triggers/RPCs
- relevant `docs/schema-contract.md` and `SPEC.md` excerpts
- `app_config` seed values or runtime configuration used by the logic
- tests around verification, confidence, trust, decay, and aggregates

## Rules

- New locations must not publish before the configured independent-verification threshold is satisfied.
- Shadowbanned users must have zero influence on public aggregates and publication decisions.
- Trust and confidence math must be deterministic, auditable, and sourced from current schema/configuration, not a stale prompt formula.
- Decay behavior must use the configured half-life/floor values and handle stale, null, deleted, and suppressed inputs.
- Rewards must not incentivize low-quality spam over useful, recent, physically present confirmation.

## Workflow

1. Trace the chain from event insert to confidence/trust/aggregate update.
2. Identify all config keys and thresholds used.
3. Check boundary cases: zero trust, null coordinates, duplicate users, shadowbanned users, deleted locations, expired signals, and stale confirmations.
4. Compare tests to production triggers/RPCs; flag mock-only tests that do not exercise the enforcing layer.
