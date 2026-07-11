# Phase 5: Trust Engine + Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `05-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 05-trust-engine-verification
**Areas discussed:** Candidate discovery + event model, Trust + confidence scoring, Publication + lifecycle rules, Notifications/impact stat/accessibility staging

---

## Candidate discovery + event model

| # | Question | Options presented | Selected |
|---|----------|--------------------|----------|
| 1 | How should a verifier discover a pending candidate? | Match public search radius / Tighter fixed radius / You decide | **Tighter fixed radius** |
| 2 | Exact fixed radius value | 200m / 500m / You decide | **500m** |
| 3 | Rate limiting on the discovery RPC | Per-user cooldown / No explicit rate limit | **Per-user cooldown** |
| 4 | Max candidates returned per call | Small cap (5-10) / You decide | **Small cap (5-10)** |
| 5 | Shadowbanned users and discovery/events | Yes, weight=0 / Block discovery entirely | **Yes, weight=0** |
| 6 | Raw GPS evidence retention duration | Short window then purge / Retain indefinitely / Purge immediately | **Short window then purge raw** |
| 7 | Legacy Phase 4 pending rows with no evidence | Grandfather claim / Require re-verification / You decide | **Grandfather existing claim** |
| 8 | How should verification_events represent pre-pub verification | Evolve existing table / New separate table | **Evolve existing table** |
| 9 | Account deletion during GPS retention window | Purge immediately / Keep until window expires | **Purge raw GPS immediately** |
| 10 | Creator's own claim — same GPS retention treatment? | Yes, same treatment / You decide | **Yes, same treatment** |
| 11 | Re-discovery of already-verified candidates | Exclude already-verified / You decide | **No, exclude already-verified** |

**Notes:** The exactly-one-of `submission_id`/`location_id` constraint direction (option 8) matches 05-READINESS.md's own recommendation. Uniqueness-enforcement mechanism and rate-limit exact numbers left to Claude's discretion (implementation detail).

---

## Trust + confidence scoring

