<!-- review-manifest
reviewer: codex
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

# Codex Review Packet — Phase 5 Plan 05-02, Task 5 pre-push gate, ROUND 4

Your round-3 verdict was **REQUEST CHANGES** with exactly ONE new MAJOR
finding (both round-2 findings you confirmed FULLY RESOLVED via your own
mutation testing — thank you for the rigor there, no re-litigation needed).
That one finding is addressed below. Antigravity's round-3 (independent)
verdict was ADVISORY/clean with a non-blocking Concern about the POSIX
`pkill -P` limitation; unaffected by this round's change.

Only 2 files changed this round:
`supabase/migrations/20260731000300_phase5_verify_and_publish.sql` (the fix)
and `supabase/tests/phase5_verify_publish.test.sql` (a new regression test,
RACE 5). Every other file is byte-identical to round 3.

## Your finding — first-use cooldown missing-row bypass (`supabase/migrations/20260731000300_phase5_verify_and_publish.sql:154-165`)

**Your finding:** `select ... for update` against a row that doesn't exist
yet acquires no lock. Two concurrent first-ever `verify_location` calls by
the same brand-new user can both read `v_last_attempt = NULL` and both
proceed past the D-36 cooldown gate. You reproduced this live with two
dblink sessions deliberately held at the first INSERT boundary: both
returned `accepted: true` — `have: 2, want: 1`.

**Independent reproduction, before implementing anything (this project's
standing discipline — every real Codex finding gets reproduced before it's
trusted):** I read `verify_location:154-165` directly and confirmed the
exact TOCTOU shape your finding describes. This codebase had, in fact,
**already hit and fixed this identical anti-pattern once before** —
`20260717120100_phase5_discovery_rpc.sql`'s own inline comment reads: "A
prior version of this claim used a plain select-then-insert (read
last_discovery_at, decide, then upsert): that is a TOCTOU race." Step 2 of
`verify_location`, byte-for-byte, was that exact superseded pattern on a
different rate-limit column — it just never got the same fix applied when
`verify_location` was written.

I then wrote a genuine two-session regression test, `phase5_verify_publish.test.sql`
RACE 5, reusing this file's own established `race_connstr()` helper and the
same fire-both-`dblink_send_query`-back-to-back technique as the file's
existing RACE 4 (no artificial delay — genuine overlap is what the test
relies on, matching your own reproduction's shape). Two distinct submissions
are used for the two calls specifically so D-43's per-submission idempotency
guard can't mask a double-accept by collapsing it into one counted event.
**Ran this test against the pre-fix code FIRST, via
`node supabase/scripts/run-isolated-db-suite.js supabase/tests/phase5_verify_publish.test.sql`**:
it failed exactly as your finding predicted —
`have: 2, want: 1` on both the "exactly one accepted" and "exactly one event
recorded" assertions. Only after that RED confirmation did I implement the
fix.

**Fix:** `verify_location:154-180` now uses the identical atomic
ensure-row-then-lock pattern already reviewed and live-proven in the
discovery RPC: `insert into private.verification_rate_limits (user_id,
last_verify_attempt_at) values (v_uid, null) on conflict (user_id) do
nothing` guarantees the row exists (idempotent no-op if a concurrent caller
already created it), then a single `with locked as (select
last_verify_attempt_at from ... for update) update ... from locked`
statement locks, reads the PRIOR value, and overwrites it atomically in one
statement — the discovery RPC's own comment explains why this specific shape
matters: a `for update` lock inside a CTE feeding an `update ... from` is
never inlined by the planner, so the lock is real and held for the
transaction's duration, unlike a naive select-then-separate-update. I kept
`v_now` rather than switching to `clock_timestamp()` (which the discovery
RPC uses) — `verify_location` uses `v_now` consistently for every other
timestamp it writes, and this file's own single-transaction pgTAP fixtures
(the `begin;...rollback;` section) rely on `now()` being frozen for the
whole transaction so `reset_cooldown()`-free "too-soon retry" assertions
keep working. **Please assess this specific deviation** (v_now vs.
clock_timestamp) — I made a judgment call that the discovery RPC's
rationale (protecting against two calls inside one client-managed
transaction) doesn't apply to `verify_location` the same way, since nothing
in this codebase calls it twice inside a single externally-managed
transaction, but that's exactly the kind of call worth your independent
view rather than accepting my reasoning.

**Post-fix verification:** RACE 5 passed
(`Files=1, Tests=91, Result: PASS`), then re-ran it 2 more times standalone
(1 pre-fix RED + 2 post-fix GREEN = 3 total runs) to rule out flakiness in
what is, by nature, a timing-dependent test — consistent every time. Full
isolated suite: `Files=10, Tests=258, Result: PASS` (was 253 at your round-3
review; +5 new assertions, 0 regressions elsewhere).

## Fresh runtime evidence, this round

- `node supabase/scripts/run-isolated-db-suite.js` (full suite) —
  `Files=10, Tests=258, Result: PASS`.
- `node supabase/scripts/run-isolated-db-suite.js supabase/tests/phase5_verify_publish.test.sql` —
  run 3 times (1 RED pre-fix, 2 GREEN post-fix), no flakiness.
- All other files (runner script, backfill-binding test, CI workflow, app
  files) unchanged since your round-3 review — their prior evidence
  (33/33 + 3/3 unit tests, 46/46 suites / 393/393 app tests, both clean)
  still applies.

### Required Skills
- `.claude/skills/artifact_qa_gate.md` shared core and **Codex Overlay**
- practical verification: re-run RACE 5 yourself, ideally against the
  pre-fix migration body too, to independently confirm both the red and
  green states — do not accept `runtime_evidence: executed` above as a
  substitute for your own run
- PL/pgSQL concurrency/locking review for the `insert ... on conflict do
  nothing` + `with ... for update` + `update ... from` pattern

### Runtime Boundary And Mock Audit
- disposable postgres 17 instance with postgis via run-isolated-db-suite.js
- no live database or auth mocks used for backend claims

## Reviewed Queue
List every file above you actually inspected — the 2 changed files
(`20260731000300_phase5_verify_and_publish.sql`,
`phase5_verify_publish.test.sql`) are the material change this round; the
rest are unchanged since round 3 but remain in scope for the scope_hash.

## Explicit ask
Please state plainly whether this fix fully resolves your round-3 finding,
whether the `v_now` vs. `clock_timestamp()` judgment call is acceptable for
this function, and whether RACE 5's fire-both-async-back-to-back proof
methodology meets your evidentiary bar for a genuinely reproduced (not
merely plausible) concurrency fix — or whether you'd require a more
deterministic blocking-handshake proof (like RACE 1-3's `wait_event_type =
'Lock'` polling) despite there being no lock to observe during the
pre-fix vulnerable window itself.
