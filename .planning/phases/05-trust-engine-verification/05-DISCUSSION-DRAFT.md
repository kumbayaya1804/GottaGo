---
phase: 05-trust-engine-verification
status: awaiting_decisions
created: 2026-07-09
source: 05-READINESS.md
---

# Phase 5 Decision Worksheet

## Purpose

Phase 5 is ready for product and architecture discussion, not executable planning.
This worksheet isolates the decisions that change schema authority, privacy, trust
math, publication behavior, or deployment scope. Approved answers will become
`05-CONTEXT.md`; unresolved items must not be guessed by implementation agents.

## Recommended Defaults

1. **Candidate discovery:** authenticated, proximity-bounded RPC; exclude the caller's
   submissions; return recognition fields and server-computed distance only; no global
   pending feed or submitter identity; cap results and rate-limit calls.
2. **Presence assurance:** accept server-validated client GPS telemetry for MVP, state
   that it is abuse-resistant rather than tamper-proof, and defer device attestation.
3. **GPS evidence:** retain exact raw coordinates in the private event surface for a
   short, explicit fraud/audit window; retain derived distance/accuracy after raw GPS
   expiry. Final duration and account-deletion behavior require approval.
4. **Event/lifecycle:** immutable submission-linked events; no direct client inserts;
   after third-party evidence exists, withdrawal changes the submission to `cancelled`
   rather than deleting it. Expiry follows the same retained-history pattern.
5. **Publication:** two distinct, eligible, non-shadowbanned identities; server-computed
   weights; one locked transaction; duplicate retries return the existing outcome.
6. **48-hour route:** defer promotion until pending objections can be recorded. Any
   Phase 5 stub is disabled and fail-closed.
7. **Confidence:** one checked numeric canonical score with a derived display tier.
   Initial value, thresholds, clamping, and legacy backfill remain to be chosen.
8. **Trust:** bounded score and multiplier, append-only trust events, server-owned
   deltas, and tunable decay constants. The exact ranges and equations remain to be
   chosen; do not infer them from current defaults.
9. **Historical shadowban:** do not rewrite immutable events; exclude newly ineligible
   contributions during aggregate recomputation unless an explicit moderation audit
   restores them.
10. **Personal impact:** count distinct published bathrooms to which the user supplied
    a qualifying non-zero verification, not raw event volume or estimated people helped.
11. **Notifications:** keep Phase 5 notification infrastructure in scope, but make live
    credentials/deployment a fresh human checkpoint. Use a private token table and
    idempotent outbox.
12. **Accessibility staging:** persist allowed submission accessibility choices in a
    normalized staging relation and copy them to `tags` in the atomic publish
    transaction. Existing pending rows remain explicitly untagged unless reconfirmed.

## Decisions Requiring Human Approval

1. Pending-candidate location precision and result-radius UX.
2. Raw GPS retention duration and deletion/account-deletion treatment.
3. Trust-score range, multiplier mapping, action delta table, proximity curve, and
   accuracy curve.
4. Numeric confidence range, initial score, tier thresholds, and backfill policy.
5. Treatment of Phase 4 pending rows that lack creator accuracy/fix-time evidence.
6. Withdrawal behavior after evidence, including whether creator cancellation can
   prevent publication after two otherwise valid identities exist.
7. Whether later shadowbans exclude historical events from future recomputation.
8. Exact private Profile copy for the distinct-published-bathroom impact count.
9. Whether notification delivery itself is required for Phase 5 closure or whether a
   verified outbox plus tracked deployment checkpoint is sufficient.
10. Whether existing Phase 4 pending submissions may publish without accessibility
    tags or require the creator to reconfirm those choices.

## Planning Gate

After the decisions above are approved:

1. Convert them verbatim into `05-CONTEXT.md` decision IDs.
2. Reconcile `docs/schema-contract.md` and the Phase 5 roadmap.
3. Write plans 05-01 through 05-06 with explicit migrations, RPC contracts, client
   call sites, mocks, pgTAP/Jest coverage, device UAT, and live-operation checkpoints.
4. Run Antigravity and separate Codex plan review before implementation.
