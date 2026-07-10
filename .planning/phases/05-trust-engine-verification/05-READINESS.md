---
phase: 05-trust-engine-verification
status: ready_for_discussion
created: 2026-07-09
updated: 2026-07-10
source_phase: 04-gps-service-submission
---

# Phase 5 Readiness Audit

## Purpose

This audit carries the completed Phase 4 write path into Phase 5 without reviving
superseded assumptions from the older architecture research. It is planning input,
not an implementation plan and not authorization for a live database push.

Phase 4 is code-complete and externally approved. Its two device walkthroughs and
the Docker-backed pgTAP suites remain tracked verification work, but they do not
block Phase 5 discussion or planning.

Pre-Phase-5 remediation items 1-3 were completed on 2026-07-10. The active search
RPCs are PostGIS-qualified, every legacy radius-RPC overload is removed, the
authenticated INSERT policy on `verification_events` is gone, and the app verification
baseline exits cleanly. A Round 4 live ACL audit found broad client table grants still
present; the local forward migration `20260710121534` removes them and must be reviewed,
deployed with fresh authorization, and live-verified before Phase 5. Phase 5 must then
preserve and regression-test those boundaries rather than scheduling their repair again.

## Confirmed Phase 4 Handoff

- Pending bathroom data exists only on `submissions`; no `locations` row exists
  before publication.
- `submissions.coordinates` is the canonical staged PostGIS geography.
- A new submission starts with `confirmation_count = 1`, representing the creator's
  initial presence claim. Phase 4 deliberately did not insert a pre-publication
  `verification_events` row because `verification_events.location_id` is `NOT NULL`.
- Only the submitter can read a pending submission through
  `get_my_pending_submissions`. Other users currently have no pending-candidate read
  path.
- Public search treats every visible row in `locations` as published. Phase 5 must
  not create a hidden `locations` row unless every public reader is redesigned.
- Direct authenticated inserts into both `locations` and `submissions` are removed;
  state transitions must remain inside authenticated, hardened RPCs.
- Authenticated direct inserts into `verification_events` were removed by
  `20260710000000_phase5prep_drop_verification_events_direct_insert.sql` and
  live-verified, so RLS blocks ordinary client inserts. The local follow-up
  `20260710121534_verification_events_client_write_acl_lockdown.sql` removes the
  remaining broad `anon`/`authenticated` table privileges; it is not live yet. After
  its separately authorized deployment, Phase 5 must preserve the layered lockdown and
  make hardened verification RPCs the only future client write surface.
- Phase 4's access-code stage/confirm flow is separate from location publication.

## Blocking Architecture Gaps

### 1. A verifier cannot discover a pending submission

The map exposes pending pins only to their submitter. A second independent user
therefore has no server or client path to find the submission they are expected to
verify.

**Recommended direction:** add an authenticated, proximity-bounded
`search_pending_submissions_nearby` RPC that:

- returns only the minimum fields required to recognize and verify a candidate;
- excludes the caller's own submissions;
- excludes expired and non-pending rows;
- never returns submitter identity, access code, timing tip, or precise coordinates
  outside the configured verification radius;
- uses PostGIS and an index-friendly distance predicate; and
- has a partial GiST index for pending, unexpired candidates plus a bounded result
  count and abuse/rate controls; and
- feeds a separate verification-candidate UI, not the public-location search RPCs.

The exact discoverability UX is a required Phase 5 discussion decision. Showing all
pending submissions globally would create a new privacy and abuse surface.

### 2. `verification_events` cannot represent pre-publication verification

The table currently requires `location_id`, but a pending submission has no location.
Incrementing only `submissions.confirmation_count` would lose the independent-user
identity, GPS evidence, weight inputs, and uniqueness guarantee needed by Phase 5.

**Recommended direction:** evolve `verification_events` rather than create a second
parallel event system:

1. Add nullable `submission_id` referencing `submissions`.
2. Make `location_id` nullable and add a constraint requiring exactly one of
   `submission_id` or `location_id`.
3. Add the weight inputs needed for an auditable calculation, including GPS accuracy
   and captured-at time, with an explicit retention decision for raw GPS evidence.
4. Add a uniqueness rule preventing the same user from counting twice for the same
   pending submission.
5. Keep pre-publication events immutable and linked to `submission_id`. On
   publication, atomically create the `locations` row and set
   `submissions.location_id/status`; aggregate code can resolve the eventual location
   through that immutable submission link. Do not update or delete event rows.
