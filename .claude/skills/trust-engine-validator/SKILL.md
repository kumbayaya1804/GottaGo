---
name: trust-engine-validator
description: Use when a Gotta Go migration, RPC, trigger, scheduled job, or app change touches verification events, confidence or trust scores, decay, publication thresholds, respect signals, aggregates, or shadowban influence.
---

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
- A decision that depends on another user's shadowban or trust state (the creator, earlier verifiers, the caller) reads that state from a row locked in the same transaction: `FOR NO KEY UPDATE` if the transaction later updates the row, otherwise `FOR SHARE`. A plain SELECT lets a concurrent shadowban commit between the read and the decision.
- Lock every involved `users` row in a single pass, in ascending `id` order, before reading or updating any of them. Updating the caller and then the creator deadlocks against a reciprocal call (see `lock-deadlock-prevention` in `supabase-postgres-best-practices`).
- `users.trust_score` is nullable (`default 9`, no `NOT NULL`). `greatest` and `least` ignore NULL, so `least(9, greatest(0, trust_score + d))` turns a NULL score into 0. Anchor every clamp on `coalesce(trust_score, 9)`.
- `trust_score` and `trust_multiplier` are independent axes; neither is derived from the other (`.planning/phases/05-*/05-CONTEXT.md`, D-48).
- A shadowbanned creator's publish is suppressed and earns no `published_contribution` credit (same file, D-69).

## Workflow

1. Trace the chain from event insert to confidence/trust/aggregate update.
2. Identify all config keys and thresholds used.
3. Check boundary cases: zero trust, null coordinates, duplicate users, shadowbanned users, deleted locations, expired signals, and stale confirmations.
4. Compare tests to production triggers/RPCs; flag mock-only tests that do not exercise the enforcing layer.
