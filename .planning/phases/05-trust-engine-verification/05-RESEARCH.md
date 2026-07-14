# Phase 5: Trust Engine + Verification - Research

**Researched:** 2026-07-11
**Domain:** Postgres/PostGIS trust-and-verification engine on Supabase; Expo SDK 55 push-notification pipeline; React Native verify-flow client
**Confidence:** HIGH (codebase-grounded) / MEDIUM (Expo SDK 55 + Supabase Cron current-docs)

> **2026-07-11 plan re-verification corrections (authoritative over older examples below):**
> - `confirmation_count=1` is the creator's implicit claim. Publish eligibility is `1 + distinct qualifying non-creator verifiers`; one independent second user reaches threshold 2 for both grandfathered and future submissions.
> - Expected verify denials return reason-free `accepted=false`; they do not raise after writing cooldown state, because PostgreSQL would roll that write back. Discovery/verify cooldowns live in private server state, and discovery is VOLATILE.
> - The pending spatial index predicate is `status='pending'` only; `expires_at > now()` stays in the query because current time is not IMMUTABLE and cannot appear in an index predicate.
> - Reuse shipped `gps_location` and `distance_from_location_meters`; do not add duplicate coordinate/distance authorities. Timed raw-GPS purge and submission expiry are operational 05-06 jobs, not carry-forward comments.
> - Numeric confidence tiers are derived at read time through an app_config-aware helper; a generated column cannot query tunable app_config thresholds.
> - notification_outbox guarantees idempotent enqueue and mutually exclusive claims, not exactly-once Expo delivery. Edge Functions read secret keys from their environment; Vault protects the scheduled invocation URL/custom secret. Tickets, receipts, backoff, and DeviceNotRegistered handling are required.
> - Full inherited + Phase 5 pgTAP execution is BLOCKING before the first Phase 5 live push. The older carry-forward wording below is superseded.
> - `.planning/phases/05-trust-engine-verification/05-PATTERNS.md` and the six revised plans contain the executable contracts.

## Summary

Phase 5 is overwhelmingly a **database-and-RPC phase built on already-shipped conventions**, not a
greenfield design problem. Phases 3 and 4 established a complete, repeatable pattern language:
SECURITY DEFINER RPCs as the *only* client write surface, server-computed everything (distance,
weight, aggregates), `app_config`-driven tunables read with a `coalesce()` fallback, explicit
public-safe column lists (never `select *`), a strict `revoke public / revoke anon / grant
authenticated` triple, schema-qualified PostGIS with **lng-first** point construction, and a
generic single-error rejection surface that never echoes the failing check. Every new Phase 5
surface — `search_pending_submissions_nearby`, `verify_location`, the atomic publish transaction,
trust/confidence recomputation — should be a near-mechanical extension of these patterns. The
research strongly recommends *copying the existing migration idioms verbatim* rather than inventing
new structure.

The three genuinely new technical problems are: (1) the **polymorphic-FK evolution** of
`verification_events` (nullable `submission_id` + nullable `location_id` + exactly-one CHECK) — a
well-understood Postgres pattern; (2) the **concurrency-safe second-verification publish** — solved
with `SELECT ... FOR UPDATE` on the pending `submissions` row inside the RPC transaction so the
deciding verifier serializes the count-and-publish; and (3) the **Expo push pipeline** — an
owner-scoped device-token table + idempotent outbox + `pg_cron`/`pg_net`/Vault-driven Edge Function,
which is entirely new surface (no `expo-notifications` dependency, no Edge Functions dir, and no
`supabase/functions/` exist today).

**Primary recommendation:** Structure Phase 5 as the 6-plan split already in ROADMAP/READINESS
(05-01 event model + discovery, 05-02 weight + atomic publish + confidence, 05-03 VerifyFlow UI,
05-04 impact stat, 05-05 notification pipeline, 05-06 fail-closed 48h stub). For every SQL surface,
open the corresponding Phase 3/4 migration and mirror its header, auth-gate, `app_config` reads,
revoke/grant triple, and PostGIS idioms. Treat the trust delta table (D-49), confidence thresholds
(D-54), decay constants (D-56), and the row-lock strategy (D-57) as the only real design work —
everything else is convention-following. Live pushes (`supabase db push`, function deploy, cron
schedule, secret write) each need a fresh user-authorization checkpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Candidate discovery**
- **D-35:** Pending-candidate discovery uses a tight, fixed 500m radius (not the wider public-search radius) — verification implies real proximity.
- **D-36:** The discovery RPC is per-user rate-limited via a cooldown (e.g. one call per few seconds); a rejected verification attempt (mock-location or below-accuracy-floor) still consumes the cooldown, to prevent retry-loop abuse.
- **D-37:** Discovery returns a small capped result set (5-10 candidates), excludes the caller's own submissions, and excludes submissions the caller has already recorded a verification event for.
- **D-38:** Shadowbanned users may still call discovery and submit verification events — their events are accepted but always carry `weight = 0` (consistent with existing shadowban semantics elsewhere in the app).

**Event model**
- **D-39:** `verification_events` is evolved, not replaced: add nullable `submission_id` (FK to `submissions`), make `location_id` nullable, and add a constraint requiring exactly one of `submission_id` / `location_id`. Avoids a second parallel event system.
- **D-40:** Raw GPS evidence (exact lat/lng) is retained for a short, explicit fraud/audit window, then purged — derived distance/accuracy is retained permanently for trust math. The creator's own initial submission claim gets the same treatment once `submit_location` is updated to write full weight-input evidence for it.
- **D-41:** Account deletion purges raw GPS immediately regardless of where the retention window stands.
- **D-42:** Existing Phase 4 pending rows with no stored creator GPS accuracy/fix-time evidence are grandfathered: the existing `confirmation_count = 1` claim stands as-is, nothing is fabricated, and they publish normally once a second verifier confirms.
- **D-43:** A uniqueness rule prevents the same user from counting twice for the same pending submission (mechanism left to planner/researcher).

**Presence assurance & fraud controls**
- **D-44:** Client-reported GPS telemetry (device GPS + accuracy + mocked-location flag) is the accepted MVP presence-assurance level — explicitly abuse-resistant, not tamper-proof. Device attestation (Play Integrity / App Attest) deferred.
- **D-45:** A verification event submitted with the client's mocked-location flag `true` is rejected outright (matches `submit_location`'s `p_mocked` handling) — not silently accepted at `weight = 0`.
- **D-46:** A hard minimum GPS-accuracy floor (e.g. ~100m) rejects a verification event outright, separate from and in addition to the linear accuracy-decay curve.

**Trust scoring**
- **D-47:** `trust_score` keeps its live 0-9 integer range and default of 9 — no rescale/backfill migration.
- **D-48:** `trust_score` and `trust_multiplier` are two **distinct axes**, not one derived from the other. `trust_multiplier` is bounded 0.0-1.0 and ramps up from a 0.5 floor toward 1.0 as the user accrues **accepted verification events they've given** (not account age). `trust_score` is the reputation counter driven by the standard action-delta set below.
- **D-49:** `trust_score` action deltas use a standard set: positive for a published contribution, a real-weight (nonzero) verification event given, and no upheld reports on the user's own submissions; negative for an upheld report / shadowban action, a submission rejected as invalid/duplicate, or a verification later found fraudulent. Deltas are **asymmetric** — penalties larger than rewards. Claude drafts the exact `action_type`/delta table for review before it's locked into a migration.
- **D-50:** Creator submission does **not** earn trust before publication — trust only moves after independent (second-user) confirmation.
- **D-51:** `trust_score` and `shadowban_status` remain fully separate — hitting the floor does **not** auto-trigger a shadowban.
- **D-52:** A later shadowban does **not** rewrite/delete historical contributions — immutable events stay; future recomputation of aggregates treats that user's past events as ineligible going forward.

