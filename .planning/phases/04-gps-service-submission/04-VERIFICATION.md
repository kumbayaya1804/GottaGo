---
phase: 04-gps-service-submission
verified: 2026-07-08T00:00:00Z
status: human_needed
score: 10/10 success criteria code-verified; 2 items require device confirmation
overrides_applied: 0
human_verification:
  - test: "SubmitFlow wizard end-to-end device walkthrough (04-05 Task 3)"
    expected: "Signed-out gate blocks the form; Step 1 fields (name, address free-text toggle, policy tag, sensitivity switch + explainer) work; Step 2 conditional PIN appears only for Code Required; Step 3 live GPS accuracy readout gates the CTA and updates as accuracy improves; D-15 confirm dialog fires before submit when sensitivity is ON; Success screen shows 'Location Submitted!' and 'Back to Map' returns to the map; Component Acceptance Checklist (design-system.md §20) walked for this screen."
    why_human: "Real GPS accuracy readings, OS permission prompts, and the Android mock-location detection path cannot be exercised in jest — no physical device/simulator available in this environment (consistent with Phase 3's precedent and workflow.human_verify_mode=end-of-phase)."
  - test: "Pending-pin map layer, PendingStatusSheet withdraw flow, and LocationDetailSheet code-update UI device walkthrough (04-06 Task 3)"
    expected: "After submitting, a gray dashed 'Pending' pin appears on the map for the submitter only (disappears when signed out / different account); tapping it opens PendingStatusSheet showing 'Pending — N of 2 GPS verifications received…' with no Rate/Report/Directions row; 'Withdraw submission' → 'Are you sure? This can't be undone' → confirm → pin disappears entirely; on a published location, signed-out 'Update door code' routes to AuthRequiredModal, signed-in propose-code shows a pending-confirmation state (never 'live now'); Component Acceptance Checklist (§20) walked."
    why_human: "Native Mapbox pin rendering, submitter-scoped visibility across accounts, and real-device withdraw/code-update flows cannot be exercised in jest — no physical device/simulator available in this environment."
---

# Phase 4: GPS Service & Submission Verification Report

**Phase Goal:** Users physically present at a bathroom can submit it. GPS sample is validated server-side. Submitted locations enter pending state awaiting verification. Access codes and timing tips are writable in this phase — before Phase 8 attempts to display them.
**Verified:** 2026-07-08
**Status:** human_needed
**Re-verification:** No — initial verification

## Verification Method

