# Stale Information Scan - 2026-07-09

Status: HISTORICAL SNAPSHOT. The 2026-07-10 remediation status below is the
only current portion of this file; every section beginning with "Historical
Snapshot Body" is preserved evidence from the 2026-07-09 scan and must not be
read as current execution state.

Trigger: Whole-project audit before Phase 5 discussion/planning; Phase 4 transition and Codex harness/model-routing changes.
Branch: `master` (ahead of `origin/master`; dirty worktree preserved).
Commit: `30272ce` at scan start.
Next review due: after the blocking remediation batch, before Phase 5 plans are reviewed, or 2026-08-08, whichever comes first.

## Remediation Status — updated 2026-07-10

The implementation blockers below were remediated or have forward fixes in this
uncommitted batch. The review gate remains open pending fresh Antigravity + Codex
verdicts. The item bodies are preserved verbatim as historical evidence; do NOT
re-execute them.

1. **RESOLVED** — PostGIS schema qualification fixed in
   `20260710010000_phase3_postgis_schema_qualification_fix.sql`, pushed live
   with user authorization and verified by calling every RPC against the live
   database. The two legacy Phase 1 radius RPCs the fix initially "repaired"
   were subsequently DROPPED entirely (`20260710020000` + `20260710030000`,
   both live-verified) after Codex's first-pass review found the repair had
   reactivated a full-row exfiltration path (SECURITY DEFINER `setof locations`
   granted to anon). Zero overloads of either legacy function remain live.
2. **POLICY RESOLVED LIVE; ACL FORWARD FIX LOCAL** — `verification_events_insert_auth` dropped in
   `20260710000000_phase5prep_drop_verification_events_direct_insert.sql`,
   pushed live and verified: only the service-role INSERT policy remains, so RLS
   denies ordinary client inserts. Round 4 live inspection found broad table-level
   client grants still present, including `TRUNCATE`. The forward migration
   `20260710121534_verification_events_client_write_acl_lockdown.sql` revokes all
   `anon` privileges and leaves `authenticated` with SELECT only; it is local and
   requires review, commit, fresh deployment authorization, and live verification.
   pgTAP coverage now asserts both ACLs and denied INSERT (execution remains
   Docker-blocked).
3. **RESOLVED LOCALLY, REVIEW OPEN** — Codex Round 2's three findings were fixed.
   Round 3 Antigravity approved the 41-file scope; Round 3 Codex found one
   remaining contradiction in the active audit/readiness chain. That chain now
   marks the dated audit historical and treats verification-event direct-write
   lockdown as completed work to preserve/test, not future removal work. The
   Round 4 then produced the ACL fix above. Codex Round 5 found two app recovery
   dead ends: a failed detail fetch rendered an endless skeleton, and rejected
   permission/GPS promises left position status undetermined. Both are fixed with
   explicit error state, retry, Map manual browsing, and regression/lifecycle tests.
   Codex Round 6 then found the Map still mounted a second permission hook and
   Nearby's denied state still lacked an action. Map now derives manual-search
   state from the single real `useCurrentPosition` boundary, and Nearby opens OS
   settings when permission is denied while preserving a distinct pending state.
   The omitted `useCurrentPosition` regression file is now queued, and the now-orphaned
   duplicate permission hook plus its standalone test were removed. The corrected
   review scope is now 49 files. Codex Round 7's remaining harness finding is also
   fixed: both packets and verdicts must repeat a deterministic staged-queue SHA-256
   fingerprint, and the hook rejects approvals after any queued bytes are re-staged.
   The hook suite is 15/15 including that regression. All earlier verdicts predate
   the resulting bytes; fresh Round 8 independent
   verdicts are still required before commit.
4. **RESOLVED** — verification baseline is clean: lint 0 errors (30
   pre-existing style warnings), typecheck clean, 46/46 suites / 389/389 tests
   with clean Jest exit (root cause: missing `gcTime: 0` mutation defaults in
   two test files), coverage thresholds met. MapScreen `act()` warnings 7 → 1
   (residual is non-failing and disclosed).

Current order: fresh reviews -> commit -> separately authorized ACL migration push
and live verification -> item 4 authority-doc refresh (PROJECT.md, schema-contract.md,
SYSTEM_MAP.md, config.json ship sources, and design docs) -> Phase 5 discussion gates
in `05-DISCUSSION-DRAFT.md`. WATCH items and deferred pgTAP/device UAT remain open.

## Historical Snapshot Body - 2026-07-09

Everything below this heading is the preserved pre-remediation scan body,
including its `CURRENT` and `Blocked Checks` labels. It is not current recovery
guidance. Use `.planning/STATE.md` and `.beads/context/execution-state.md`.

## Historical: Commands Run