**Confidence scoring**
- **D-53:** Add a new numeric confidence column on `locations` (canonical source of truth), backfill it from the existing text tiers, and derive `confidence_tier` as a read-only computed label from the numeric value going forward. Do not repurpose `respect_signal_score` or make `confidence_scores` the source of truth.
- **D-54:** Confidence-tier numeric thresholds (High/Medium/Low cutoffs) are Claude's discretion — a documented, `app_config`-tunable default.
- **D-55:** A newly published location starts at a **mid-tier** confidence value, not the maximum.
- **D-56:** Proximity and GPS-accuracy decay use a **linear** decay curve to zero at the discovery radius edge (500m).

**Publication + lifecycle**
- **D-57:** The two-verification publish transition (creating the `locations` row, setting `submissions.location_id`/`status`, copying staged accessibility tags, carrying over any staged `pending_access_code`) happens as a **single atomic DB transaction** — no partial-publish state is ever visible.
- **D-58:** Withdrawal after a verification event already exists does **not** hard-delete it — the submission moves to a `cancelled` status instead, preserving the immutable event audit trail. The verifier's already-recorded event still counts toward their own `trust_multiplier` ramp.
- **D-59:** A submission that expires (14 days) without reaching two verifications moves to `status = 'expired'` — retained, not deleted.
- **D-60:** The 48-hour no-flag auto-promote route is **deferred** — ship a disabled, fail-closed stub documenting the intent; do not build a real auto-promotion path this phase.
- **D-61:** The creator sees a pending-submission progress indicator (e.g. "1/2 verifications received") without exposing verifier identity or location.

**Accessibility staging**
- **D-62:** Changing-table/wheelchair selections are staged in a normalized `submission_tags` staging table, copied atomically into `tags` during the D-57 publish transaction.
- **D-63:** `submission_tags` supports exactly the 2 existing keys (`changing_table`, `wheelchair`). No broader open-ended key set.
- **D-64:** Existing Phase 4 pending rows with no stored accessibility selections publish **untagged**, no reconfirmation required — don't fabricate data that was never captured.

**Personal impact stat**
- **D-65:** The private Profile impact stat uses a "distinct bathrooms helped" framing — counts distinct published locations the user gave a qualifying non-zero-weight verification for. Server-maintained via `users.gps_verified_contribution_count`. Private, non-comparative — no rankings, badges, or leaderboards.

**Notifications**
- **D-66:** Push-notification delivery is **not required for Phase 5 to close**. Build the full pipeline in-phase (client permission priming, token registration, owner-scoped device-token table with RLS, idempotent outbox, authenticated Edge Function that drains the outbox and calls Expo), but live push credentials/deployment is its own separately-authorized checkpoint.
- **D-67:** The publication notification goes to the **creator only**, not to verifiers.
- **D-68:** If push permission was denied or no device token is registered, the user still gets an **in-app fallback signal** — the D-61 progress indicator naturally resolves to a "Published!" state on next view. Push must never be the only way a contributor learns their submission published.

### Claude's Discretion
- Exact uniqueness-constraint mechanism preventing a user from double-counting on the same submission (D-43).
- Exact `trust_score` action_type/delta table values (D-49) — Claude drafts, presented for review before being locked into a migration.
- Exact confidence-tier numeric thresholds (D-54) and initial numeric confidence value mapping to the D-55 mid-tier starting point.
- Exact linear decay formula constants for proximity/accuracy (D-56), tunable via `app_config`.
- Row-locking/concurrency strategy for the second (deciding) verification event race (D-57).

### Deferred Ideas (OUT OF SCOPE)
- **Device attestation / stronger fraud controls** (Play Integrity / App Attest) — deferred past Phase 5 (D-44).
- **48-hour no-flag auto-promotion** — deferred (D-60) until a real pending-objection signal exists (likely Phase 7).
- **Verifier-side publication notification** — deferred (D-67); only the creator is notified in Phase 5.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID (from ROADMAP SC) | Description | Research Support |
|----|-------------|------------------|
| SC1 | `verify_location` RPC validates GPS triple server-side and inserts a verification event | Mirror `submit_location` GPS-validation block (mock/accuracy/freshness) + insert; §Pattern 2, §Code Examples |
| SC2 | `weight = trust_multiplier × proximity_decay × accuracy_decay` (field is `weight`) | §Pattern 3 (linear decay per D-56), server-computed only |
| SC3 | Status transitions pending → published after 2 distinct non-shadowbanned verifiers | §Pattern 5 atomic publish with `FOR UPDATE` row lock (D-57) |
| SC4 | Shadowbanned verification accepted (no hint) but `weight = 0`, no publish | §Pattern 2 shadowban-zero; mirror `search_locations_*` shadowban read pattern |
| SC5 | Tests assert shadowban `weight = 0` does not trigger publish | §Validation Architecture pgTAP map |
| SC6 | `trust_score` increments via `trust_events` append (`delta` sign matches `action_type`) | §Pattern 6; live `trust_events` schema + TDD sign rule |
| SC7 | VerifyFlow handles accepted/rejected/denied without leaking rejection reason | §Pattern 7; mirror SubmitFlow generic-error mapping |
| SC8 | 48-hour auto-promote logic exists as fail-closed stub | D-60; §Pattern 8 disabled stub |
| SC9 | Push notification to submitter on publish (reward-loop only) | §Notification Pipeline; D-66/D-67 |
| SC10 | Profile private non-comparative impact stat from GPS-verified contribution count | §Pattern 9; `users.gps_verified_contribution_count`, `get_profile_stats` extension |
| SC11 | All screens pass Phase 1.5 component acceptance checklist | UI plans 05-03/05-04 |

Requirement→plan mapping matches the ROADMAP 6-plan split (05-01 … 05-06).
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pending-candidate discovery | API (SECURITY DEFINER RPC) | Client (VerifyFlow list) | Server owns proximity filter + privacy; client only renders returned safe columns |
| GPS capture for verification | Client (`expo-location`) | — | Raw telemetry only; never trusted for derived values |
| GPS triple validation (mock/accuracy/freshness) | API (RPC) | Client (advisory pre-check) | Server is the authority; client pre-check is UX only (mirrors `useGpsSample`) |
| Weight computation (trust×proximity×accuracy) | Database (RPC/PL/pgSQL) | — | Server-computed everything; client never sends `weight` |
| Distinct-verifier count + publish gate | Database (RPC txn + row lock) | — | Concurrency-critical; must serialize on the pending row |
| Atomic publish (locations insert + tag copy) | Database (single txn) | — | No partial-publish state may be visible |
| Trust/confidence recomputation | Database (RPC) | — | Aggregates never trusted from client |
| Confidence numeric authority + tier label | Database (`locations` column + computed label) | — | Single writable source of truth (D-53) |
| Publication notification enqueue | Database (outbox row in publish txn) | — | Idempotent, atomic with publish |
| Notification delivery to Expo | Edge Function (server-only) | `pg_cron`+`pg_net` scheduler | DB trigger cannot safely call Expo push directly |
| Device-token registration | Client (`expo-notifications`) → API RPC | — | Owner-scoped write via RPC; RLS never exposes other users' tokens |
| Progress indicator / impact stat display | Client (Profile/pending UI) | API (read RPC) | Read-only server-maintained counts |

## Standard Stack