Read all 6 PLAN/SUMMARY pairs, 04-CONTEXT.md (D-01..D-30 decisions), 04-RESEARCH.md, 04-VALIDATION.md, 04-REVIEW.md, and cross-referenced every claim against the actual codebase: 3 migrations (`20260707020000_phase4_submission_staging.sql`, `20260707030000_phase4_access_code_update.sql`, `20260708000000_phase4_code_review_fixes.sql`), 2 pgTAP suites, 9 client `features/submit/*` modules + tests, and 4 UI files (`submit.tsx`, `PendingStatusSheet.tsx`, `WithdrawConfirmModal.tsx`, `SensitivityConfirmModal.tsx`, `LocationDetailSheet.tsx`, `index.tsx`). Independently ran `cd app && npx tsc --noEmit` (clean) and `cd app && npm test` (47 suites / 381 tests, all green) rather than trusting the SUMMARY.md-reported numbers. Verified all documented commit hashes exist in `git log`. Confirmed the code-review-fix migration (`20260708000000_phase4_code_review_fixes.sql`) is live and its `create or replace function` bodies actually contain the claimed fixes (CR-02 ownership guard, WR-01 non-null guarantee, WR-02 future-timestamp rejection, WR-03 visibility-filter parity, WR-04 not-found exception, WR-05 length CHECK, IN-01 enum CHECKs) by reading the SQL directly, not the review report's prose.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GpsService hook returns `{coord, accuracy, mocked, timestamp}` with high-accuracy mode | VERIFIED | `app/src/features/submit/useGpsSample.ts:20-36` requests `Location.Accuracy.BestForNavigation`, returns the exact shape, normalizes `pos.mocked ?? false` (iOS `undefined`→`false`), returns `{denied:true}` sentinel on non-granted permission (never throws). 8 tests in `useGpsSample.test.ts` cover granted/mocked/undefined-mocked/low-accuracy/null-accuracy/denied/undetermined cases, all passing. |
| 2 | Mocked locations are rejected at the RPC layer (not just client-side) | VERIFIED | `submit_location` (both migration versions) contains `if p_mocked is true then raise exception 'gps rejected'; end if;` — a server-side check independent of any client validation. pgTAP `phase4_submit.test.sql:86-89` asserts this via `throws_ok`. |
| 3 | `submit_location` RPC inserts a pending row and fires creator-initial verification event | VERIFIED (documented interpretation) | Insert sets `status='pending', confirmation_count=1`. A literal `verification_events` row is architecturally impossible pre-publish: `verification_events.location_id uuid not null references locations(id)` (confirmed at `20260519010000_remote_schema.sql:154`) and no `locations` row exists until Phase 5's publish gate. `confirmation_count=1` is the documented OQ-2 resolution standing in for the creator-initial event, consistent with Phase 5's stated 2-verification publish threshold. This is a reasoned, disclosed design decision, not a shortcut. |
| 4 | `submit_location` RPC accepts optional `access_code` and `timing_tips` fields and stores them correctly | VERIFIED | `p_access_code` (stored in `access_instructions`) and `p_timing_tip` (stored in `timing_tip`) are both optional params with DB-level defaults; `submitLocation.ts` forwards `accessCode` only when `policyTag==='code_required'` (D-17) and always forwards `timingTip`. `submit.tsx` Step 2 wires both fields via `Controller`. Wired end-to-end; confirmed by `submitLocation.test.ts` and `submit.test.tsx`. |
| 5 | `submit_location` RPC accepts an `access_sensitivity` value using the same community-set/correctable trust model as `policy_tag` (feeds Phase 3's `family_mode` filter) | VERIFIED (with disclosed scope note) | `p_access_sensitivity` accepts `'sensitive'`/`null` only (enforced by both client `submitLocation.ts` mapping and, since the code-review-fix migration, a server-side `CHECK` constraint). Submitter-set at submission, not admin-only, not auto-derived (D-06/D-08/D-09) — matches `policy_tag`'s current mechanism exactly. "Correctable by the community" is not yet wired for EITHER field (no `report_location`/report-based correction RPC exists yet in this codebase — confirmed via grep; D-16 tracks this as a Phase 7 schema gap). This is disclosed, symmetric with `policy_tag`'s current state, and not a Phase 4 regression. |
| 6 | Access code write path requires auth; stored value is NOT returned in public search results (only in authenticated LocationDetail reads) | VERIFIED | `update_access_code`/`confirm_access_code`/`get_access_code` all `raise exception 'not authenticated'` on `auth.uid() is null`, all revoked from `public`/`anon`, granted only to `authenticated`. `search_locations_bbox`/`search_locations_nearby`/`get_location_detail` (Phase 3, confirmed untouched by grep — 0 references to `access_instructions`) never select `access_instructions`. `get_access_code` is the sole code-returning read path. |
| 7 | GPS accuracy > 50m and stale fixes (>60s) are rejected server-side with a generic error | VERIFIED | `submit_location` reads `max_accuracy_m`/`max_gps_age_s` from `app_config` (coalesce defaults 50/60), rejects `p_accuracy_m > v_max_accuracy` and `(now()-p_captured_at) > max_age`, all collapsing to the single string `'gps rejected'`. Code-review fix additionally rejects future-dated timestamps (WR-02, `p_captured_at > now() + interval '5 seconds'`) — a bonus hardening beyond the literal SC text. pgTAP asserts all four rejection paths (mocked/accuracy/stale/future) with the identical error string. |
| 8 | SubmitFlow form validates with Zod, handles all error states (denied permission, low accuracy, failed write) | VERIFIED | `submitSchema.ts` (Zod, required name+policyTag, conditional PIN `superRefine`). `submit.tsx` maps `{denied:true}`→ERR-01, `accuracy>50`→ERR-02 (CTA disabled), stale (`>60s` client pre-check)→ERR-03 with Retry, RPC failure→ERR-08 with Retry and preserved form data. 11 component tests in `submit.test.tsx` assert each state including the ERR-08 form-preservation and the Hours-field wiring (CR-01 fix). |
| 9 | Newly submitted location appears on map in pending state visible only to submitter | CODE-VERIFIED; device confirmation deferred | Server: `get_my_pending_submissions` returns rows only for `submitter_id = auth.uid()`, anon gets zero rows (pgTAP-asserted). Client: `index.tsx` renders a SEPARATE `ShapeSource id="pendingLocations"`, `enabled: !!session`, not merged/clustered with the published source; tapping opens `PendingStatusSheet` (not `LocationDetailSheet`). All wiring is present and unit/component-tested, but real Mapbox rendering and cross-account visibility can only be confirmed on-device — see Human Verification below. |
| 10 | All screens pass Phase 1.5 component acceptance checklist before Codex review | PARTIALLY CODE-VERIFIED; full checklist walk deferred | Static portions verified directly: zero raw hex colors in any of the 5 new/modified UI files (grep confirmed), all spacing/typography/radius sourced from design tokens, 44/48/56pt touch targets used per component. The full checklist walk (a human task, per both 04-05-PLAN.md and 04-06-PLAN.md Task 3) is bundled into the same deferred device-UAT items as SC9 — not separately re-litigated. |

**Score:** 10/10 success criteria have code-level evidence; 2 (SC9, SC10) additionally require a human device walkthrough to close out the observable/experiential portion, already anticipated and documented by the executor as deferred device-UAT items.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260707020000_phase4_submission_staging.sql` | submissions staging columns + submit_location/get_my_pending_submissions/withdraw_submission | VERIFIED | Present, all 9 columns added, 3 RPCs with correct auth-gate + grant triple. Superseded in body (not schema) by the 20260708000000 fix migration via `create or replace`. |
| `supabase/migrations/20260707030000_phase4_access_code_update.sql` | locations code columns + update/confirm/get RPCs | VERIFIED | Present, 3 nullable columns added, 3 RPCs with correct stage-then-confirm logic. |
| `supabase/migrations/20260708000000_phase4_code_review_fixes.sql` | Post-review hardening (CR-02, WR-01..05, IN-01) | VERIFIED | Present and live-pushed; read directly — CR-02 ownership guard, WR-01/03/04 exception-raising fixes, WR-02 future-timestamp rejection, WR-05 length CHECK, IN-01 enum CHECKs all confirmed present in the SQL body, not just claimed in 04-REVIEW.md. |
| `supabase/tests/phase4_submit.test.sql` | pgTAP suite, 20 assertions | VERIFIED (file); NOT EXECUTED (tracked override) | `select plan(20)` matches 20 actual assertions counted directly. Never run — no Docker (same carryover as Phase 3; tracked todo `2026-07-07-run-pgtap-suite-on-docker-capable-machine.md` exists). |
| `supabase/tests/phase4_access_code.test.sql` | pgTAP suite, 16 assertions | VERIFIED (file); NOT EXECUTED (tracked override) | `select plan(16)` matches 16 actual assertions (15 `is`/`ok`/`throws_ok` + 1 `lives_ok`) counted directly. Same tracked override. |
| `app/src/lib/database.types.ts` | Regenerated types incl. all 6 new RPCs | VERIFIED | `submit_location`, `get_my_pending_submissions`, `withdraw_submission`, `update_access_code`, `confirm_access_code`, `get_access_code` all present (grep-confirmed at their line numbers). |
| `app/src/features/submit/useGpsSample.ts` | High-accuracy GPS hook | VERIFIED | Matches spec exactly; 100% test coverage claim consistent with 8 passing tests. |
| `app/src/features/submit/submitLocation.ts` | submit_location RPC wrapper | VERIFIED | D-09/D-17 mappings correct; raw error rethrow confirmed by reading the code (`if (error) throw error`). |
| `app/src/features/submit/submitSchema.ts` | Zod schema | VERIFIED | Required name/policyTag, conditional PIN `superRefine`, `hours` corrected to `string` (CR-01 fix) matching the actual single-input UI. |
| `app/src/features/submit/useMyPendingSubmissions.ts`, `withdrawSubmission.ts`, `updateAccessCode.ts` | Client service layer | VERIFIED | All three thin wrappers, correct RPC names/args, raw-error rethrow, data-flow traced (Level 4) below. |
| `app/src/app/(tabs)/submit.tsx` | 3-step wizard + Success screen | VERIFIED (>800 lines) | Auth gate, Step 1/2/3, Success screen, all LOCKED copy present verbatim, Hours field Controller-wired (CR-01 fix confirmed in source). |
| `app/src/app/(components)/SensitivityConfirmModal.tsx`, `WithdrawConfirmModal.tsx`, `PendingStatusSheet.tsx` | D-15/D-30 dialogs + pending sheet | VERIFIED | All present, correct copy, correct destructive/non-destructive styling, submittingRef re-entrancy guards where appropriate. |
| `app/src/app/(components)/LocationDetailSheet.tsx` | "Update door code" stage-then-confirm UI | VERIFIED | Signed-in gate via `AuthRequiredModal` (action='see access code'), pending-confirmation copy (never "live now"), 100-char `maxLength` (WR-05 fix confirmed). |
| `app/src/app/(tabs)/index.tsx` | Second pending ShapeSource + tap routing | VERIFIED | `id="pendingLocations"`, `enabled: !!session`, separate `handlePendingPress`, published branch (`handleShapePress`, `search_locations_bbox` usage) provably unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `submit_location` | `app_config` | `value::numeric` coalesce read | WIRED | Confirmed in SQL body, both migration versions. |
| `submit_location` | `submissions.coordinates` | `st_setsrid(st_makepoint(lng,lat),4326)::geography` | WIRED | Confirmed, schema-qualified as `extensions.*` (post 04-01 fix). |
| `get_my_pending_submissions` | `auth.uid()` | `submitter_id = auth.uid() AND status='pending'` | WIRED | Confirmed in SQL; pgTAP proves caller-scoping (user A/B isolation). |
| `confirm_access_code` | `locations.access_instructions` | copy pending→live only when confirmer ≠ proposer | WIRED | Confirmed; hardened further by WR-03 visibility-filter parity fix. |
| `get_access_code` | `auth.uid()` | authed-only grant + null-check | WIRED | Confirmed; also now raises on absent code (WR-01 fix) rather than returning a bare null. |
| `submitLocation` | `supabase.rpc('submit_location')` | `p_*` argument mapping | WIRED | Confirmed in `submitLocation.ts`; test-asserted. |
| `useGpsSample` | `expo-location` | `Accuracy.BestForNavigation` + `pos.mocked` | WIRED | Confirmed. |
| `useMyPendingSubmissions` | `supabase.rpc('get_my_pending_submissions')` | no-arg call → FeatureCollection | WIRED | Confirmed; data-flow traced below. |
| `updateAccessCode` | `supabase.rpc('update_access_code')` | stage-then-confirm pair | WIRED | Confirmed. |
| `index.tsx` | `useMyPendingSubmissions` | `useQuery` keyed `['pendingSubmissions', uid]`, `enabled: !!session` | WIRED | Confirmed at `index.tsx:97-103`. |
| `LocationDetailSheet.tsx` | `updateAccessCode` | "Update door code" action → stage + pending-confirmation state | WIRED | Confirmed; never displays the proposed code as live. |
| `PendingStatusSheet.tsx` | `withdrawSubmission` | withdraw → invalidate `['pendingSubmissions', uid]` | WIRED | Confirmed via `WithdrawConfirmModal` → `onWithdrawn` callback chain in `index.tsx`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `index.tsx` pending `ShapeSource` | `pendingCollection` | `useMyPendingSubmissions()` → `get_my_pending_submissions` RPC (real DB query, `auth.uid()`-scoped) | Yes | FLOWING |
| `PendingStatusSheet` | `submission.confirmationCount` | Read directly from the tapped feature's properties (sourced from the same real RPC row, no refetch, D-27) | Yes | FLOWING |
| `LocationDetailSheet` "Update door code" | `codeInput` → `updateAccessCode(locationId, code)` | Real RPC call, staged server-side; UI shows pending-confirmation copy, never treats it as live | Yes | FLOWING |
| `submit.tsx` Step 3 GPS readout | `gpsSample.accuracy` | `getGpsSample()` → real `expo-location` API call (device-dependent at runtime) | Yes (client-observable; server independently re-validates) | FLOWING |

No hardcoded/static empty returns found in any RPC or client module reviewed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full jest suite green | `cd app && npm test` | 47 suites / 381 tests passed | PASS |
| TypeScript compiles clean | `cd app && npx tsc --noEmit` | No output / exit 0 | PASS |
| pgTAP suite assertion counts match declared plan() | grep-counted vs `select plan(N)` | 20/20 and 16/16 | PASS |
| pgTAP suites actually execute | N/A — no Docker in this environment | Not run | SKIP (tracked override, see Carryover Risk) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention found in this project; PLAN/SUMMARY files reference pgTAP suites (covered above) and jest, not shell probes. N/A.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| REQ-SUBMIT | 04-01, 04-03, 04-05 | User can submit a new bathroom location with name, address, policy tag, access type, hours | SATISFIED | `submit_location` RPC + SubmitFlow wizard, full field coverage incl. CR-01-fixed Hours wiring |
| REQ-GPS-VALIDATE | 04-01, 04-03 | GPS accuracy, freshness, and mock detection enforced | SATISFIED | Server-side rejection in `submit_location`; client `useGpsSample` advisory layer |
| REQ-PENDING | 04-01, 04-04, 04-06 | Submitted locations enter a pending state until 2 independent GPS verifications | SATISFIED | `submissions.status='pending'`, `confirmation_count`, pending-pin UI + withdraw |
| REQ-SENSITIVITY | 04-01, 04-03, 04-05 | User sets `access_sensitivity` at submission, community-correctable like `policy_tag` | SATISFIED (with disclosed Phase-7-deferred correction mechanism, symmetric with policy_tag) | D-06/08/09/11 implemented; `family_mode` filter fed (Phase 3, unaffected) |
| REQ-TIMING | 04-01, 04-03, 04-05 | User can add timing tips | SATISFIED | `timing_tip` column + Step 2 field, forwarded unconditionally |
| REQ-CODE-WRITE | 04-01, 04-02, 04-04, 04-05, 04-06 | User can submit/update the access code (PIN) for a location | SATISFIED | Initial-submission PIN (D-17/D-19) + full stage-then-confirm update path (D-21/22/24/25), hardened by CR-02/WR-01/WR-03/WR-04/WR-05 |

No orphaned requirements found — all 6 requirement clauses in ROADMAP.md's Phase 4 "Requirements" line are claimed by at least one plan's frontmatter `requirements:` field, and all 6 have corresponding implementation evidence above. This project does not maintain a separate `.planning/REQUIREMENTS.md` file; ROADMAP.md's per-phase Requirements/Success Criteria block is the authoritative contract, used here directly.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/app/(tabs)/submit.tsx` | 96-103 | Accessibility checkboxes captured in local state, not forwarded on submit | INFO | Explicitly commented as a deferred item (no schema/RPC support this phase); disclosed in 04-05-SUMMARY.md; not a silent gap. |
| `app/src/features/submit/updateAccessCode.ts` | 29-47 | `confirmAccessCode`/`getAccessCode` have no UI call site yet | INFO | Reviewed and accepted as intentional (IN-02, infra-ahead-of-UI) in 04-REVIEW.md; tracked for a future confirmation-flow UI phase, not a Phase 4 defect. |
| N/A | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 27 files reviewed in 04-REVIEW.md or the 6 files independently spot-read here | — | Debt-marker gate clear. |

No blockers found. Both info items are explicitly disclosed, reasoned, and tracked — not silent omissions.

### Human Verification Required

#### 1. SubmitFlow wizard end-to-end device walkthrough

**Test:** Sign out → open Submit tab → confirm AuthRequiredModal blocks the form. Sign in → Step 1: enter name, tap "No address? Describe the location instead" and confirm free-text mode, pick a policy tag, toggle "Not suitable for kids" ON and read the effect explainer. Step 2: select Code Required and confirm the PIN field appears with the locked copy; switch policy and confirm it disappears; enter a timing tip. Step 3: confirm the live accuracy readout; indoors/low-accuracy keeps "I'm at This Location" disabled with ERR-02; move to an open area and confirm it enables. Because sensitivity is ON, confirm the D-15 dialog fires before submit; approve and confirm the Success screen appears with "Back to Map" returning to the map.
**Expected:** All described states and transitions occur exactly as specified; Component Acceptance Checklist (design-system.md §20) passes for this screen.
**Why human:** Real GPS accuracy readings, OS permission prompts, and Android mock-location detection cannot be exercised in jest; no physical device/simulator is available in this development environment.

#### 2. Pending-pin map layer, PendingStatusSheet withdraw, and code-update device walkthrough

**Test:** As the submitter (after submitting via the wizard), confirm a gray dashed "Pending" pin appears on the map, and that it disappears when signed out / viewing as a different account. Tap the pending pin → confirm the PendingStatusSheet shows "Pending — 1 of 2 GPS verifications received…" with no Rate/Report/Directions row. Tap "Withdraw submission" → confirm the "Are you sure? This can't be undone" dialog → confirm → the pin disappears from the map entirely. On a published location's LocationDetailSheet, signed out: confirm "Update door code" routes to AuthRequiredModal. Signed in: propose a new code → confirm a pending-confirmation state (not "live now").
**Expected:** All described behaviors occur exactly as specified; Component Acceptance Checklist (§20) walked before Codex review.
**Why human:** Native Mapbox pin rendering, submitter-scoped visibility across accounts, and real-device withdraw/code-update flows cannot be exercised in jest; no physical device/simulator is available in this development environment.

### Gaps Summary

No blocking gaps found. All 6 requirement IDs and all 10 ROADMAP success criteria have direct, independently-verified code evidence (migrations read line-by-line, client modules read and cross-checked against their tests, jest suite and `tsc` re-run independently rather than trusting SUMMARY.md's reported numbers). The phase's own code review (04-REVIEW.md) caught 2 critical + 5 warning + 2 info issues; 8 of 9 were fixed in a follow-up migration/commit that this verification confirmed is live and correct by reading the SQL directly; the 9th (IN-02) was accepted as an intentional, disclosed, non-blocking deferral.

The only open items are the two device-UAT walkthroughs both plans explicitly deferred (consistent with this project's `workflow.human_verify_mode = end-of-phase` default and Phase 3's precedent of 7 similarly-deferred items) and the pre-existing/carried-over pgTAP-never-executed risk (both Phase 3's suite and the two new Phase 4 suites), already tracked in `.planning/todos/pending/2026-07-07-run-pgtap-suite-on-docker-capable-machine.md`. Neither blocks phase progression per this project's established conventions — they route to `human_needed` status for the developer's explicit sign-off, not to `gaps_found`.

---

_Verified: 2026-07-08_
_Verifier: Claude (gsd-verifier)_
