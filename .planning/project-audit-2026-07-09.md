# Gotta Go Whole-Project Audit - 2026-07-09

Status: HISTORICAL SNAPSHOT. Superseded by the 2026-07-10 remediation update below.
Scope: phases 1-5, active product/planning sources, schema/migrations/types, app verification baseline, agent harness, reviewer artifacts, recovery state, and forward roadmap dependencies.

## Remediation Update - 2026-07-10

- **P0-1 resolved and live-verified:** `20260710010000` repaired the supported Phase 3
  search RPCs; `20260710020000` plus `20260710030000` then removed every legacy radius
  RPC overload. Do not recreate or re-run this work.
- **P0-2 policy path resolved live; ACL hardening local:** `20260710000000` removed the
  authenticated INSERT policy, and RLS denies ordinary client inserts. Round 4 live
  inspection found broad table grants still assigned to client roles. The forward
  migration `20260710121534` removes those grants and is pending review, commit, fresh
  deployment authorization, and live verification. Phase 5 must preserve and
  regression-test the completed layered lockdown after deployment.
- **P0-3 resolved:** lint has 0 errors, typecheck is clean, and all 46 suites / 389
  tests plus configured coverage pass with a clean Jest exit. One non-failing
  MapScreen `act(...)` warning remains disclosed. Codex Round 5's detail-fetch and
  GPS-provider recovery findings are fixed with reachable retry/manual-browse paths
  and regression/lifecycle tests. Round 6's duplicate Map permission request and
  Nearby denied-state dead end are also fixed; Map now uses the real shared hook as
  its sole permission boundary and Nearby opens OS settings when permission is denied.
  The orphaned duplicate permission hook and its standalone tests were removed.
- **Review freshness gate repaired:** Codex Round 7 found filename-only approvals could
  survive later queued-byte changes. Packets and verdicts now carry a deterministic
  staged-queue SHA-256 fingerprint; the hook recomputes it and 15/15 fixtures prove a
  post-approval staged change is blocked until artifacts are regenerated.
- **Still open:** deployment/live verification of the ACL forward fix, P0-4's Phase 5
  product/data-model decisions, and P1-1's authority-doc refresh. Current next order is
  review/commit of this remediation batch, separately authorized ACL deployment and
  live verification, then item 4 (`PROJECT.md`, schema contract, SYSTEM_MAP, design
  docs, ship config), then the Phase 5 discussion gates.

Everything below `Historical Audit Body` is preserved 2026-07-09 evidence. Its
"required" actions, status claims, coverage ledger, and remediation order are not
current recovery guidance. Use `.planning/STATE.md` and
`.beads/context/execution-state.md` for current execution state.

## Historical Audit Body - 2026-07-09

### Executive Decision (historical)

Continue Phase 5 discussion, but do not write or execute Phase 5 migrations yet. Four
preconditions are unresolved: the shipped read path may be broken under its PostGIS
search path, verification events still permit untrusted direct inserts, the local
verification gate is not clean, and the staged submission model loses accessibility
choices while lacking an auditable creator-event/lifecycle contract.

## Critical Findings (historical snapshot)

### P0-1 - Phase 3 PostGIS RPC runtime risk blocks downstream trust work

`search_locations_bbox`, `search_locations_nearby`, and `get_location_detail` declare
`SET search_path = public` but use bare `st_*`, `geometry`, and `geography` references
in `supabase/migrations/20260704010002_phase3_search_rpcs.sql:63-296` and the later
null-filter replacement. `.planning/todos/pending/2026-07-07-verify-fix-postgis-schema-qualification-phase3-rpcs.md`
records direct evidence that PostGIS is installed in `extensions` and the same pattern
fails under a public-only search path.

Required: add a forward-only fix migration using `extensions.*`, scan every security-
definer function for the pattern, add/adjust pgTAP coverage, obtain independent review,
then request fresh authorization before a live push and verify all three RPCs live.

### P0-2 - Authenticated clients can forge verification events

`supabase/migrations/20260519010000_remote_schema.sql:170-172` allows authenticated
inserts when `auth.uid() = user_id`; the client supplies weight, distance, event type,
and GPS evidence. That contradicts server-owned trust math and becomes dangerous as
soon as Phase 5 aggregates these rows.

Required: revoke the direct policy and table insert privilege in a reviewed migration.
Only hardened RPCs may compute and append verification events.

### P0-3 - The project verification gate currently fails

- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: FAIL, 5 errors / 30 warnings. Four async RPC helpers are named
  `use*` and called inside query callbacks; `nearby.tsx` also has an unescaped entity.
- `npm.cmd test -- --runInBand`: 47 suites / 383 tests report PASS, then Jest never
  exits and the command times out. `--detectOpenHandles` reproduces the non-exit and
  MapScreen emits repeated unwrapped-`act` warnings.

The latest Codex Phase 4 verdict already disclosed a focused-test version of this
open-handle caveat at `.claude/codex-review-latest.md:45-69`; it was not resolved.