- `git status --short --branch` and `git diff --stat` - current planning/harness edits inventoried; pre-existing `app/src/lib/database.types.ts` worktree metadata change preserved.
- `rg --files` across `.planning`, `docs`, `.claude`, `.beads/context`, migrations, tests, and app source - phase and authority inventory completed.
- Targeted `rg`/readback checks - compared PROJECT, ROADMAP, STATE, phase verification/reviews, schema contract, system map, migrations, generated types, review queue, packets, and verdicts.
- `npm.cmd run typecheck` - exit 0.
- `npm.cmd run lint` - exit 1 with 5 errors and 30 warnings.
- `npm.cmd test -- --runInBand` - all 47 suites / 383 tests reported PASS, but the process did not exit and timed out after 241 seconds.
- `npm.cmd test -- --runInBand --detectOpenHandles` - same 47/383 PASS result and non-exit timeout; MapScreen emitted repeated unwrapped-`act` warnings.
- Read-only Terra and Luna audits - completed after one timed-out broad attempt was discarded; findings were reproduced against local files before inclusion.

## Historical: BLOCKING STALE INFO

1. Phase 3 search RPCs are treated as complete while a high-priority pending todo and the migration bodies show unqualified PostGIS calls under `SET search_path = public`. Fix via a new migration and verify the real RPC call path before Phase 5 relies on it.
2. `docs/schema-contract.md` says verification writes are server-owned, but the authoritative base migration still permits authenticated direct inserts into `verification_events`, including caller-supplied weight/distance/event fields. Revoke the policy/privilege before Phase 5 trust aggregation.
3. The active review queue does not match either latest reviewer packet or verdict; those artifacts approve the previous 32-file Phase 4 scope. No current audit/planning change may commit under those stale approvals.
4. Local verification is not clean: lint fails and Jest reports all assertions passing but never exits. The harness forbids approval/commit after failed verification unless the blocker is explicitly resolved or deferred.

## Historical: UPDATE REQUIRED

1. `.planning/PROJECT.md` still calls settled Phase 4 decisions open, says schema design is unnecessary, leaves every key decision pending, and retains a May initialization footer.
2. `docs/schema-contract.md` is aligned only through 2026-06-24 and omits the Phase 4 submissions/access-code model plus `ratings` and `tags`.
3. `docs/SYSTEM_MAP.md` is a May recovery snapshot with wrong trust, coordinate, confidence, verification-event, and view types. It needs a rewrite or an explicit historical-only banner.
4. ROADMAP progress previously described Phase 2 as verification-pending, Phase 3/4 as unqualified Complete, Phase 5 as 0/2 after the six-plan split, and Phase 8 as 0/3 despite four plans. Corrected in this scan batch.
5. Phase 4's roadmap claimed a creator verification event that the implementation deliberately did not create. Corrected to the actual `confirmation_count = 1` presence claim; Phase 5 owns the auditable event model.
6. Phase 4 accessibility checkboxes are client-only and their selections are discarded. Phase 5 readiness now requires staged tags and atomic publication.
7. Phase 7 omitted `duplicate_location` from its success-criterion values and did not schedule Phase 4's required `wrong_sensitivity_tag` correction path. Corrected provisionally in ROADMAP.
8. `.planning/config.json` ship templates reference a nonexistent `REQUIREMENTS.md`; point them at the real requirement authority or add the intended file before using the ship workflow.
9. Active design docs still contain future-tense Phase 2/3/4 implementation instructions and the older pending-pin JOIN design. Reconcile them against implemented Phase 4 behavior before using them as Phase 5 UI authority.

## Historical: WATCH

1. Phase 1/1.5/3/4 historical review frontmatter retains `issues_found`, `REQUEST CHANGES`, `gaps_found`, or `human_needed`. Preserve history, but state/roadmap must label code completion separately from experiential/database verification.
2. Seven Phase 3 device checks and two Phase 4 device checks remain pending; Phase 3 and Phase 4 pgTAP suites remain unexecuted without Docker.
3. Current model aliases in `.planning/config.json` were not live-verified against Anthropic during this scan.
4. The first broad Terra/Luna audit attempt timed out and returned no usable result; only the successful narrowed retries count as evidence.

## Historical: CURRENT (as of the 2026-07-09 scan)

- Migrations remain the schema authority; generated database types match the current committed schema content apart from a preserved worktree line-ending/metadata change.
- TypeScript compilation is clean.
- All 47 Jest suites and 383 assertions report PASS before the open-handle timeout.
- Sol/high is the active human-assigned Codex contingency; Terra/Luna are bounded internal advisors and do not replace independent Antigravity plus separate Codex review.
- No live Supabase push, Edge Function deploy, cron change, secret write, destructive cleanup, or commit occurred during this scan.

## Historical: Blocked Checks (as of the 2026-07-09 scan)

- Live Supabase RPC/schema state was not queried; live operations require fresh authorization.
- pgTAP was not executed because this environment still lacks the Docker-backed local Supabase runner.
- Device UAT was not executed; no physical-device walkthrough was performed.
- Coverage was not rerun because the underlying Jest command does not exit cleanly.
