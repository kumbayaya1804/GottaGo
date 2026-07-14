# Phase 5: Trust Engine + Verification - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 builds the trust/verification engine that turns a Phase-4-staged `submissions` row into a published, publicly-visible `locations` row: a second-user candidate-discovery path, a weighted verification-event model, the atomic two-verification publish transaction, numeric confidence, a private personal-impact stat, and a publication push notification (pipeline built in-phase, live credentials deployed behind a separate checkpoint). Device attestation/fraud-hardening beyond client GPS telemetry, the 48-hour no-flag auto-promote route, and any UI/UX work beyond what's needed to support the above are explicitly out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Candidate discovery
- **D-35:** Pending-candidate discovery uses a tight, fixed 500m radius (not the wider public-search radius) — verification implies real proximity.
- **D-36:** The discovery RPC is per-user rate-limited via a cooldown (e.g. one call per few seconds); a rejected verification attempt (mock-location or below-accuracy-floor) still consumes the cooldown, to prevent retry-loop abuse.
- **D-37:** Discovery returns a small capped result set (5-10 candidates), excludes the caller's own submissions, and excludes submissions the caller has already recorded a verification event for.
- **D-38:** Shadowbanned users may still call discovery and submit verification events — their events are accepted but always carry `weight = 0` (consistent with existing shadowban semantics elsewhere in the app).

### Event model
- **D-39:** `verification_events` is evolved, not replaced: add nullable `submission_id` (FK to `submissions`), make `location_id` nullable, and add a constraint requiring exactly one of `submission_id` / `location_id`. Matches 05-READINESS.md's recommended direction — avoids a second parallel event system.
- **D-40:** Raw GPS evidence (exact lat/lng) is retained for a short, explicit fraud/audit window, then purged — derived distance/accuracy is retained permanently for trust math. The creator's own initial submission claim gets the same treatment once `submit_location` is updated to write full weight-input evidence for it.
- **D-41:** Account deletion purges raw GPS immediately regardless of where the retention window stands — consistent with the project's existing immediate/anonymizing account-deletion policy (Phase 2).
- **D-42:** Existing Phase 4 pending rows with no stored creator GPS accuracy/fix-time evidence are grandfathered: the existing `confirmation_count = 1` claim stands as-is, nothing is fabricated, and they publish normally once a second verifier confirms.
- **D-43:** A uniqueness rule prevents the same user from counting twice for the same pending submission (mechanism left to planner/researcher).

### Presence assurance & fraud controls
- **D-44:** Client-reported GPS telemetry (device GPS + accuracy + mocked-location flag) is the accepted MVP presence-assurance level for Phase 5 — explicitly documented as abuse-resistant, not tamper-proof. True device attestation (Play Integrity / App Attest) is deferred to a later phase.
- **D-45:** A verification event submitted with the client's mocked-location flag `true` is rejected outright (matches `submit_location`'s existing `p_mocked` handling) — not silently accepted at `weight = 0`.
- **D-46:** A hard minimum GPS-accuracy floor (e.g. ~100m) rejects a verification event outright, separate from and in addition to the linear accuracy-decay curve — a very inaccurate fix shouldn't be allowed to contribute any nonzero weight.

### Trust scoring
- **D-47:** `trust_score` keeps its live 0-9 integer range and default of 9 — no rescale/backfill migration.
- **D-48:** `trust_score` and `trust_multiplier` are two **distinct axes**, not one derived from the other. (Discovered during discussion: dividing `trust_score` by 9 would give a brand-new user the maximum 1.0 multiplier on day one, contradicting the live 0.5 default — the two fields track different things.) `trust_multiplier` is bounded 0.0-1.0 and ramps up from a 0.5 floor toward 1.0 as the user accrues **accepted verification events they've given** (not account age). `trust_score` is the reputation counter driven by the standard action-delta set below.
- **D-49:** `trust_score` action deltas use a standard set: positive for a published contribution, a real-weight (nonzero) verification event given, and no upheld reports on the user's own submissions; negative for an upheld report / shadowban action, a submission rejected as invalid/duplicate, or a verification later found fraudulent. Deltas are **asymmetric** — penalties are larger in magnitude than rewards (standard anti-abuse practice; makes bad-faith behavior costly fast). Claude drafts the exact `action_type`/delta table for review before it's locked into a migration.
- **D-50:** Creator submission does **not** earn trust before publication — trust only moves after independent (second-user) confirmation. Reduces incentive to spam low-quality submissions purely to farm trust.
- **D-51:** `trust_score` and `shadowban_status` remain fully separate — `trust_score` reaching its floor does **not** auto-trigger a shadowban; shadowban stays a distinct, reviewed moderation action.
- **D-52:** If a user is later shadowbanned, their historical (already-recorded) contributions are **not rewritten or deleted** — immutable events stay as-is for audit purposes — but any future recomputation of aggregates treats that user's past events as ineligible going forward.

