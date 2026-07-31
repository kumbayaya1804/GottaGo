---
phase: 05-trust-engine-verification
plan: 02
subsystem: database
tags: [postgres, pgtap, postgis, supabase, trust-engine, concurrency, row-locking, confidence, outbox, tdd]

# Dependency graph
requires:
  - phase: 05-trust-engine-verification
    plan: 01
    provides: polymorphic verification_events, private.verification_rate_limits, submission_tags, raw_gps_purge_after column, submissions 'cancelled' status
provides:
  - "app_config tunables: discovery_radius_m, verify_cooldown_s, accuracy_floor_m, accuracy_decay_span_m, confidence thresholds/start, confidence_floor_value, trust_multiplier_step, raw_gps_retention_days"
  - "locations.confidence_value — the 0-100 numeric confidence authority (D-53) + confidence_tier_for() derivation helper"
  - "all three public readers derive the display tier from the numeric authority"
  - "notification_outbox table with enqueue idempotency, claim lease, and terminal-failure state"
  - "verify_location RPC — server-computed weight, single-pass FOR NO KEY UPDATE lock, atomic publish, dual trust appends with trust_score sync"
  - "submit_location rewritten (14-arg signature, old 12-arg overload dropped, search_path='' hardened) writing creator_claim evidence + staged accessibility tags"
  - "get_my_unseen_submission_publications / acknowledge_submission_publication (D-68 fallback)"
  - "submissions.publication_seen_at"
affects:
  - "05-03 (VerifyFlow UI consumes verify_location)"
  - "05-05 (outbox consumer/drain builds on notification_outbox)"
  - "05-06 (raw-GPS purge consumes raw_gps_retention_days; legacy NULL-deadline backfill)"
  - "06 (confidence decay job consumes confidence_value + confidence_floor_value)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-pass ascending-users.id FOR NO KEY UPDATE lock loop — explicit per-row loop because SELECT ... ORDER BY ... FOR NO KEY UPDATE does not guarantee sorted acquisition order"
    - "Reason-free {accepted:false} return contract so a pre-validation cooldown write survives an expected rejection (raising would roll it back)"
    - "coalesce(trust_score, 9)-anchored clamp for every trust_score mutation (nullable column + NULL-ignoring GREATEST/LEAST)"
    - "Hard gate strictly tighter than decay span on BOTH the proximity and accuracy axes, so no admitted event can compute weight 0"
    - "Staging-key → public-tag-vocabulary mapping at publish (submission_tags.changing_table → tags(amenity, changing_table))"

key-files:
  created:
    - supabase/migrations/20260731000000_phase5_app_config_seeds.sql
    - supabase/migrations/20260731000100_phase5_confidence_numeric.sql
    - supabase/migrations/20260731000200_phase5_notification_outbox.sql
    - supabase/migrations/20260731000300_phase5_verify_and_publish.sql
    - supabase/tests/phase5_confidence.test.sql
    - supabase/tests/phase5_verify_publish.test.sql
  modified:
    - app/src/app/(tabs)/submit.tsx
    - app/src/features/submit/types.ts
    - app/src/features/submit/submitLocation.ts
    - app/src/features/submit/__tests__/submitLocation.test.ts

key-decisions:
  - "Task 1 checkpoint resolved 'adopt defaults' WITH the recommended Finding 1 fix: accuracy_floor_m=50 (hard reject) + new accuracy_decay_span_m=100 (decay span), max_accuracy_m untouched."
  - "Finding 2 resolved by seeding a NEW scale-matched confidence_floor_value=5 rather than mutating the shipped 0-1-scale confidence_floor."
  - "Finding 3 resolved: the confidence backfill maps NULL→NULL to preserve Phase 3's D-08 null-include behavior under filter_high_conf."
  - "The three public readers were rewritten from 20260730000000 (the ambiguity-fixed bodies), NOT from 20260704010002 — starting from the older file would have reintroduced a fixed 26-day production outage."
  - "The step-5b user-row lock uses an explicit per-row loop rather than a single ORDER BY ... FOR NO KEY UPDATE statement, because PostgreSQL may lock during the scan before the sort and a non-deterministic order defeats the whole lock-order design."

requirements-completed: []   # R-VERIFY/R-WEIGHT/R-PUBLISH/R-CONFIDENCE are IMPLEMENTED but NOT verified — no pgTAP has executed (no Docker) and no live push has happened. Do not mark complete until Task 5's gate passes.

# Metrics
duration: partial (Tasks 1-3 complete; Task 4 blocked on Task 5; halted at Task 5 blocking checkpoint)
completed: 2026-07-31
---

# Phase 5 Plan 02: Trust Engine Core Summary