6. Preserve the existing authenticated direct-insert lockdown on
   `verification_events`; the server must compute actor, event type, distance, and
   weight inside the RPC transaction. Add regression coverage for both denied direct
   writes and allowed server-owned writes.

The submitter and verifier must count as two distinct users. A shadowbanned user may
receive the same accepted response, but their event has `weight = 0` and cannot
satisfy the publication threshold.

Phase 5 must also update `submit_location` so future submissions create an immutable
creator event with the complete weight inputs. Existing pending rows have no stored
accuracy/fix-time evidence; their creator event must not be fabricated. Decide whether
to require a fresh creator re-verification or grandfather only the Phase 4
`confirmation_count = 1` claim for those rows.

Phase 4 currently hard-deletes a pending row when its creator withdraws it. Once an
immutable event references `submission_id`, Phase 5 must choose a compatible lifecycle:
prohibit withdrawal after third-party evidence exists, or retain a cancelled/expired
submission row and its audit history. A cascade that deletes verification evidence is
not acceptable.

### 3. The 48-hour no-flag route cannot currently measure "no flags"

`reports.location_id` is required, while a pending submission has no `location_id`.
An auto-promote job that checks `reports` would therefore always see zero reports and
would provide false safety.

**Required decision:** either:

- add a pending-submission report/duplicate signal before enabling the 48-hour route;
- define a different, measurable veto signal for pending rows; or
- defer auto-promotion and retain the two-distinct-user requirement for MVP.

Recommendation: retain two-user publication until a real pending objection path
exists. A cron stub may document the intended job, but it must fail closed and must
not promote rows merely because the current schema cannot store objections.

### 4. Confidence has no numeric canonical field

Current schema surfaces are inconsistent with Phase 5/6 requirements:

- `locations.confidence_score` is text;
- `locations.confidence_tier` is text;
- `confidence_scores.score` is an enum-like text tier; and
- Phase 6 expects exponential decay over a numeric score.

**Recommended direction:** choose one numeric canonical value before implementing
recalculation. Add or migrate to a numeric confidence value, derive the display tier
from it, and avoid maintaining two writable sources of truth. Do not repurpose
`respect_signal_score`; it represents a different aggregate.

Live data must be inspected before choosing an in-place type conversion versus a new
column and backfill.

### 5. Trust ranges and deltas are unspecified

The live defaults are `trust_score = 9` and `trust_multiplier = 0.5`, but no accepted
range, mapping, or action delta table exists. The roadmap requires
`weight = trust_multiplier * proximity_decay * accuracy_decay`, yet the decay curves
are also undefined.

Phase 5 discussion must lock:

- min/max `trust_score`;
- min/max `trust_multiplier` and how it is derived or updated;
- positive and negative `trust_events.action_type` values and signed deltas;
- proximity and accuracy decay equations, including clamping; and
- whether creator submission earns trust before publication or only after it is
  independently confirmed.

All values should be tunable through `app_config` where operational adjustment is
likely. Tests must assert sign/action consistency and boundary values.

The server must compute every weight, count distinct eligible identities while holding
the pending submission row lock, and make retries idempotent. Discussion must also
decide whether a later shadowban changes historical contributions. Client-supplied GPS,
accuracy, timestamps, and mock flags are telemetry rather than cryptographic proof of
physical presence; Phase 5 must explicitly accept that assurance level or add a
separate device-attestation/fraud-control requirement.

### 6. Push notification infrastructure does not exist

No `expo-notifications` dependency, device-token table, registration flow, Edge
Function, or notification credentials are present. A database trigger cannot safely
send Expo push notifications by itself.

**Recommended direction:** split notification delivery into its own plan:

- client permission priming and token registration;
- an owner-scoped device-token table with RLS and token lifecycle handling;
- an outbox row created atomically when a submission publishes; and
- an authenticated/server-only Edge Function that drains the outbox and calls Expo.

The outbox needs a unique publication/recipient idempotency key. Token revocation,
uninstall handling, and retention must be defined without exposing another user's
tokens or delivery state through RLS.

Keep the Phase 5 notification limited to the contributor's own publication event.
Supabase Cron can run SQL/functions directly, while scheduled Edge Function calls use
`pg_cron` plus `pg_net` and secrets stored in Vault. Current official references:
<https://supabase.com/docs/guides/cron> and
<https://supabase.com/docs/guides/functions/schedule-functions>.