### Core (already in the project — reuse, do not add)
| Library / Tool | Version (verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL + PostGIS | live project `ebmzhjmmtmldhrojkdqw` | Spatial source of truth, RPC transactions | Established Phase 1-4 convention |
| Supabase SECURITY DEFINER RPCs | live | Sole client write/read surface | Phase 3/4 convention — the only sanctioned write path |
| `@tanstack/react-query` | `^5.100.11` [VERIFIED: app/package.json] | Client data fetching + cache invalidation | Used by all Phase 3/4 hooks (`useNearby`, `useMyPendingSubmissions`) |
| `expo-location` | `~55.1.10` [VERIFIED: app/package.json] | GPS capture (`getCurrentPositionAsync`, `Accuracy.BestForNavigation`) | Already used by `useGpsSample.ts` |
| `expo` (SDK) | `~55.0.26` [VERIFIED: app/package.json] | Runtime | Pinned SDK 55 |
| `react-native` | `0.83.6` [VERIFIED: app/package.json] | Runtime | Pinned |
| `jest` | `^29.7.0` [VERIFIED: app/package.json] | Client unit tests | Pinned per task |
| pgTAP | via `supabase test db` | DB correctness tests | Phase 3/4 suites established (`supabase/tests/*.test.sql`) |

### Supporting (NEW — required for the notification pipeline, plan 05-05)
| Library / Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-notifications` | resolve via `npx expo install expo-notifications` (SDK-55-pinned) [ASSUMED] | Permission prompt, `getExpoPushTokenAsync`, Android channels | Plan 05-05 only |
| `expo-device` | resolve via `npx expo install expo-device` [ASSUMED] | Physical-device check before requesting a push token | Plan 05-05 only |
| Supabase Edge Function (Deno) | Supabase CLI | Drain outbox → call Expo Push API | Plan 05-05; no `supabase/functions/` exists yet |
| `pg_cron` + `pg_net` + Vault | Supabase-hosted extensions | Schedule the outbox-drain Edge Function; store secrets | Plan 05-05 scheduling |
| Expo Push API | `https://exp.host/--/api/v2/push/send` [CITED: docs.expo.dev] | Server → device delivery | Edge Function body |

> **AGENTS.md rule (app/):** "Expo HAS CHANGED — read the exact versioned docs at
> https://docs.expo.dev/versions/v55.0.0/ before writing any code." Plan 05-05 tasks MUST fetch the
> SDK-55 `expo-notifications` doc page at implementation time and pin the version via
> `npx expo install` (NOT `npm install` with a guessed version). Do not hardcode a version string
> in RESEARCH — it is deliberately left `[ASSUMED]` so the planner gates it behind an install task.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `SELECT FOR UPDATE` on pending row | Serializable isolation + retry | FOR UPDATE is simpler, matches single-row hot path, no client retry logic; serializable adds 40001 retry burden [CITED: postgresql.org/docs/current/explicit-locking.html] |
| Polymorphic FK (nullable submission_id + location_id) | Second parallel `submission_verification_events` table | D-39 explicitly rejects a parallel system; one table keeps aggregate resolution simple |
| DB trigger calling Expo push | Outbox + Edge Function | A trigger cannot safely make outbound HTTP; `pg_net` is async/fire-and-forget and belongs in a scheduled drain [CITED: supabase.com/docs/guides/functions/schedule-functions] |
| Numeric confidence on `locations` | `confidence_scores` table as source of truth | D-53 rejects the separate table as authority |

**Installation (plan 05-05 only):**
```bash
# from app/ — Expo resolves the SDK-55-compatible versions
npx expo install expo-notifications expo-device
# Edge Function scaffold (requires separate deploy authorization)
supabase functions new drain-notification-outbox
```

**Version verification:** `expo-location`, `expo`, `react-native`, `jest`, `@tanstack/react-query`,
`@rnmapbox/maps` all verified against `app/package.json` this session. `expo-notifications` /
`expo-device` versions are intentionally NOT pinned here — resolved at install time via
`npx expo install` per the app AGENTS.md rule.

## Package Legitimacy Audit

> Only two NEW packages are introduced (both first-party Expo, plan 05-05). slopcheck was not run
> in this session (no package install performed during research); per protocol the new packages are
> tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.
> All other libraries are already present in `app/package.json` and require no new install.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `expo-notifications` | npm | mature (Expo core) | very high | github.com/expo/expo | not run | `[ASSUMED]` — planner gates via `npx expo install` + checkpoint |
| `expo-device` | npm | mature (Expo core) | very high | github.com/expo/expo | not run | `[ASSUMED]` — planner gates via `npx expo install` + checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Both packages are canonical Expo SDK modules documented at docs.expo.dev; `npx expo install`
selects the SDK-55-pinned version, which is the intended slop-resistant install path. The planner
should still add a `checkpoint:human-verify` before install per protocol.*

## Runtime State Inventory

> Phase 5 is a schema-evolution + backfill phase (not a rename), so this inventory tracks data/state
> that a code change alone will not fix.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data — grandfather rows | Existing Phase 4 pending `submissions` with `confirmation_count = 1` but **no stored creator GPS accuracy/fix-time evidence** | D-42: grandfather — do NOT fabricate a creator `verification_events` row; they publish on second verifier. Tests must cover this path. |
| Stored data — accessibility | Existing pending rows with **no** staged accessibility selections (checkboxes were rendered but discarded pre-Phase-5) | D-64: publish untagged, no reconfirmation. |
| Stored data — confidence backfill | Live `locations.confidence_score`/`confidence_tier` are TEXT tiers (`High/Medium/Low`); new numeric column must be **backfilled** from them | D-53: one-time backfill migration mapping text tier → numeric value; then tier becomes a computed label. Inspect live data before choosing in-place convert vs new column + backfill. |
| Live service config — app_config seeds | New tunables must be seeded into `app_config`: discovery radius (500m), discovery cooldown, accuracy floor (~100m), decay constants, confidence thresholds, mid-tier start value, notification-related keys | Seed rows in migration; RPCs read with `coalesce()` fallback (mirror `max_pins_per_viewport`). Existing keys: `max_pins_per_viewport`, `max_accuracy_m`, `max_gps_age_s`. |
| Live service config — verification_events ACL | Migration `20260710121534_verification_events_client_write_acl_lockdown.sql` (broad client grant removal) is **LIVE** (deployed + live-verified) | The ACL lockdown is confirmed live; Phase 5 must preserve + regression-test it (a direct authenticated INSERT still raises 42501). No further deploy is pending for the lockdown itself. |
| Secrets / env vars | New: the Edge Function's own Supabase secret keys come from ITS environment (never Vault); Vault stores only the drain-invocation URL + custom `OUTBOX_DRAIN_SECRET` that pg_cron uses to call the function; EAS `projectId` in `app.json` `extra.eas.projectId` for `getExpoPushTokenAsync` | Vault secret writes + function deploy each need a separate authorization checkpoint (D-66). Vault is never used to store an elevated Supabase API key for the Edge Function itself. |
| Build artifacts | Regenerated `app/src/lib/database.types.ts` after every migration (new RPCs/columns) | `supabase gen types` after each schema change; the client wrappers (`submitLocation.ts` style) consume `Database['public']['Functions'][...]`. |
| OS-registered state | None — no OS-level scheduler; scheduling is `pg_cron` inside Postgres | None. |

**Nothing found in category "OS-registered state":** None — verified: scheduling is in-database via `pg_cron`, not host cron/Task Scheduler.

## Architecture Patterns

### System Architecture Diagram

```
                            ┌─────────────────────────────────────────┐
  VERIFIER (2nd user)       │            Supabase Postgres             │
  ┌───────────────┐         │                                          │
  │ expo-location │ raw GPS │  ┌────────────────────────────────────┐  │
  │  BestForNav   ├────────►│  │ search_pending_submissions_nearby  │  │
  └───────┬───────┘ (lat/   │  │  (SECURITY DEFINER, 500m, capped,  │  │
          │          lng/   │  │   excl. own + already-verified)    │  │
          │          acc/   │  └────────────────────────────────────┘  │
          ▼          mock)  │                    │ candidate ids        │
  ┌───────────────┐         │                    ▼                      │
  │  VerifyFlow   │─ verify │  ┌────────────────────────────────────┐  │
  │  (RN screen)  ├────────►│  │ verify_location(sub_id, gps triple)│  │
  └───────────────┘         │  │  1. auth + cooldown (D-36)         │  │
          ▲  accepted/      │  │  2. reject mock (D-45)/acc<floor   │  │
          │  rejected/      │  │     (D-46) — consume cooldown       │  │
          │  denied (generic│  │  3. FOR UPDATE lock pending row    │  │
          │  copy, SC7)     │  │  4. compute distance (PostGIS)     │  │
          │                 │  │  5. weight = mult×prox×acc          │  │
          │                 │  │     (shadowban → weight 0, D-38)   │  │
          │                 │  │  6. insert immutable event         │  │
          │                 │  │     (uniqueness: one per user/sub) │  │
          │                 │  │  7. count distinct nonzero verifiers│  │
          │                 │  │  8. if ≥2 → PUBLISH (atomic):      │  │
          │                 │  │       insert locations,            │  │
          │                 │  │       set submission.location_id/  │  │
          │                 │  │        status='published',         │  │
          │                 │  │       copy submission_tags→tags,   │  │
          │                 │  │       carry pending_access_code,   │  │
          │                 │  │       set numeric confidence(mid), │  │
          │                 │  │       append trust_events (D-49),  │  │
          │                 │  │       inc gps_verified_contribution│  │
          │                 │  │       enqueue notification outbox  │  │
          │                 │  └────────────────────────────────────┘  │
          │                 │                    │ outbox row (idempotent)
  CREATOR │                 │                    ▼                      │
  ┌───────────────┐  push   │  ┌────────────────────────────────────┐  │
  │ Profile /     │◄────────┼──┤ pg_cron → pg_net → Edge Function    │  │
  │ progress 1/2  │  or     │  │  drain-notification-outbox          │  │
  │ "Published!"  │  in-app │  │  → Expo Push API (exp.host)          │  │
  └───────────────┘ fallback│  └────────────────────────────────────┘  │
                            └─────────────────────────────────────────┘
```

Data flows raw-telemetry-in / server-computed-out at every stage. The client never supplies
`weight`, `distance`, or aggregate counts. Trace the primary case: verifier GPS → discovery →
verify RPC → (2nd nonzero verifier) → atomic publish → outbox → creator notification/fallback.

### Recommended File / Migration Layout (mirror Phase 4)
```
supabase/migrations/
├── 2026071X0000_phase5_event_model.sql         # 05-01: verification_events evolution,
│                                                #        submission_tags, uniqueness, lifecycle,
│                                                #        preserve verification_events lockdown
├── 2026071X0001_phase5_discovery_rpc.sql        # 05-01: search_pending_submissions_nearby + GiST idx
├── 2026071X0002_phase5_confidence_numeric.sql   # 05-02: numeric confidence col + backfill + tier label
├── 2026071X0003_phase5_verify_and_publish.sql   # 05-02: verify_location + atomic publish + trust
├── 2026071X0004_phase5_app_config_seeds.sql     # 05-02: tunables (radius, cooldown, floor, decay…)
├── 2026071X0005_phase5_impact_stat.sql          # 05-04: get_profile_stats extension
├── 2026071X0006_phase5_notification_pipeline.sql# 05-05: device_tokens, notification_outbox, RLS
└── 2026071X0007_phase5_promote_stub.sql         # 05-06: disabled fail-closed 48h stub
supabase/tests/
├── phase5_event_model.test.sql
├── phase5_discovery.test.sql
├── phase5_verify_publish.test.sql   # concurrency, dup, shadowban-zero, atomicity, rollback
├── phase5_confidence.test.sql
└── phase5_notifications.test.sql
supabase/functions/
└── drain-notification-outbox/index.ts           # NEW dir — none exists today
app/src/features/verify/                          # NEW feature dir (mirror submit/)
├── verifyLocation.ts   useVerify.ts   useVerifyCandidates.ts   useVerifyGpsSample.ts
app/src/features/notifications/                   # NEW
└── registerPushToken.ts   usePushPermission.ts
```

### Pattern 1: SECURITY DEFINER RPC skeleton (copy verbatim)
**What:** Every new write/read surface uses the exact idiom from `submit_location` /
`search_locations_nearby`.
**When to use:** All Phase 5 RPCs.
```sql
-- Source: supabase/migrations/20260707020000_phase4_submission_staging.sql
create or replace function public.verify_location(p_submission_id uuid, ...)
returns <type>
language plpgsql
security definer
set search_path = ''          -- Pattern 5 hardening (never omit)
as $$
declare
  v_max_accuracy numeric;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select value::numeric into v_max_accuracy from public.app_config where key = 'max_accuracy_m';
  v_max_accuracy := coalesce(v_max_accuracy, 50);      -- always coalesce a fallback
  ...
end;
$$;
revoke execute on function public.verify_location(...) from public;
revoke execute on function public.verify_location(...) from anon;
grant  execute on function public.verify_location(...) to authenticated;
```
**Anti-pattern:** granting to `anon`, omitting `set search_path`, returning `setof locations` /
`select *`, or reading `family_mode`/shadowban from a client parameter (must be read server-side via
`auth.uid()` — Pitfall 3 in Phase 3).

### Pattern 2: PostGIS point + distance (lng FIRST)
**What:** Point construction is `st_setsrid(st_makepoint(lng, lat), 4326)::geography` — **longitude
first**. Distance is `st_distance(a, b)` (meters, geography). KNN order uses `<->`.
```sql
-- Source: 20260704010002_phase3_search_rpcs.sql (search_locations_nearby)
st_distance(s.coordinates,
            extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography)
```
Discovery radius predicate should use an index-friendly `ST_DWithin(coordinates, point, 500)` plus a
**partial GiST index** on `(coordinates)` `WHERE status = 'pending'` ONLY (READINESS gap 1) — do NOT
add `AND expires_at > now()` to the index predicate: `now()` is not IMMUTABLE, so Postgres rejects a
non-immutable expression in an index WHERE clause, and a migration copying this literally would fail
to apply. Apply the `expires_at > now()` filter in the RPC's query WHERE clause instead (the index
narrows to pending rows; the query narrows further to unexpired ones). This matches the corrected
statement at the top of this file and `05-01-PLAN.md`'s actual index-creation instruction. Note
schema-qualification: the 2026-07-10 remediation qualifies PostGIS with `extensions.` in migrations —
follow the qualification style already present in the file you're extending.