Required: restore zero-error lint, repair test cleanup/query-client timers, eliminate or
account for `act` warnings, then rerun test, coverage, typecheck, and lint without
`--forceExit`.

### P0-4 - Phase 4 staging and Phase 5 publication contracts are incomplete

The Phase 4 roadmap said submission creates a creator verification event, while the
migration only starts `confirmation_count = 1`. Phase 5 needs a real event but current
events require a published `location_id`. Withdrawal hard-deletes the pending row that
future immutable events would reference. Other users cannot discover candidates. The
48-hour route has no pending objection signal. These are documented in
`05-READINESS.md` and must be decided together, under locking/idempotency rules.

Additionally, `app/src/app/(tabs)/submit.tsx:98-116` captures changing-table and
wheelchair selections without forwarding them; the RPC has no parameters and no tags
are staged. This is disclosed but still loses user input and violates the stated
submission/access-type requirement.

Required: resolve `05-DISCUSSION-DRAFT.md`, including staged tags, event target XOR,
withdraw/cancel/expiry history, creator legacy rows, candidate privacy, GPS assurance,
numeric confidence, trust equations, and the disabled 48-hour route.

## Major Findings (historical snapshot)

### P1-1 - Active source documents are not reliable enough for Phase 5

- `.planning/PROJECT.md:43,80,110,142-184` retains settled open questions, the false
  claim that no schema design is needed, all-pending decisions, and an obsolete date.
- `docs/schema-contract.md:3` predates Phase 2-4 migrations and omits submissions,
  access-code staging, ratings, and tags.
- `docs/SYSTEM_MAP.md:3-40` is a recovery snapshot with wrong schema types and formulas.
- Active design documents still instruct future Phase 2/3/4 work and retain the older
  pending-pin JOIN design instead of the implemented separate pending RPC.

Required: refresh or explicitly mark historical before Phase 5 packets cite them.

### P1-2 - Phase/status accounting mixed code completion with full verification

Phase 1.5 remains `human_needed`, Phase 3 remains `gaps_found` with seven device checks
and unexecuted pgTAP, and Phase 4 remains `human_needed` with two device checks plus
unexecuted pgTAP. ROADMAP previously called Phase 3/4 simply Complete and STATE counted
19 completed plans from 18. This batch corrects the counters and labels code/review
completion separately; the underlying UAT/database debt remains open.

### P1-3 - Review artifacts are stale for the current queue

`.claude/review-queue.txt` contains the new planning/harness scope, while both latest
packets and APPROVE verdicts cover the previous Phase 4 32-file scope. The approvals
remain valid historical Phase 4 evidence only. New packets and independent verdicts are
required before committing the current batch.

### P1-4 - Future roadmap contracts contain cross-phase drift

- Phase 7 promised duplicate reporting but its accepted SQL values omitted
  `duplicate_location`; it also omitted Phase 4's sensitivity-dispute requirement.
- Phase 7.5 allowed the currently unmeasurable 48-hour route.
- Phase 9 limited RLS coverage to an unexplained six tables.
- `.planning/config.json` ship sections reference nonexistent `REQUIREMENTS.md` headings.

ROADMAP receives provisional corrections in this audit batch. The ship-template source
and design-doc reconciliation remain remediation items.

## Phase Coverage Ledger (historical snapshot)

| Phase | Code/plans | Verification reality | Disposition |
| --- | --- | --- | --- |
| 1 | 2/2 complete | Historical review says issues found; later summary records review closure | Keep historical; no current blocker found |
| 1.5 | 2/2 complete | `human_needed`; checklist citation obligation continued into later phases | Reconcile status and audit missed plan citations |
| 2 | 3/3 complete | `passed`, 11/11 | Correct ROADMAP status |
| 3 | 5/5 code complete | `gaps_found`, 12/13; 7 device checks and pgTAP open; PostGIS runtime risk open | P0 remediation before Phase 5 |
| 4 | 6/6 code/review complete | `human_needed`; 2 device checks and pgTAP open; accessibility input discarded | Carry UAT; fix data handoff |
| 5 | 0/6 provisional | Discussion decisions and audit remediation open | No executable plans yet |
| 6-9 | Roadmap only | Depend on unsettled Phase 5 authority and several stale assumptions | Re-audit at each transition |

## Remediation Order (historical; items 1-3 completed 2026-07-10)

1. Phase 3 PostGIS fix migration and real-path verification.
2. Verification-event direct-write revocation.
3. Lint/Jest cleanup and full clean baseline, including coverage.
4. Schema contract, PROJECT, SYSTEM_MAP, design-doc, and ship-config reconciliation.
5. Phase 5 human decisions, followed by 05-CONTEXT and six executable plans.
6. Fresh Antigravity and separate Codex review packets for every remediation batch.

## Explicit Boundaries (historical snapshot)

No live database query/push, deployment, cron change, credential access, destructive
cleanup, or commit was performed. Phase 3/4 device UAT and pgTAP remain unexecuted.