**verify_location with server-computed weight, a single-pass ascending-users.id `FOR NO KEY UPDATE` lock covering creator + caller + historical verifiers, the atomic two-verification publish with dual trust appends and real `trust_score` sync, the 0-100 numeric confidence authority, and the submit_location rewrite that finally forwards the accessibility selections — all written and statically verified, none pushed, and two-session concurrency coverage still outstanding.**

## Status: CHECKPOINT — stopped at Task 5 (BLOCKING live-push gate)

Task 1's decision checkpoint was answered ("adopt defaults" + the recommended Finding 1 fix) and execution continued through Tasks 2 and 3. **Task 4 (`supabase gen types`) cannot run** — it regenerates against the LIVE schema, which requires Task 5's push first. **Task 5 is a blocking human-verify checkpoint and no `supabase db push` was attempted.**

## Performance

- **Tasks:** 3 of 5 complete (1 decision, 2, 3). Task 4 blocked by dependency; Task 5 halted per checkpoint protocol.
- **Files:** 6 created, 4 modified — **all 10 uncommitted** (see Task Commits).
- **App suite:** 46/46 suites, 393/393 tests passing. `tsc --noEmit` clean.

## Accomplishments

### Task 1 — constants locked (decision checkpoint)

Deltas: `published_contribution` +1, `verification_given_nonzero` +1, `submission_invalid_or_duplicate` −2, `upheld_report` −3, `verification_fraudulent` −4, `shadowban_action` −5. `no_upheld_reports` is **defined but never emitted** — there is no measurable eligibility window (`reports.location_id` is NOT NULL, the same root cause behind D-60's deferral), so emitting it would be a phantom reward. Only the two positive types are wired in Phase 5; the negatives are a forward contract for Phase 7 moderation.

Confidence 0-100: High ≥70, Medium ≥40, Low <40, publish start 50. Backfill High→85, Medium→55, Low→20, NULL→NULL.

Grounding the draft against the live schema surfaced three defects in the plan's own recommended defaults; all three were surfaced for decision rather than silently patched, and all three are now fixed in the migrations:

1. **Accuracy dead zone (blocking).** The drafted `accuracy_floor_m=100` + decay span `max_accuracy_m=50` pairing is inverted relative to the proximity pair. Any fix with accuracy in [50,100] would pass the hard reject but compute `accuracy_decay = 0`, hence **weight 0** — accepted, counting toward nothing, earning no trust, and permanently burning the user's one D-43 slot for that submission (the duplicate-conflict path returns `accepted:true` with no side effect). Indistinguishable from a shadowban and strictly worse than a rejection. Fixed by `accuracy_floor_m=50` + new `accuracy_decay_span_m=100`, mirroring the proximity design (gate strictly tighter than span). Admitted accuracies now yield `accuracy_decay ∈ [0.5, 1.0]`. This also avoids overloading `max_accuracy_m`, which `submit_location` uses as a hard reject — reusing it as a decay span would have coupled two RPCs' semantics through one key.
2. **Confidence scale conflict.** The shipped `confidence_floor=0.05` is on a 0-1 scale; on the new 0-100 scale it is effectively zero, defeating Phase 6's "never decay to zero" guarantee. Seeded a new scale-matched `confidence_floor_value=5`; the shipped key is left untouched.
3. **Backfill regression risk.** Phase 3 readers treat a null tier as *passing* `filter_high_conf`. Backfilling nulls to a mid value would have flipped existing rows from included to excluded. Backfill maps NULL→NULL and the rewritten filter keeps the null-include escape on the numeric column; both are asserted in pgTAP.

### Task 2 — three migrations

- **`20260731000000_phase5_app_config_seeds.sql`** — 10 new keys via `on conflict (key) do nothing`. Verified against all three existing seed sites that none of the 8 shipped keys collide, and that `verify_radius_m` / `max_accuracy_m` / `decay_half_life_days` / `confidence_floor` are neither re-inserted nor altered.
- **`20260731000100_phase5_confidence_numeric.sql`** — `locations.confidence_value` with a 0..100 CHECK, the Task-1 backfill, and `confidence_tier_for(numeric)` as the **single** tier-derivation definition (`security definer stable set search_path=''`). All three public readers rewritten to derive the label from the numeric, filter on it with the null-include escape preserved, and order by `confidence_value desc nulls last` instead of the TEXT ladder (Pitfall 2). Legacy text columns marked deprecated via `COMMENT`, not dropped. No app_config-backed generated column was promised — a generated column cannot query another table, so the helper is the only correct mechanism.
- **`20260731000200_phase5_notification_outbox.sql`** — enqueue idempotency (`unique(submission_id)`), claim lease (`claimed_at`/`claim_token`/`claim_expires_at`), bounded retry + terminal `failed_at`, Expo two-phase ticket/receipt state, FK indexes, a partial due/claimable index, RLS on, and **zero** client privileges (the D-68 fallback reads the owner-scoped RPCs, not this queue). A CHECK enforces that a claim is either fully absent or fully present, so 05-05's compare-and-set can never settle against a null token.

### Task 3 — verify_location, atomic publish, submit_location rewrite

`verify_location(uuid, numeric, numeric, numeric, boolean, timestamptz) returns jsonb`, `security definer set search_path=''`, authed-only. Step order and the reasoning behind each lock are documented inline. Highlights:

- **Durable cooldown (D-36):** the caller's own rate-limit row is locked and stamped *before* any domain validation, and every expected rejection **returns** `{"accepted": false}` rather than raising — raising would roll the cooldown write back and make rejected attempts free.
- **Single lock pass:** creator + current caller + every historical qualifying verifier are locked `FOR NO KEY UPDATE` in one ascending-`users.id` loop, **before** any shadowban read, weight computation, or trust effect. Deliberately an explicit per-row loop: `SELECT ... ORDER BY ... FOR NO KEY UPDATE` does not guarantee acquisition in sorted order (PostgreSQL may lock during the scan, before the sort), and a non-deterministic order defeats the entire design. No row is ever locked and later upgraded.
- **Trust:** both appends are conditional and both are paired with a `coalesce(trust_score, 9)`-anchored clamped UPDATE in the same transaction. The coalesce is load-bearing — `trust_score` is nullable and `GREATEST`/`LEAST` ignore NULL, so a bare `trust_score + delta` on a NULL row collapses to exactly 0 regardless of sign.
- **D-69:** the published row inherits the creator's lock-read `shadowban_status`; a suppressed publish mints **no** creator trust, while the verifier's credit is preserved.
- **Tag mapping:** staging keys are not the public vocabulary. The publish maps `changing_table → (amenity, changing_table)` and `wheelchair → (accessibility, wheelchair)` — a verbatim key copy would have produced tags no Phase 3 reader can match.
- **`submit_location`** rewritten from the WR-02 body, hardened from `search_path = public` to `''`, given the two accessibility params, writing a `creator_claim` row with an explicit `weight = 0` (the column is NOT NULL; pinning 0 also means the row can never inflate a count even if the exclusion filter were refactored away), with the exact 12-arg overload dropped first.
- **D-68 RPCs** `get_my_unseen_submission_publications` / `acknowledge_submission_publication`, both owner-scoped via `auth.uid()`, never a parameter.

**Client (TDD, RED→GREEN):** added the two accessibility fields to `SubmitInput` as **required** (so they cannot be silently dropped again), updated `submitLocation.test.ts` first, confirmed 5 failures for the right reason (`p_changing_table`/`p_wheelchair` absent from the payload), then implemented `types.ts` → `submitLocation.ts` → `submit.tsx`'s `buildInput`. The Phase 4 comment claiming the toggles are "NOT yet forwarded" is now corrected.

## Deviations from Plan

**1. [Rule 1 — Bug] Reader bodies had to come from `20260730000000`, not the plan's cited `20260704010002`.**
The plan's `read_first` points at the original Phase 3 search RPCs. That file (and `20260710010000`) carries the `column reference "id" is ambiguous` defect fixed on 2026-07-30 after a 26-day production outage. Copying from either would have silently reverted the fix — exactly how the defect propagated three times already. Bodies were taken from the latest file and the `if auth.uid() is not null` guard, `chill_spot is not false`, and alias-qualified lookup were preserved verbatim. *(Self-caught: I initially dropped the auth guard while transcribing and restored it before verification.)*

**2. [Rule 2 — Missing critical functionality] Staging-key → tag-vocabulary mapping.**
The plan says "copy submission_tags to tags". A literal copy writes `(key='changing_table')`, which no Phase 3 filter matches — the tags would exist but be invisible. Added the explicit mapping plus pgTAP asserting the mapped vocabulary rather than a row count.

**3. [Rule 3 — Blocking] `for share` literal in a comment would have failed the plan's own verify.**
The Task 3 automated check includes `! grep -qi "for share"`. My explanatory comment used the phrase. Reworded to "weaker shared row-lock modes" — same class as 05-01's `gps_lat`-in-a-comment fix.

**4. [Rule 3 — Blocking] `node_modules` absent in the worktree.**
Jest could not resolve `jest-expo`. Created a junction to the main checkout's `node_modules`, ran the suites, then **removed the junction** and verified the main copy intact (730 entries) — a `rm -rf` of the worktree would otherwise have recursed through the junction and deleted the real `node_modules`. No packages were installed.

**5. [Deviation — documented] Temporary type intersection in `submitLocation.ts`.**
`database.types.ts` still describes the 12-arg signature and can only be regenerated post-push (Task 4). Rather than hand-editing the generated file (forbidden), the Args type is intersected with the two new params and commented for removal at Task 4. `tsc --noEmit` is clean.

## Known Gaps

**BLOCKING — two-session concurrency coverage is not written.** The plan requires four races (creator-shadowban-vs-publish, historical-verifier-shadowban with the committed `submission_publish_threshold=3` fixture, current-caller-shadowban, and the reciprocal-user lock-order deadlock case). `phase5_verify_publish.test.sql` covers the single-session branch outcomes thoroughly but **cannot** prove the step-5b lock actually blocks a concurrent shadowban UPDATE.

They are absent rather than stubbed because the only mechanism available here — the dblink two-connection harness in `phase5_discovery_cooldown_race.test.sql` — **does not currently pass** (two real networking defects across two fix attempts; tracked as a deferred infrastructure gap). Four more suites on an unproven harness would produce failures indistinguishable from harness defects. The plan explicitly states concurrency/atomicity coverage may not be waived, so this is a genuine blocker for Task 5, not a soft omission.

**No pgTAP has executed.** Docker is unavailable in this environment, so both new suites are structurally authored and reviewed against the live schema but unrun. RED was therefore *structural* for the SQL suites; only the client TDD cycle had a genuine observed RED→GREEN transition.

## Task Commits

**None of the 10 files are committed**, per the project's mandatory dual-reviewer gate (`.claude/hooks/check-review-artifacts.js` blocks `app/`, `supabase/`, `docs/`, and specified `.claude/` paths without archived Antigravity + Codex APPROVE verdicts). This executor did not generate review packets, invoke either reviewer, or attempt any bypass — `REVIEW_GATE_ALLOW_UNREVIEWED` is rejected for protected paths regardless and hook bypasses are a human-only decision.

The files are deliberately left **unstaged**, not staged: the hook inspects the *staged* set, so staging them would have blocked even this `.planning`-only commit.

**Uncommitted — created:**
- `supabase/migrations/20260731000000_phase5_app_config_seeds.sql`
- `supabase/migrations/20260731000100_phase5_confidence_numeric.sql`
- `supabase/migrations/20260731000200_phase5_notification_outbox.sql`
- `supabase/migrations/20260731000300_phase5_verify_and_publish.sql`
- `supabase/tests/phase5_confidence.test.sql`
- `supabase/tests/phase5_verify_publish.test.sql`

**Uncommitted — modified:**
- `app/src/app/(tabs)/submit.tsx`
- `app/src/features/submit/types.ts`
- `app/src/features/submit/submitLocation.ts`
- `app/src/features/submit/__tests__/submitLocation.test.ts`

All 10 need adding to `.claude/review-queue.txt` by the orchestrator (not touched here — the review loop is orchestrator-owned per the 05-01 precedent).

## Verification Performed

- Task 2 and Task 3 automated `grep`/`ls` checks from the plan: **pass** (including `! grep -qi "for share"`).
- `cd app && npx tsc --noEmit`: **clean**.
- `cd app && npx jest`: **46/46 suites, 393/393 tests**. Three cold-start timeout failures on the first run (`sign-up`, `nearby`, `submit`) all passed on re-run and are unrelated to these changes.
- pgTAP: **not executed** (no Docker) — blocking, see Known Gaps.

## Next Phase Readiness

1. **Write the four two-session race tests** — requires first repairing or replacing the dblink harness. Blocking for Task 5.
2. Route all 10 files through the Antigravity + Codex review loop.
3. Execute the full inherited + Phase 5 pgTAP suite on a Docker-capable environment. `phase5_verify_publish.test.sql` **must** run via `node supabase/scripts/run-isolated-db-suite.js` — it will commit a real global `app_config` mutation once the race fixture lands, which is unsafe against a shared stack.
4. Obtain fresh authorization, then `supabase db push` (Task 5).
5. Run Task 4 (`supabase gen types`) and delete the temporary type intersection in `submitLocation.ts`.

## Self-Check: PASSED

- All 6 created files verified present on disk; all 4 modified files appear in `git status`.
- No commit hashes claimed for implementation work — none is committed by design.
- `.planning/` is the only path in this commit.
- `STATE.md` / `ROADMAP.md` deliberately untouched (orchestrator-owned).

---
*Phase: 05-trust-engine-verification*
*Plan: 02*
*Status: Tasks 1-3 complete (uncommitted, unreviewed, unexecuted); Task 4 blocked on Task 5; halted at Task 5 blocking live-push checkpoint*