### Confidence scoring
- **D-53:** Add a new numeric confidence column on `locations` (canonical source of truth), backfill it from the existing text tiers, and derive `confidence_tier` as a read-only computed label from the numeric value going forward. Do not repurpose `respect_signal_score` (different aggregate) or make the separate `confidence_scores` table the source of truth.
- **D-54:** Confidence-tier numeric thresholds (High/Medium/Low cutoffs) are Claude's discretion — a documented, `app_config`-tunable default, not a user-dictated exact value.
- **D-55:** A newly published location (right after meeting the 2-verification threshold) starts at a **mid-tier** confidence value, not the maximum — two confirmations is real but minimal evidence, and confidence should still visibly rise with continued verification activity.
- **D-56:** Proximity and GPS-accuracy decay use a **linear** decay curve to zero at the discovery radius edge (500m) — simple, predictable, and matches D-35's radius as the natural falloff boundary.

### Publication + lifecycle
- **D-57:** The two-verification publish transition (creating the `locations` row, setting `submissions.location_id`/`status`, copying staged accessibility tags, carrying over any staged `pending_access_code`) happens as a **single atomic DB transaction** — no partial-publish state is ever visible.
- **D-58:** Withdrawal after a verification event already exists for a submission does **not** hard-delete it — the submission moves to a `cancelled` status instead, preserving the immutable event audit trail. The verifier's already-recorded event still counts toward their own `trust_multiplier` ramp (D-48) even though the submission never published — cancellation shouldn't retroactively erase real verification work.
- **D-59:** A submission that expires (14 days, existing `expires_at` default) without reaching two verifications moves to `status = 'expired'` — the row is retained, not deleted, matching the same audit-preserving pattern as cancellation.
- **D-60:** The 48-hour no-flag auto-promote route is **deferred** — ship a disabled, fail-closed stub documenting the intent, but do not build a real auto-promotion path this phase. There is no measurable "no pending objection" signal today (`reports.location_id` is `NOT NULL`; pending submissions have none).
- **D-61:** The creator sees a pending-submission progress indicator (e.g. "1/2 verifications received") without exposing verifier identity or location — motivating feedback without a new privacy surface.

### Accessibility staging
- **D-62:** Changing-table/wheelchair selections are staged in a normalized `submission_tags` staging table (not client-only state, not ad hoc `locations` booleans), copied atomically into `tags` during the D-57 publish transaction.
- **D-63:** `submission_tags` supports exactly the 2 existing keys (`changing_table`, `wheelchair`) for Phase 5 — matches what SubmitFlow already renders and what the live `tags` table already models. No broader open-ended key set.
- **D-64:** Existing Phase 4 pending rows with no stored accessibility selections at all (the checkboxes were rendered but discarded pre-Phase-5) publish **untagged**, with no reconfirmation required from the creator — don't fabricate data that was never captured.

### Personal impact stat
- **D-65:** The private Profile impact stat uses a "distinct bathrooms helped" framing (e.g. "You've helped verify N bathrooms") — counts distinct published locations the user gave a qualifying non-zero-weight verification for, not raw event volume or a fabricated "people helped" estimate. Server-maintained via `users.gps_verified_contribution_count` (currently unused, per 05-READINESS.md). Private, non-comparative — no rankings, badges, or leaderboards.

### Notifications
- **D-66:** Push-notification delivery is **not required for Phase 5 to close**. Build the full pipeline in-phase (client permission priming, token registration, an owner-scoped device-token table with RLS, an idempotent outbox, and an authenticated Edge Function that drains the outbox and calls Expo), but live push credentials/deployment is its own separately-authorized checkpoint — same pattern already used for live Supabase pushes on this project.
- **D-67:** The publication notification goes to the **creator only**, not to verifiers — verifiers get the D-65 personal-impact stat as their own feedback loop instead. Keeps the notification narrow and non-spammy per 05-READINESS.md's explicit scope limit.
- **D-68:** If push permission was denied or no device token is registered, the user still gets an **in-app fallback signal** — the D-61 progress indicator naturally resolves to a "Published!" state on next view. Push must never be the only way a contributor learns their submission published.

