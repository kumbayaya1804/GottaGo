---
phase: 04
slug: gps-service-submission
status: reconciled
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
reconciled: 2026-07-07
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `jest@29.7.0` + `jest-expo@~55` (pinned; do not upgrade) — component: `@testing-library/react-native@^13.3.3` + `@testing-library/jest-native@^5`; network mocking: `msw@^2.14.6` (`msw/native`); RPC/RLS correctness: pgTAP against local Supabase (`supabase/tests/*.test.sql`, same harness as `phase3_read_rpcs.test.sql`) |
| **Config file** | `app/jest.config.js` (100% lines/branches on `src/features/**` + `src/lib/**`; `src/app/` excluded) |
| **Quick run command** | `cd app && npm test -- <path>` |
| **Full suite command** | `cd app && npm test` (jest) + pgTAP suite (`supabase/tests/phase4_submit.test.sql`, Docker-capable machine) |
| **Estimated runtime** | ~30s jest full suite; pgTAP ~10s (when runnable) |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npm test -- <touched feature test>`
- **After every plan wave:** Run `cd app && npm test` (full jest, 100% coverage gate on features/lib)
- **Before `/gsd:verify-work`:** Full jest suite green + pgTAP RPC suite green (or explicit tracked override, see Carryover Risk below)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

*Reconciled 2026-07-07 against the 6 finalized PLAN.md files (04-01..04-06).*

| Plan | Wave | Depends On | Requirement(s) | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|------------|-----------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01 | 1 | — | REQ-SUBMIT, REQ-GPS-VALIDATE, REQ-PENDING, REQ-SENSITIVITY, REQ-TIMING, REQ-CODE-WRITE | T-04-01..T-04-0x (Spoofed GPS, Info Disclosure — pending leak) | `submit_location` inserts pending `submissions` row (never `locations`), `confirmation_count=1`; rejects `mocked=true`/accuracy>50m/age>60s with generic error; `get_my_pending_submissions`/`withdraw_submission` scoped to `auth.uid()` | integration (SQL) | pgTAP `supabase/tests/phase4_submit.test.sql` | ❌ Wave 0 gap — MISSING (no Docker), static grep-count fallback disclosed in task `<verify>` | ⬜ pending |
| 04-02 | 2 | 04-01 | REQ-CODE-WRITE | T-04-07 (Tampering — overwrite; + sock-puppet confirm risk flagged by plan-checker, tracked not blocking) | `update_access_code`/`confirm_access_code` D-24 stage-then-confirm gate (`pending_access_code`/`pending_code_proposed_by`, confirmed by a *different* authed user), `access_code_confirmed_at` reset (D-22), access code never in public search | integration (SQL) | pgTAP `supabase/tests/phase4_access_code.test.sql` | ❌ Wave 0 gap — MISSING (no Docker), same disclosed fallback | ⬜ pending |
| 04-03 | 2 | 04-01 | (client layer for REQ-SUBMIT, REQ-GPS-VALIDATE) | — | `useGpsSample` returns `{coord,accuracy,mocked,timestamp}` (BestForNavigation, iOS `mocked`→false); `submitLocation` maps fields, sensitive→`'sensitive'`; `submitSchema` Zod validation (conditional PIN, required name/policy) | unit (TDD, MSW) | `npm test -- app/src/features/submit/__tests__/useGpsSample.test.ts`, `submitLocation.test.ts` | ✅ created this phase (TDD red→green) | ⬜ pending |
| 04-04 | 3 | 04-02, 04-03 | (client layer for REQ-PENDING, REQ-CODE-WRITE) | — | `useMyPendingSubmissions` scoped to caller only; `withdrawSubmission` deletes only caller's own pending row; `updateAccessCode` client wiring | unit (TDD, MSW) | `npm test -- app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts`, `withdrawSubmission.test.ts` | ✅ created this phase (TDD red→green) | ⬜ pending |
| 04-05 | 3 | 04-03 | REQ-SUBMIT, REQ-SENSITIVITY, REQ-TIMING, REQ-CODE-WRITE / SC8 | — | SubmitFlow 3-step wizard (RHF+Zod), all error states, `SensitivityConfirmModal` (D-15 confirm-before-submit) | component (RTL) | `npm test -- app/src/app/(tabs)/__tests__/submit.test.tsx` | ✅ created this phase | ⬜ pending |
| 04-06 | 4 | 04-04, 04-02 | (client layer for REQ-PENDING) / SC9 | — | Pending-pin map layer + `PendingStatusSheet` + `WithdrawConfirmModal` (D-30 confirm); "Update door code" on `LocationDetailSheet` | component (RTL) | `npm test -- app/src/app/(components)/__tests__/PendingStatusSheet.test.tsx`, `LocationDetailSheet.updateCode.test.tsx` | ✅ created this phase | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — task-level status fills in during `/gsd:execute-phase 4`.*

---

## Wave 0 Requirements

- [ ] `supabase/tests/phase4_submit.test.sql` — pgTAP RPC correctness (GPS rejection, pending insert, pending-scoping, withdraw, code-update gate)
- [ ] `src/features/submit/` (or `features/locations/`) test scaffolds: `useGpsSample`, `submitLocation`, `submitSchema`, `updateAccessCode`, `withdrawSubmission`, `useMyPendingSubmissions`
- [ ] MSW handlers for `/rest/v1/rpc/submit_location`, `/update_access_code`, `/get_my_pending_submissions`, `/withdraw_submission`
- [ ] `expo-location` jest mock fixtures (granted/denied, mocked true/false, accuracy/timestamp variants)
- [ ] Migration applied → `supabase gen types` → regenerate `app/src/lib/database.types.ts` (new `submissions` staging columns, `locations.access_code_confirmed_at`, 4 new RPCs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-device GPS accuracy/mock-detection on Android + iOS | REQ-GPS-VALIDATE | Emulator/simulator GPS providers behave differently than real hardware; `LocationObject.mocked` is Android-only and only meaningful on-device | Submit from a real device with mock-location app enabled (Android) → expect generic rejection; submit indoors (>50m accuracy) → expect rejection |
| SubmitFlow 3-step wizard end-to-end incl. pending pin appearing on map | SC9 | Full UI flow across screens, camera/GPS permission prompts | Walk through submit wizard on a device to a real bathroom location; confirm pending pin renders in `pinPending` color, visible only to submitter |

---

## Validation Sign-Off

- [x] All tasks have automated verify (pgTAP or jest) or explicit Wave 0 dependency — confirmed by plan-checker across all 6 plans
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — confirmed by plan-checker
- [x] Wave 0 covers all MISSING references (pgTAP files for 04-01/04-02, feature test scaffolds for 04-03/04-04, RTL component tests for 04-05/04-06, `database.types.ts` regen in both DB plans)
- [x] No watch-mode flags in any automated command — plan-checker found none
- [x] Feedback latency < 30s — jest full suite ~30s, pgTAP ~10s when runnable
- [x] `nyquist_compliant: true` set in frontmatter — reconciled against the 6 finalized PLAN.md files above

**Approval:** approved 2026-07-07 (plan-checker: 0 blockers, 4 non-blocking warnings — see 04-01-PLAN.md/04-02-PLAN.md `<verify>` blocks for the disclosed pgTAP/Docker gap, tracked as the same carryover override accepted in Phase 3)

---

## Carryover Risk (from 04-RESEARCH.md)

Phase 3's pgTAP suite (`phase3_read_rpcs.test.sql`, 24 assertions) has **never executed** — no Docker in this environment; tracked as an accepted override (todo: `2026-07-07-run-pgtap-suite-on-docker-capable-machine`). Phase 4 introduces 4 new RPCs whose correctness (GPS rejection, pending-row scoping, withdraw ownership, code-update gate) has **no automated coverage other than pgTAP**. The planner/executor should either:
(a) run the pgTAP suite (Phase 3 + Phase 4) on a Docker-capable machine before this phase closes, or
(b) explicitly re-accept the same tracked override and lean on Supabase MCP `apply_migration` + manual RPC probing as a stopgap — but this must be a conscious, user-signed-off decision at verification time, not a silent gap.