| # | Question | Options presented | Selected |
|---|----------|--------------------|----------|
| 1 | trust_score range/start | Keep 0-9 start 9 / Rescale to 0-100 / You decide | **Keep 0-9, start at 9** |
| 2 | trust_multiplier range/mechanism | Bounded 0-1 derived from trust_score / Independent field | **Bounded 0-1, derived** (initially) |
| 3 | trust_score action deltas | Standard set / You decide | **Standard set** |
| 4 | Creator trust before publication? | Only after publication / Small amount immediately | **Only after publication** |
| 5 | **Follow-up:** trust_score=9 default vs trust_multiplier=0.5 default look inverted if multiplier = trust_score/9 — how should the derivation actually map? | Multiplier ramps up from low floor / trust_score default is the actual bug / You decide, investigate further | **Multiplier ramps up from a low floor as trust is earned** (revises #2 — the two fields are distinct axes, not one derived from the other) |
| 6 | What ramps trust_multiplier 0.5→1.0? | Count of accepted verification events given / Time-based / You decide | **Count of accepted verification events given** |
| 7 | Confidence numeric canonical field | New numeric column, migrate tiers / Repurpose confidence_scores table / You decide | **New numeric column, migrate existing text tiers** |
| 8 | Proximity/accuracy decay curve shape | Linear decay to zero at radius edge / Step function / You decide | **Linear decay to zero at discovery radius edge** |
| 9 | Later shadowban and historical contributions | Exclude going forward, don't rewrite / Leave fully counted | **Exclude going forward, don't rewrite history** |
| 10 | Confidence tier numeric thresholds | You decide with documented default / I want to specify | **You decide with a documented default** |
| 11 | Initial confidence for newly published location | Mid-tier starting point / Start at max, decay down | **Mid-tier starting point** |
| 12 | trust_score delta symmetry | Asymmetric, penalties bigger / Symmetric | **Asymmetric — penalties bigger** |
| 13 | Client GPS telemetry as MVP presence assurance? | Accept for MVP / Require device attestation now | **Accept client GPS telemetry for MVP** |
| 14 | Mocked-location flag = true on a verification event | Reject outright / Accept with weight=0 | **Reject outright** |
| 15 | Minimum GPS accuracy hard floor | Yes, hard floor / No, let decay handle it | **Yes, hard floor** |
| 16 | trust_score floor auto-triggers shadowban? | No, keep separate / Yes, auto-shadowban | **No — keep them fully separate** |
| 17 | Rejected event consumes rate-limit cooldown? | Counts toward rate limit / Free retry | **Counts toward rate limit** |

**Notes:** Question 5 is a genuine mid-discussion revision — a live-schema inconsistency (trust_score default 9 vs trust_multiplier default 0.5) was surfaced and resolved by treating the two fields as independent axes rather than accepting the initially-chosen "derived" framing at face value. See `05-CONTEXT.md` D-48.

---

## Publication + lifecycle rules

| # | Question | Options presented | Selected |
|---|----------|--------------------|----------|
| 1 | Publish-transaction atomicity | Single atomic transaction / You decide | **Single atomic transaction** |
| 2 | Withdrawal after a verification event exists | 'Cancelled', not deleted / Withdrawal always wins | **No — becomes 'cancelled', not deleted** |
| 3 | 48-hour no-flag auto-promote route | Defer, disabled stub / Build real signal now | **Defer — disabled, fail-closed stub** |
| 4 | Submission expiry (14 days, unverified) | 'Expired', row retained / You decide | **Status becomes 'expired', row retained** |
| 5 | Creator sees pending-verification progress? | Show progress count / Keep fully opaque | **Show progress count** |
| 6 | Cancelled submission — does verifier's event still count? | Yes, still counts / No, doesn't count | **Yes, it still counts for the verifier** |
| 7 | Staged pending_access_code during publish | Carry over as pending / You decide | **Carry over as pending on the new location** |

---

## Notifications, impact stat, accessibility staging

| # | Question | Options presented | Selected |
|---|----------|--------------------|----------|
| 1 | Is push delivery required for Phase 5 to close? | Ship behind checkpoint / Fully required, must be live | **Ship behind a checkpoint** |
| 2 | Personal impact stat copy/framing | Distinct-bathrooms-helped / You decide wording | **Distinct-bathrooms-helped framing** |
| 3 | Accessibility staging approach | Normalized submission_tags table / You decide | **Normalized submission_tags staging table** |
| 4 | Legacy Phase 4 rows with no accessibility data | Publish untagged, no reconfirmation / Require reconfirmation | **Publish untagged, no reconfirmation required** |
| 5 | Who receives the publication notification? | Creator only / Creator and verifiers | **Creator only** |
| 6 | In-app fallback if push denied/not registered? | Yes, in-app fallback / No, push only | **Yes, in-app fallback** |
| 7 | submission_tags allowed keys | Exactly the 2 existing keys / You decide broader set | **Exactly the 2 existing keys (changing_table, wheelchair)** |

---

## Claude's Discretion

- Uniqueness-constraint mechanism preventing double-counting on the same submission (candidate discovery + event model, Q11 area).
- Exact `trust_score` action_type/delta table values — Claude drafts the full table for review before it's locked into a migration.
- Exact confidence-tier numeric thresholds and the initial numeric value mapping to the "mid-tier" starting point.
- Exact linear decay formula constants for proximity/accuracy weighting (tunable via `app_config`).
- Row-locking/concurrency strategy for the deciding second-verification race condition.

## Deferred Ideas

- Device attestation / stronger fraud controls (Play Integrity API / App Attest) — deferred past Phase 5.
- 48-hour no-flag auto-promotion — deferred until a real pending-objection signal exists (likely tied to Phase 7's report/duplicate-location work).
- Verifier-side publication notification — deferred; only the creator is notified in Phase 5.