### 7. The personal impact metric needs one definition

The Profile already calls `get_profile_stats()` and displays raw GPS verification,
submission, and rating counts. The schema also has
`users.gps_verified_contribution_count`, currently unused.

Recommendation: make `gps_verified_contribution_count` the server-maintained source
for the Phase 5 private impact statement, incremented only for qualifying, non-zero
weight verification contributions. Do not fabricate downstream reach and do not add
rankings, badges, points, or comparisons.

### 8. Accessibility selections are currently discarded

Phase 4 renders changing-table and wheelchair checkboxes and stores their state only in
the SubmitFlow component. The `submit_location` RPC exposes no matching parameters, so
the selection is neither staged on `submissions` nor written to `tags`. This conflicts
with the Phase 4 requirement that a submission includes access type and would publish a
location without the accessibility data the contributor selected.

**Recommended direction:** add an auditable staged representation before publication.
Prefer a normalized `submission_tags` table, or an equivalently constrained staging
shape, over client-only state or new ad hoc `locations` booleans. Extend
`submit_location` to validate and store the allowed keys, and make the Phase 5 publish
transaction copy them atomically into `tags`. Existing Phase 4 pending rows require an
explicit no-tags legacy treatment; do not fabricate selections.

## Recommended Plan Split

1. **05-01 - Event model and candidate discovery**
   Schema evolution for pre-publication verification events and staged accessibility
   tags, uniqueness/privacy/lifecycle constraints, pending-candidate RPC, pgTAP tests,
   and regenerated types.
2. **05-02 - Trust weight and atomic publish transaction**
   GPS/proximity validation, weight calculation, shadowban-zero behavior, trust event
   append/update, confidence canonicalization, and atomic staged-submission publish.
3. **05-03 - VerifyFlow client experience**
   Candidate surface, real GPS capture, accepted/rejected/denied/loading states,
   generic failure copy, cache invalidation, and device UAT.
4. **05-04 - Personal impact stat**
   Server-maintained count, `get_profile_stats` contract update, Profile copy, tests,
   and non-comparative UI verification.
5. **05-05 - Publication notification**
   Token registration, outbox, Edge Function delivery, credentials/deployment
   checkpoints, retry/idempotency tests, and notification UAT.
6. **05-06 - 48-hour promotion job**
   Only after a real pending objection signal is defined. Otherwise create a disabled,
   fail-closed stub and carry the behavior forward explicitly.

## Required Discussion Decisions

Before executable plans are written, decide:

1. How non-submitters discover nearby pending candidates without exposing a global
   unpublished-location feed.
2. Whether raw verification GPS evidence is retained, for how long, and at what
   precision.
3. The trust score/multiplier ranges, delta table, and both decay equations.
4. The numeric confidence source of truth and display-tier thresholds.
5. Whether the 48-hour route is deferred until pending reports exist.
6. The exact private Profile impact copy and qualifying-count definition.
7. Whether notification infrastructure is mandatory for Phase 5 closure or may ship
   behind a tracked deployment/credential checkpoint.
8. Whether withdrawal remains available after any verification evidence exists, and
   how cancelled/expired submissions preserve immutable audit history.
9. Whether client GPS telemetry is an accepted MVP presence-assurance level or device
   attestation/fraud controls are required.
10. Whether a later shadowban invalidates historical qualifying contributions.
11. How changing-table/wheelchair selections are staged and copied to `tags`, and how
    existing pending rows with no stored selections are treated.

## Verification Carry-Forward

- Phase 4 device UAT: two walkthroughs remain in `04-HUMAN-UAT.md`.
- Database tests: Phase 3 and Phase 4 pgTAP suites remain unexecuted until Docker is
  available.
- Any Phase 5 database plan must include executable pgTAP coverage for concurrency,
  duplicate verification, shadowban-zero behavior, authorization, publication
  atomicity, and rollback on partial failure.
- Every live `supabase db push`, function deploy, cron schedule, or secret write still
  requires a fresh user authorization checkpoint.

## Current Platform Notes

The Supabase changelog was checked on 2026-07-09. No recent hosted-platform breaking
change found in the reviewed entries alters this design. Postgres 14 support ended on
2026-07-01, so the linked project's Postgres version should be checked before relying
on current Cron behavior. The official Cron documentation states that Supabase Cron
uses `pg_cron`; scheduled Edge Function invocation combines `pg_cron` with `pg_net`
and recommends Vault for secrets.