### Post-planning decisions (surfaced during plan review, not the original discussion)
- **D-69:** A submission whose creator is CURRENTLY shadowbanned at the publish decision still counts the creator's implicit claim toward the publish threshold (the verifier's real contribution is preserved and still counts), and the resulting `locations` row inherits `shadowban_status=true` from the creator (reusing the exact suppression mechanism Phase 3's public search RPCs already apply), but the creator receives NO `published_contribution` trust_events credit for a submission that is immediately suppressed. A non-shadowbanned creator's publish behaves exactly as originally specified. (Confirmed by the round-6 plan review; the creator's CURRENT shadowban_status must be read under a genuine `FOR SHARE` lock on the creator's `users` row — not a plain SELECT, and not covered by the unrelated `submissions` row's `FOR UPDATE` from a different table — to serialize correctly against a concurrent shadowban action.)

### Claude's Discretion
- Exact uniqueness-constraint mechanism preventing a user from double-counting on the same submission (D-43) — implementation detail for planner.
- Exact `trust_score` action_type/delta table values (D-49) — Claude drafts, presented for review before being locked into a migration.
- Exact confidence-tier numeric thresholds (D-54) and initial numeric confidence value mapping to the D-55 mid-tier starting point.
- Exact linear decay formula constants for proximity/accuracy (D-56), tunable via `app_config`.
- Row-locking/concurrency strategy for the second (deciding) verification event race — technical implementation detail, not a product decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 planning inputs (primary)
- `.planning/phases/05-trust-engine-verification/05-READINESS.md` — full architecture-gap analysis; recommended directions for all 8 gaps; recommended plan split (05-01 through 05-06)
- `.planning/phases/05-trust-engine-verification/05-DISCUSSION-DRAFT.md` — decision worksheet with recommended defaults; superseded by the locked decisions above where they conflict
- `.planning/phases/05-trust-engine-verification/05-DISCUSS-CHECKPOINT.json` — full question-by-question discussion record (historical/audit only, not a planning input)

### Schema authority
- `docs/schema-contract.md` — current live schema; will need Phase 5 updates for `verification_events` (D-39), the new confidence column (D-53), `submission_tags` (D-62), and any new `trust_events`/`app_config` entries
- `docs/SYSTEM_MAP.md` — high-level architecture map; Trust Engine section explicitly marked NOT YET BUILT — Phase 5 implements it

### Prior-phase decisions this phase must not violate
- 04-CONTEXT.md D-22 (access-code freshness), D-24 (stage-then-confirm PIN flow), D-26 (pending submissions via separate RPC, not a JOIN), D-29 (withdrawal hard-deletes — **superseded by D-58 above** once a verification event exists)
- `.planning/PROJECT.md` §Key Decisions — 2-verification publish threshold (now correctly labeled "Decided — Phase 5, not yet built" per the 2026-07-11 authority-doc refresh)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_my_pending_submissions()` RPC pattern (Phase 4) — the new discovery RPC (D-35/D-36/D-37) should follow the same SECURITY DEFINER, `auth.uid()`-scoped, explicit-safe-columns style
- `submit_location`'s existing `p_mocked` handling — D-45's reject-on-mock behavior should reuse this exact pattern rather than inventing a new one
- `app_config` table — already used for tunable values (`max_pins`, etc.); D-54/D-56/D-65's tunable constants belong here

### Established Patterns
- SECURITY DEFINER RPCs as the only client write surface (Phase 3/4 convention) — Phase 5's publish transaction, verification-submit RPC, and any trust/confidence recomputation must follow this, not new direct client writes
- Server-computed everything (distance, weight, aggregates) — never trust client-supplied derived values, only raw telemetry inputs

### Integration Points
- `LocationDetailSheet.tsx` / Nearby / Profile screens (Phase 3/4) will need new UI for: pending-progress indicator (D-61), personal impact stat (D-65), and verification candidate surface (05-03 per the recommended plan split) — UI work itself belongs to plan 05-03, not this context

</code_context>

<specifics>
## Specific Ideas

No specific UI mockups or exact copy were dictated beyond the "distinct bathrooms helped" framing (D-65) and the general non-comparative constraint already established in `.planning/PROJECT.md`'s Key Decisions table. Exact wording for the impact stat and any UI copy is left to planning/implementation, consistent with the existing "no fabricated numbers, no rankings" standing decision.

</specifics>

<deferred>
## Deferred Ideas

- **Device attestation / stronger fraud controls** (Play Integrity API / App Attest) — explicitly deferred past Phase 5 per D-44; client GPS telemetry is the accepted MVP assurance level for now.
- **48-hour no-flag auto-promotion** — deferred per D-60 until a real pending-objection signal exists (likely tied to Phase 7's report/duplicate-location work, per RC-02 in `.planning/PROJECT.md`).
- **Verifier-side publication notification** — deferred per D-67; only the creator is notified in Phase 5.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 5's scope during discussion.

</deferred>

---

*Phase: 05-trust-engine-verification*
*Context gathered: 2026-07-11*
