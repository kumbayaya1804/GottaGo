# Skill: Trust Engine Validator

## Purpose
Validate the logical integrity of the trust, confidence, and decay systems.

## Constraints
- **Multi-Verification**: New locations must remain pending until 2 independent non-shadowbanned verifications.
- **Weighting**: Verification weight must be a product of `user_trust * proximity_decay * accuracy_decay`.
- **Decay**: Confidence decay must be deterministic and apply the half-life from `app_config`.
- **Shadowban Influence**: Shadowbanned users must have exactly 0 influence on public aggregates.

## Workflow
1. Trace the trigger chain from `verification_events` insert.
2. Verify the `recalc_confidence` function logic.
3. Check `app_config` for correctly seeded thresholds.