### Pattern 3: Server-computed linear decay weight (D-56)
**What:** `weight = trust_multiplier × proximity_decay × accuracy_decay`, all server-side.
Linear decay to zero at the 500m discovery edge; accuracy decay linear with a hard floor reject at
~100m (D-46) BEFORE any nonzero weight is possible.
```
proximity_decay = greatest(0, 1 - distance_m / radius_m)     -- radius_m = 500 (app_config)
accuracy_decay  = greatest(0, 1 - accuracy_m / accuracy_span)-- span tunable; reject if acc > floor
weight          = case when shadowbanned then 0
                       else trust_multiplier * proximity_decay * accuracy_decay end
```
Constants (`radius_m`, `accuracy_span`, floor) are `app_config` rows (D-54/D-56 discretion). Draft
exact values for review; do not hardcode in the RPC body — read + `coalesce()`.

### Pattern 4: Polymorphic-FK evolution of `verification_events` (D-39)
**What:** Add nullable `submission_id`, make `location_id` nullable, add exactly-one CHECK.
```sql
alter table public.verification_events
  add column if not exists submission_id uuid references public.submissions(id),
  alter column location_id drop not null;

alter table public.verification_events
  add constraint verification_events_target_exactly_one
  check (num_nonnulls(submission_id, location_id) = 1);

-- Uniqueness (D-43): one counted event per user per pending submission
create unique index verification_events_user_submission_uniq
  on public.verification_events (user_id, submission_id)
  where submission_id is not null;
```
Keep pre-publication events **immutable** and linked via `submission_id`. On publish, resolve the
eventual location through the immutable `submissions.location_id` link — do **not** rewrite event
rows. Also add the weight-input columns needed for auditable recompute (accuracy, captured-at) with
the D-40 raw-GPS retention decision documented in the migration comment (schema-contract §"Required
Review Checks" rejects storing raw GPS samples without a retention decision).

### Pattern 5: Concurrency-safe atomic publish (D-57, row lock)
**What:** The deciding (second) verifier must serialize lock-validate-count-and-publish so two
simultaneous verifiers cannot double-publish, race the threshold, or insert an event against a
target another transaction just published/cancelled out from under them.
**How:** Inside the `verify_location` transaction, `SELECT ... FOR UPDATE` the pending `submissions`
row and re-validate status/expiry/ownership BEFORE inserting the verifier's event — locking and
validating first is what prevents a concurrent caller from writing an event against a submission
that a parallel transaction is simultaneously publishing or cancelling. Only after the lock is held
and the target re-validated does the event insert happen, followed by a re-count under the same
lock. Because a plpgsql function runs in a single implicit transaction, all of
lock+validate → insert-event → count → publish is atomic; a concurrent verifier blocks on the row
lock until this commits, then re-reads current state (First-Committer-Wins) [CITED:
postgresql.org/docs/current/explicit-locking.html].
```sql
-- lock + VALIDATE BEFORE inserting the event (prevents a race against a concurrent
-- publish/cancel of the same target) — see 05-02-PLAN.md Task 3 steps 3-7 for the full sequence.
-- SELECT INTO + FOUND check, NOT a bare PERFORM: a filtered "for update" that matches zero rows
-- (missing/own/expired/non-pending/already-published target) must return the reason-free
-- {accepted:false} result BEFORE any event is inserted — a lock statement alone is not validation.
select submitter_id into v_submitter_id
  from public.submissions
  where id = p_submission_id and status = 'pending' and expires_at > now()
    and submitter_id <> auth.uid()
  for update;                                  -- second concurrent verifier waits here

if not found then
  return jsonb_build_object('accepted', false);       -- missing/own/expired/non-pending — no event, no reason leaked
end if;

-- ... insert the immutable verification_events row here (weight already computed) ...

-- threshold = 1 (creator's implicit claim) + distinct CURRENTLY-ELIGIBLE non-creator verifiers
-- (D-52: exclude a verifier who is shadowbanned NOW, even if their recorded weight was > 0
-- when they verified — their immutable event is never rewritten, just excluded from this count)
select 1 + count(distinct ve.user_id) into v_confirmation_count
  from public.verification_events ve
  join public.users u on u.id = ve.user_id
  where ve.submission_id = p_submission_id
    and ve.user_id <> v_submitter_id             -- use the locked row's submitter, not a second lookup
    and ve.weight > 0
    and u.shadowban_status is not true;

if v_confirmation_count >= v_publish_threshold then     -- submission_publish_threshold from app_config
  -- ATOMIC PUBLISH (all in this same transaction):
  insert into public.locations (name, coordinates, policy_tag, ..., confidence_value /*numeric, mid-tier start*/,
                                access_code_confirmed_at, access_instructions /*from pending_access_code*/)
    select ... from public.submissions where id = p_submission_id
    returning id into v_location_id;
  update public.submissions
     set status = 'published', location_id = v_location_id, confirmation_count = v_confirmation_count, updated_at = now()
     where id = p_submission_id;
  insert into public.tags (location_id, key, value)                 -- copy submission_tags (D-62/63)
    select v_location_id, st.key, st.value from public.submission_tags st
    where st.submission_id = p_submission_id;
  -- append trust_events for creator (published_contribution, D-49/D-50) and for the deciding
  -- verifier if their event is nonzero-weight (verification_given_nonzero, D-49) — NOT for a
  -- creator_claim event, which is always weight=0 and never counts (see 05-02 Task 3 step 9),
  -- ramp the giver's trust_multiplier (D-48), inc users.gps_verified_contribution_count (D-65),
  -- insert notification_outbox row (idempotent key) — all before COMMIT.
end if;
```
**Idempotency:** guard the publish branch on `status = 'pending'` (re-checked under the lock) so a
retried/duplicate deciding call is a no-op. The notification outbox uses a unique
`(submission_id)` / `(location_id, recipient)` key so re-drains don't double-send.

### Pattern 6: `trust_events` append with sign discipline (D-49, SC6)
**What:** Every trust change is an append to `trust_events (user_id, action_type, delta, context_ref)`
where `delta` sign MUST match `action_type`. Penalties larger than rewards (asymmetric).
```sql
-- Source: docs/schema-contract.md §trust_events (delta integer; sign-must-match rule)
insert into public.trust_events (user_id, action_type, delta, context_ref)
values (v_verifier, 'verification_given_nonzero', +1, p_submission_id::text);
```
Draft the full `action_type`/delta table (published contribution, nonzero verification given, upheld
report −N, shadowban −N, invalid/duplicate submission −N, fraudulent verification −N) for review
before locking it into the migration. **TDD rule (schema-contract):** all `trust_events` writes must
assert delta sign matches action_type in pgTAP.

### Pattern 7: VerifyFlow generic-error mapping (SC7)
**What:** The client rethrows the RPC error unchanged; the wizard maps ANY rejection to locked
friendly copy without echoing which check failed — mirror `submitLocation.ts` + SubmitFlow.
```ts
// Source: app/src/features/submit/submitLocation.ts (mirror shape)
export async function verifyLocation(input: VerifyInput): Promise<VerifyResult> {
  const { data, error } = await supabase.rpc('verify_location', args);
  if (error) throw error;               // wizard maps to accepted/rejected/denied copy, not here
  return data as VerifyResult;
}
```
GPS capture reuses the `useGpsSample.ts` shape (`BestForNavigation`, `mocked ?? false`, `{denied:true}`
sentinel on permission denial → renders the denied state, never a dead end).

### Pattern 8: Fail-closed 48h stub (D-60, SC8)
**What:** A disabled cron stub documenting intent that CANNOT promote. Because `reports.location_id`
is `NOT NULL`, a pending submission has no measurable "no flags" signal (READINESS gap 3). The stub
must fail closed: schedule it disabled or have the function early-return without promoting, with a
comment pointing to Phase 7's pending-objection work.

### Pattern 9: Server-maintained impact stat (D-65, SC10)
**What:** Increment `users.gps_verified_contribution_count` only for qualifying nonzero-weight
verifications that led to (or contributed to) a published location — distinct locations, not raw
event volume. Extend `get_profile_stats` to return it; Profile renders private non-comparative copy.
Mirror `profileStats.ts` client shape.

### Anti-Patterns to Avoid
- **Direct client writes** to `verification_events` / `locations` / `submissions` — all revoked; RPC-only.
- **`select *` / `setof locations`** — always explicit public-safe columns (info-disclosure mitigation).
- **Reading shadowban/family_mode from a client param** — read server-side via `auth.uid()`.
- **DB trigger calling Expo push over HTTP** — use outbox + scheduled Edge Function.
- **Cascade-delete that removes verification evidence** on withdrawal — use `cancelled` status (D-58).
- **Latitude-first PostGIS** — always `st_makepoint(lng, lat)`.
- **Hardcoding tunables** in the RPC body — seed `app_config`, read with `coalesce()` fallback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency-safe deciding verifier | Custom advisory-lock scheme or app-level mutex | `SELECT ... FOR UPDATE` on the pending row inside the RPC txn | Native, deadlock-understood, First-Committer-Wins semantics |
| Distance / proximity | Haversine in JS/PLpgSQL degrees | PostGIS `ST_Distance`/`ST_DWithin` geography | Meter-accurate, index-friendly, schema-contract mandates it |
| Push delivery retries | Ad-hoc trigger HTTP | Outbox table + idempotency key + scheduled drain | Trigger HTTP is unsafe; outbox gives at-least-once + dedupe |
| Push token acquisition | Manual FCM/APNs plumbing | `expo-notifications` `getExpoPushTokenAsync` + Expo Push API | Expo abstracts both platforms; matches existing Expo stack |
| Exactly-one FK target | App-level validation | Postgres `CHECK (num_nonnulls(...) = 1)` | Enforced at the DB, cannot be bypassed by any write path |
| Dedupe double-verify | App-level check | Partial `UNIQUE INDEX (user_id, submission_id)` | DB-enforced, race-proof |
| Secret storage for Edge Function | Env vars in SQL / hardcoded keys | Edge Function's own environment (SUPABASE_URL + current secret-key env); Vault holds ONLY the drain-invocation URL + custom bearer secret pg_cron sends | schema-contract forbids client-held keys; the Edge Function never reads its own Supabase credentials from Vault — Vault is for the cron-to-function call, not the function's own admin client |

**Key insight:** Nearly every Phase 5 "hard problem" already has a first-committer-wins /
DB-constraint / PostGIS / Expo-primitive answer. Custom logic here is almost always a regression
against an existing, tested project convention.

## Common Pitfalls

### Pitfall 1: Racing the publish threshold (double publish)
**What goes wrong:** Two verifiers submit the deciding (2nd) event simultaneously; both read
count = 1, both insert, both see count = 2, both publish → two `locations` rows or corrupted state.
**Why:** No serialization on the pending row.
**How to avoid:** `SELECT ... FOR UPDATE` on the `submissions` row before counting; re-check
`status = 'pending'` under the lock; publish branch is a no-op if already published (Pattern 5).
**Warning signs:** pgTAP concurrency test spawning two sessions must produce exactly one `locations` row.

### Pitfall 2: Confidence stored as text (Phase 3 pin-cap bug precedent)
**What goes wrong:** Ordering/threshold logic against `confidence_score` (TEXT) instead of the new
numeric — exactly the Phase 3 bug the search RPCs had to work around with a `CASE confidence_tier`.
**Why:** Two confidence surfaces exist (`locations.confidence_score` TEXT, `confidence_scores` table,
plus the new numeric).
**How to avoid:** Make the new numeric column the single writable authority (D-53); derive the tier
label from it; never order/threshold on the TEXT column post-migration.
**Warning signs:** any Phase 5 SQL comparing `confidence_score` as text.

### Pitfall 3: Fabricating creator evidence for grandfather rows
**What goes wrong:** Back-filling a synthetic creator `verification_events` row for Phase 4 pending
submissions that never captured accuracy/fix-time.
**Why:** The new model expects a creator event with weight inputs.
**How to avoid:** D-42 grandfather — leave `confirmation_count = 1` as-is; publish on second verifier;
never invent GPS evidence. Test this path explicitly.

### Pitfall 4: Leaking the rejection reason (SC7)
**What goes wrong:** Client shows "GPS too inaccurate" / "you're too far" — hands an attacker a probe.
**Why:** Echoing the specific failing check.
**How to avoid:** Single generic error from the RPC (mirror `submit_location`'s `'gps rejected'`);
map to locked copy client-side without branching on reason.

### Pitfall 5: Notification as the only signal
**What goes wrong:** Creator never learns their submission published because push was denied / no token.
**Why:** Treating push as the delivery guarantee.
**How to avoid:** D-68 in-app fallback — the D-61 progress indicator resolves to "Published!" on next
view regardless of push. Push is enhancement, not the channel of record.

### Pitfall 6: Withdrawal cascade deleting evidence
**What goes wrong:** Reusing Phase 4's hard-delete `withdraw_submission` after an immutable event
exists → deletes audit evidence (or FK-cascades).
**Why:** Phase 4's D-29 hard-delete predates the event link.
**How to avoid:** D-58 — once any verification event references the submission, withdrawal sets
`status = 'cancelled'` (retain row + events); the verifier's event still counts toward their
`trust_multiplier`. Update the `submissions.status` CHECK to allow `cancelled`.

### Pitfall 7: Losing the verification_events lockdown
**What goes wrong:** New RPCs re-open a broad client write path, undoing the 2026-07-10 lockdown.
**Why:** Adding grants carelessly while evolving the table.
**How to avoid:** Preserve the layered lockdown; the hardened RPC (running as owner via SECURITY
DEFINER) is the only write path. Add pgTAP regression asserting a direct `authenticated` INSERT still
raises 42501 (mirror `phase4_submit.test.sql` Section 7).

## Code Examples

### Discovery RPC shape (05-01)
```sql
-- Mirror get_my_pending_submissions + search_locations_nearby.
-- 500m (D-35), capped 5-10 (D-37), exclude own + already-verified, exclude expired/non-pending.
create or replace function public.search_pending_submissions_nearby(
  user_lat numeric, user_lng numeric, result_limit integer default 10)
returns table (id uuid, name text, lat double precision, lng double precision,
               policy_tag text, distance_m double precision)
language plpgsql security definer volatile set search_path = ''
as $$
declare v_radius numeric; begin
  if auth.uid() is null then return; end if;
  select value::numeric into v_radius from public.app_config where key = 'discovery_radius_m';
  v_radius := coalesce(v_radius, 500);
  return query
  select s.id, s.name,
         extensions.st_y(s.coordinates::extensions.geometry)::double precision,
         extensions.st_x(s.coordinates::extensions.geometry)::double precision,
         s.policy_tag,
         extensions.st_distance(s.coordinates,
           extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat),4326)::extensions.geography)::double precision
  from public.submissions s
  where s.status = 'pending' and s.expires_at > now()
    and s.submitter_id <> auth.uid()                                   -- D-37 exclude own
    and not exists (select 1 from public.verification_events ve        -- D-37 exclude already-verified
                    where ve.submission_id = s.id and ve.user_id = auth.uid())
    and extensions.st_dwithin(s.coordinates,
          extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat),4326)::extensions.geography, v_radius)
  order by s.coordinates <-> extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat),4326)::extensions.geography
  limit greatest(1, least(coalesce(result_limit, 10), 10));
end; $$;
revoke execute on function public.search_pending_submissions_nearby(numeric,numeric,integer) from public;
revoke execute on function public.search_pending_submissions_nearby(numeric,numeric,integer) from anon;
grant  execute on function public.search_pending_submissions_nearby(numeric,numeric,integer) to authenticated;
```
**Note:** never return submitter identity, access code, timing tip, or precise coordinates outside
the radius (READINESS gap 1). The DISCOVERY cooldown (D-36) is enforced inside this
`search_pending_submissions_nearby` RPC itself — it atomically claims `last_discovery_at` in private
rate-limit state before returning candidates (this is why the RPC must be VOLATILE, not STABLE; see
05-01-PLAN.md Task 2 step 9). `verify_location` (05-02) separately claims its own
`last_verify_attempt_at` cooldown; the two are independent per-RPC cooldowns, not one shared timestamp
— do not conflate them or move discovery's cooldown into `verify_location`, which would leave
candidate enumeration unthrottled.

### Expo push token registration (05-05)
```ts
// Source: docs.expo.dev/versions/v55.0.0/sdk/notifications (fetch at implement time)
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;                       // simulators can't get a token
  if (Platform.OS === 'android') {                          // CHANNEL BEFORE permission/token — Android
    await Notifications.setNotificationChannelAsync('default', { name: 'default' });   // 13+'s permission prompt depends on a channel existing (05-05-PLAN.md: "keep this ordering")
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;                    // D-68 fallback path
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;   // required in SDK 55; fall back to easConfig
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await supabase.rpc('register_device_token', { p_token: token }); // owner-scoped RPC write
  return token;
}
```
**SDK 55 caveat [CITED: docs.expo.dev]:** remote push does NOT work in Expo Go on Android (SDK 53+) —
requires a development build; local notifications still work. Token requires `projectId`.

### Scheduled outbox drain (05-05)

**This is NOT Supabase's own JWT-verified invocation** — `verify_jwt=false` is set on the Edge
Function specifically because pg_cron authenticates with a custom bearer secret, not a Supabase
anon/service key sent as `apikey`. The function itself constant-time validates
`Authorization: Bearer <OUTBOX_DRAIN_SECRET>` before doing any work; the admin client inside the
function is built from its own environment (`SUPABASE_URL` + the current secret-key env var), never
from client input or a Vault table read. Vault only stores the values pg_cron needs to make the HTTP
call (the function URL and the custom drain secret) — it is not a Supabase API key.

```sql
-- Source: supabase.com/docs/guides/functions/schedule-functions (adapted for a custom drain secret)
select vault.create_secret('https://ebmzhjmmtmldhrojkdqw.supabase.co/functions/v1/drain-notification-outbox', 'outbox_drain_url');
select vault.create_secret('<OUTBOX_DRAIN_SECRET value>', 'outbox_drain_secret');

select cron.schedule('drain-notification-outbox', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='outbox_drain_url'),
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='outbox_drain_secret')));
$$);
```

The Edge Function does NOT simply "select undelivered rows, POST, mark delivered" — see
`05-05-PLAN.md` Task 4 for the full contract: it generates a fresh `claim_token` per invocation,
atomically claims a bounded batch via the service-only lease-aware `SKIP LOCKED` RPC
(`claim_notification_outbox`, which also reclaims rows whose `claim_expires_at` lease has expired —
this is what prevents a crashed worker from stranding a row forever), POSTs to
`https://exp.host/--/api/v2/push/send`, and persists every ticket ID/error through a
compare-and-set settle RPC keyed on `(id, claim_token)` — so a stale/slow worker whose claim was
already reclaimed by a newer worker cannot overwrite that newer claim's outcome. Transient failures
get bounded exponential backoff up to `max_attempts`, after which the row becomes terminal
(`failed_at`). A later pass claims due ticket IDs, fetches receipts, and revokes
`DeviceNotRegistered` tokens under the same lease/claim-token discipline. Every `db push` / function
deploy / `cron.schedule` / Vault write is a **separate authorization checkpoint** (D-66, READINESS
§Verification Carry-Forward).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Remote push in Expo Go | Development build required (Android) | Expo SDK 53+ | Plan 05-05 UAT needs a dev build, not Expo Go |
| `getExpoPushTokenAsync()` bare | Requires `projectId` | SDK 48+ (enforced) | Must set `extra.eas.projectId` in `app.json` |
| Postgres 14 | Support ended 2026-07-01 | 2026-07-01 | Verify the linked project's PG version before relying on current Cron behavior (READINESS §Platform Notes) |
| `respect_signal_90d` regular view | Materialized + CONCURRENT refresh | Phase 6 (not Phase 5) | Do not touch in Phase 5 |

**Deprecated/outdated:**
- May-era guessed formulas in old SYSTEM_MAP (`is_gps_verified` column, `ST_DWithin` verify guess) — do not resurrect; no such column exists.
- Legacy radius RPCs (`get_locations_in_radius`, `count_locations_within`) — retired 2026-07-10; do not recreate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `expo-notifications` / `expo-device` are the correct SDK-55 packages; exact version resolved via `npx expo install` | Standard Stack | Low — canonical Expo modules; version pin deferred to install task per AGENTS.md |
| A2 | `verify_radius_m`, `verify_cooldown_s`, `accuracy_floor_m`, decay/confidence-threshold keys do not yet exist in `app_config` | Runtime State Inventory | Low — only `max_pins_per_viewport`, `max_accuracy_m`, `max_gps_age_s` were observed; planner should confirm full `app_config` contents against live before seeding |
| A3 | `submissions.status` CHECK currently allows only `pending/published/expired/rejected` and needs `cancelled` added (D-58) | Pitfall 6 | Medium — if not altered, D-58 cancellation write fails; verify CHECK before writing the lifecycle migration |
| A4 | Postgres version supports current `pg_cron`/`pg_net`/Vault behavior (PG14 EOL 2026-07-01) | State of the Art | Medium — check the live project PG version before scheduling; upgrade may be a prerequisite |
| A5 | `SELECT FOR UPDATE` on the single pending row is sufficient isolation without raising the txn isolation level | Pattern 5 | Low — single-row hot path; FCW semantics documented; confirm with the concurrency pgTAP test |
| A6 | Raw-GPS retention window length (D-40) is a product/compliance choice not yet fixed | Pattern 4 | Medium — needs a concrete number before the purge job; flag for user confirmation |

## Open Questions

1. **(RESOLVED — via 05-02 Task 1 decision checkpoint) Exact raw-GPS retention window (D-40).**
   - What we know: raw lat/lng retained short-term for fraud/audit, then purged; derived distance/accuracy kept permanently.
   - Resolution: NOT decided inline in 05-01 (which only adds the `raw_gps_purge_after` column, unpopulated). The exact day count is decided at the 05-02 Task 1 decision checkpoint alongside the other Claude's-Discretion tunables, seeded into app_config as `raw_gps_retention_days` (30-day default proposed for confirmation), and consumed by `verify_location`/`submit_location` when computing `raw_gps_purge_after` at insert time. The purge job itself is scoped explicitly in 05-06 (`private.purge_expired_verification_gps()`, part of the lifecycle-maintenance migration).

2. **(RESOLVED) Cooldown storage mechanism (D-36).**
   - What we know: per-user cooldown; rejected attempts still consume it.
   - Resolution: `private.verification_rate_limits` (05-01 Task 2, step 9) — a dedicated, non-Data-API-exposed table keyed by user_id with `last_discovery_at`/`last_verify_attempt_at`, accessed only via approved SECURITY DEFINER RPCs.

3. **(RESOLVED) Trust delta table exact values (D-49).** Drafted and presented at the 05-02 Task 1 decision checkpoint before being locked into any migration.

4. **(RESOLVED) Confidence numeric scale + thresholds + mid-tier start (D-54/D-55).** 0-100 scale, tier cutoffs, and mid-tier publish value are drafted and presented at the same 05-02 Task 1 checkpoint, seeded to `app_config`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (live) | All SQL surfaces | ✓ | project `ebmzhjmmtmldhrojkdqw` | — |
| Docker (local pgTAP `supabase test db`) | Executable pgTAP suites | ✗ | — | Author suites now; the full inherited + Phase 5 pgTAP suite MUST pass on a Docker-capable or isolated non-production environment before the first Phase 5 live push (BLOCKING — Phase 5 may NOT reuse the Phase 3/4 unexecuted-pgTAP override) |
| Supabase CLI | migrations, `gen types`, functions, `test db` | assumed ✓ | — | — |
| `pg_cron` / `pg_net` / Vault (hosted) | Scheduled outbox drain | assumed ✓ (Supabase-hosted) | — | Verify enabled on project before scheduling |
| EAS `projectId` | `getExpoPushTokenAsync` | must confirm in `app.json` | — | No push token without it (blocks live push, not phase closure per D-66) |
| Expo dev build | Android push UAT | ✗ (Expo Go insufficient SDK 53+) | — | Local notifications for partial UAT; real push behind deploy checkpoint |

**Missing dependencies with no fallback:** none block phase closure — live push is explicitly behind a
separate checkpoint (D-66). Phase 5 pgTAP execution is NOT carried forward: the full inherited + Phase 5 suite is a BLOCKING pre-push gate that must pass with no override.
**Missing dependencies with fallback:** Docker (author suites now; acquire a Docker-capable or isolated non-production environment and execute the full inherited + Phase 5 pgTAP suite — BLOCKING before the first Phase 5 live push, no carry-forward override); Expo dev build (deferred UAT).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| DB framework | pgTAP via `supabase test db` (requires Docker — unavailable this env) |
| Client framework | jest `^29.7.0` [VERIFIED: app/package.json] |
| DB test dir | `supabase/tests/*.test.sql` |
| Client test dir | `app/src/features/**/__tests__/` |
| Quick run (client) | `cd app && npx jest <path>` |
| Full DB suite | `supabase test db` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | File Exists? |
|-----|----------|-----------|---------|-------------|
| SC1 | verify_location validates GPS triple + inserts event | pgTAP | `supabase test db` (phase5_verify_publish) | ❌ Wave 0 |
| SC2 | weight = mult×prox×acc computed | pgTAP | same | ❌ Wave 0 |
| SC3 | pending→published after 2 distinct verifiers (incl. concurrent) | pgTAP (2-session) | same | ❌ Wave 0 |
| SC4/SC5 | shadowban verify → weight 0, no publish | pgTAP | same | ❌ Wave 0 |
| SC6 | trust_events delta sign matches action_type | pgTAP | phase5_verify_publish | ❌ Wave 0 |
| D-43 | duplicate verify by same user rejected/no-op | pgTAP | phase5_event_model | ❌ Wave 0 |
| D-57 | publish atomic; rollback on partial failure | pgTAP | phase5_verify_publish | ❌ Wave 0 |
| Pitfall 7 | direct authenticated INSERT still 42501 | pgTAP | phase5_event_model | ❌ Wave 0 |
| SC7 | VerifyFlow generic accepted/rejected/denied copy | jest | `cd app && npx jest features/verify` | ❌ Wave 0 |
| SC10 | impact stat non-comparative render | jest | `cd app && npx jest features/profile` | ❌ Wave 0 |
| SC9 | outbox idempotency / no double-send | pgTAP + jest | phase5_notifications | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** relevant jest file or targeted pgTAP suite.
- **Per wave merge:** full jest + `supabase test db` (when Docker available).
- **Phase gate:** the full inherited + Phase 5 pgTAP suite must be green before the first Phase 5 live push and `/gsd:verify-work`; Phase 5 may NOT reuse the Phase 3/4 unexecuted-pgTAP carry-forward override — execution on a Docker-capable or isolated non-production environment is required, not deferred.

### Wave 0 Gaps
- [ ] `supabase/tests/phase5_event_model.test.sql` — SC(event), D-43, lockdown regression
- [ ] `supabase/tests/phase5_discovery.test.sql` — 500m, exclusions, cap, privacy
- [ ] `supabase/tests/phase5_verify_publish.test.sql` — concurrency, shadowban-zero, atomicity, rollback, trust sign
- [ ] `supabase/tests/phase5_confidence.test.sql` — numeric authority + tier derivation + backfill
- [ ] `supabase/tests/phase5_notifications.test.sql` — outbox idempotency, RLS token isolation
- [ ] `app/src/features/verify/__tests__/` — VerifyFlow states, generic-error mapping
- [ ] `app/src/features/notifications/__tests__/` — permission/token/fallback paths

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Access Control (RLS/authz) | yes | SECURITY DEFINER RPC + `auth.uid()` scoping; revoke/grant triple; RLS denies direct writes |
| V5 Input Validation | yes | Server re-validates GPS triple; reject mock/low-accuracy; never trust client-derived weight/distance |
| V6 Cryptography / secrets | yes | Edge Function reads its own Supabase secret keys from its environment (never Vault); Vault `decrypted_secrets` holds only the drain-invocation URL + custom bearer secret; no client-held service keys (schema-contract) |
| V7 Error Handling / info leakage | yes | Single generic rejection error (SC7); no reason echoed; explicit public-safe column lists |
| V8 Data Protection / privacy | yes | Raw-GPS retention window + purge (D-40/D-41); device tokens owner-scoped, RLS never exposes others' tokens; discovery hides submitter identity |
| V11 Business Logic | yes | Distinct-verifier count under row lock; uniqueness index prevents double-count; shadowban weight 0; asymmetric trust penalties |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed GPS / mock location | Spoofing | Reject `mocked=true` (D-45); accuracy floor (D-46); documented as abuse-resistant not tamper-proof (D-44) |
| Self-verification / sockpuppet double-count | Spoofing/Elevation | Exclude own submissions (D-37); unique `(user_id, submission_id)` index (D-43); two *distinct* users required |
| Publish-threshold race → double publish | Tampering | `SELECT FOR UPDATE` + re-check status under lock (D-57) |
| Rejection-reason probing | Information Disclosure | Generic single error (SC7) |
| Retry-loop discovery abuse | DoS | Per-user cooldown consumed even on rejection (D-36) |
| Token/PII leakage via RLS | Information Disclosure | Owner-scoped device_tokens; never expose other users' tokens/delivery state |
| Shadowban evasion via new events | Elevation | Shadowban → weight 0 server-side, silently (D-38); no publish contribution |
| Raw GPS over-retention | Information Disclosure | Time-boxed retention + purge; immediate purge on account deletion (D-40/D-41) |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **GSD workflow** governs phase work; TDD Guard active for `app/src/**` — write tests first, do not bypass hooks without recorded approval.
- **Review gate:** Claude writes packets; user runs Antigravity (`agy`) + Codex (`codex exec`), both read files from disk. Do not invoke reviewers directly.
- **Expo AGENTS.md:** read exact SDK-55 versioned docs before writing Expo code; pin via `npx expo install`.
- **Self-modifying commit gate (MEMORY):** commits touching `.claude/settings.json` permissions or hooks stay blocked — ask the user to commit directly.
- **Schema authority:** `supabase/migrations/*` are source of truth; `docs/schema-contract.md` is the reviewer reference; use live table/column names exactly.
- **Every live `supabase db push` / function deploy / cron schedule / secret write requires a fresh user-authorization checkpoint.**

## Sources

### Primary (HIGH confidence)
- Codebase migrations: `20260707020000_phase4_submission_staging.sql`, `20260704010002_phase3_search_rpcs.sql` — RPC/PostGIS/auth idioms
- `supabase/tests/phase4_submit.test.sql` — pgTAP conventions (role-switching, generic-error asserts, RLS denial)
- `app/src/features/submit/{submitLocation.ts,useGpsSample.ts}`, `profile/profileStats.ts` — client RPC wrapper + GPS-capture idioms
- `docs/schema-contract.md`, `docs/SYSTEM_MAP.md` — live schema authority (2026-07-10/11)
- `05-CONTEXT.md` (D-35…D-68), `05-READINESS.md` (8 gaps + plan split), `ROADMAP.md` §Phase 5
- `app/package.json` — verified versions

### Secondary (MEDIUM confidence — current docs)
- docs.expo.dev/versions/v55.0.0/sdk/notifications — `getExpoPushTokenAsync`+`projectId`, Android channels, Expo Go remote-push removal (SDK 53+)
- supabase.com/docs/guides/functions/schedule-functions — `pg_cron`+`pg_net`+Vault SQL pattern
- postgresql.org/docs/current/explicit-locking.html — `SELECT FOR UPDATE` / First-Committer-Wins semantics

### Tertiary (LOW confidence)
- General web guidance on `SELECT FOR UPDATE` race-condition handling (Stormatics, dev.to) — corroborative only; primary is PG docs

## Metadata

**Confidence breakdown:**
- Standard stack / codebase patterns: HIGH — read directly from shipped migrations, tests, and client code.
- Architecture (event model, atomic publish, concurrency): HIGH — patterns are direct extensions of shipped conventions + PG docs.
- Notification pipeline (Expo SDK 55 + Supabase Cron): MEDIUM — current official docs fetched; exact package versions deferred to `npx expo install`.
- Trust/confidence exact constants: intentionally OPEN (Claude's discretion, to be drafted for review).

**Research date:** 2026-07-11
**Valid until:** 2026-08-10 for the codebase-grounded sections (stable); 2026-07-18 for the Expo SDK 55 / Supabase Cron sections (fast-moving — re-verify at 05-05 implementation time per AGENTS.md).
</content>
</invoke>
