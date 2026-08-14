<!-- review-manifest
reviewer: antigravity
generated_at: 2026-08-13T16:34:56Z
scope_hash: sha256:68b9e2d15a9093322475ec9685b852082f30b7eca2518016fbf310db09c59579
review_id: p5-02-race-fk-6f557fe0-r4
risk_level: high
runtime_required: true
blind_review: true
queue:
  - supabase/migrations/20260731000000_phase5_app_config_seeds.sql
  - supabase/migrations/20260731000100_phase5_confidence_numeric.sql
  - supabase/migrations/20260731000200_phase5_notification_outbox.sql
  - supabase/migrations/20260731000300_phase5_verify_and_publish.sql
  - supabase/tests/phase5_confidence.test.sql
  - supabase/tests/phase5_verify_publish.test.sql
  - supabase/tests/phase5_discovery_cooldown_race.test.sql
  - supabase/tests/phase5_event_model.test.sql
  - app/src/app/(tabs)/submit.tsx
  - app/src/features/submit/submitLocation.ts
  - app/src/features/submit/types.ts
  - app/src/features/submit/__tests__/submitLocation.test.ts
  - .github/workflows/phase5-db-verify.yml
  - supabase/scripts/run-isolated-db-suite.js
  - supabase/scripts/run-isolated-db-suite.test.js
  - supabase/scripts/verify-confidence-backfill-binding.test.js
diff_base: HEAD
context_tier: 1
-->

# Antigravity Review Packet — Phase 5 Plan 05-02, Task 5 pre-push gate, ROUND 4

Your round-3 verdict was **ADVISORY** (clean, no issues, evidence_level 3,
runtime_evidence executed), with one non-blocking Concern noted (the POSIX
`pkill -9 -P` direct-children-only limitation, already disclosed in the
runner's own comment — no action taken on it, it stands as an accepted
tradeoff). Nothing you verified needs re-litigation.

Codex's round-3 verdict (independent) confirmed both round-2 findings
**FULLY RESOLVED** via its own mutation testing, but raised **one NEW MAJOR
finding** you have not yet seen: a real, reproduced concurrency bug in
`verify_location`'s Step 2 cooldown claim, distinct from anything either of
you has reviewed before. Only 2 files changed this round for this reason:
`supabase/migrations/20260731000300_phase5_verify_and_publish.sql` (the fix)
and `supabase/tests/phase5_verify_publish.test.sql` (a new regression test,
RACE 5). Every other file is unchanged since your round-3 pass.

## Codex's round-3 finding — first-use cooldown missing-row bypass

**Finding:** `select r.last_verify_attempt_at ... where r.user_id = v_uid for
update` against a row that does not yet exist (a genuinely first-time caller)
acquires NO lock — there is nothing to lock. Two truly concurrent first-ever
`verify_location` calls by the SAME new user could therefore both read
`v_last_attempt = NULL` and both bypass the D-36 cooldown. Codex reproduced
this live with two dblink sessions: both calls returned `accepted: true`
(want: 1, got: 2).

**Independent reproduction (by me, before implementing anything — this
project's standing discipline):** read `verify_location`'s Step 2 directly
and confirmed the exact TOCTOU shape. Notably, this codebase had **already
documented and fixed the identical anti-pattern once before**, in
`20260717120100_phase5_discovery_rpc.sql`'s own comment: "A prior version of
this claim used a plain select-then-insert... that is a TOCTOU race." Step 2
of `verify_location` was, byte-for-byte, that exact superseded anti-pattern,
just on a different rate-limit column. I then wrote a new genuine two-session
regression test (`phase5_verify_publish.test.sql` RACE 5 — same
fire-both-async-back-to-back technique as the file's existing RACE 4, two
distinct submissions so D-43 idempotency can't mask the bypass) and ran it
via the isolated runner **against the pre-fix code first**: it failed exactly
as predicted (`have: 2, want: 1` on both new assertions). Only after that RED
confirmation did I apply the fix.

**Fix:** `verify_location:154-180` now uses the SAME atomic
ensure-row-then-lock pattern already proven and reviewed in the discovery
RPC — `insert ... on conflict (user_id) do nothing` to guarantee the row
exists (idempotent no-op if a concurrent caller already created it), then a
single `with locked as (select ... for update) update ... from locked`
statement that locks, reads the prior value, and overwrites it atomically (a
`for update` lock inside a CTE feeding an `update ... from` is never inlined
by the planner, so the lock is real). `v_now` (not `clock_timestamp()`) is
kept deliberately — matching every other timestamp in this function and this
file's own single-transaction pgTAP fixtures, which rely on `now()` being
frozen for the whole transaction.

**Verification after the fix:** RACE 5 went GREEN (`Files=1, Tests=91,
Result: PASS`), and I re-ran it 2 more times standalone to rule out
flakiness in a genuinely timing-dependent test — all 3 runs green. The full
isolated suite then ran clean: `Files=10, Tests=258, Result: PASS` (was 253;
+5 new RACE 5 assertions). **Please verify independently**: (a) read
`verify_location:154-180` and confirm the lock is real (not decorative —
try reasoning about what happens if you delete the `for update` and see if
the CTE still protects anything); (b) run RACE 5 yourself, ideally against
the code BEFORE this fix (`git show HEAD:supabase/migrations/...` for the
old body) to confirm it reproduces red, then against the fixed code to
confirm green; (c) assess whether keeping `v_now` instead of
`clock_timestamp()` here (unlike the discovery RPC) is the correct call for
this specific function, or whether you'd require the discovery RPC's
`clock_timestamp()` approach instead.

## Fresh runtime evidence, this round

- `node supabase/scripts/run-isolated-db-suite.js` (full suite) —
  `Files=10, Tests=258, Result: PASS` (was 253 at round 3; +5 new RACE 5
  assertions, 0 regressions).
- `node supabase/scripts/run-isolated-db-suite.js supabase/tests/phase5_verify_publish.test.sql`
  run 3 times total this round (1 pre-fix RED, 2 post-fix GREEN) —
  consistent every time, no flakiness observed.
- All other files unchanged since round 3: runner/backfill-binding unit
  tests (33/33 + 3/3), app `tsc`/`jest` (clean, 46/46 suites, 393/393 tests)
  still apply — no app-side or runner-side file touched this round.

### Required Skills
- `.claude/skills/artifact_qa_gate.md` shared core and **Antigravity Overlay**
- `superpowers:using-superpowers`
- `superpowers:verification-before-completion`
- `superpowers:systematic-debugging` (concurrency-race root-causing)
- `.claude/skills/rls_security_guard.md`
- `.claude/skills/trust_engine_validator.md`

### Runtime Boundary And Mock Audit
- disposable postgres 17 instance with postgis via run-isolated-db-suite.js
- no live database or auth mocks used for backend claims

### Claim And State Audit
- verify_location step 2 cooldown race fix independently verified against pre-fix RED and post-fix GREEN

This queue remains `runtime_required: true`. A positive verdict requires
`runtime_evidence: executed` — re-run RACE 5 and the full suite yourself
rather than trusting the numbers above.
