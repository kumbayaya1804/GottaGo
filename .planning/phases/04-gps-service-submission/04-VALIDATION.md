---
phase: 04
slug: gps-service-submission
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-xx | 01 | 0 | REQ-GPS-VALIDATE | Spoofed GPS / Info Disclosure | RPC rejects `mocked=true`, accuracy>50m, age>60s with generic error | integration (SQL) | `pgTAP supabase/tests/phase4_submit.test.sql` | ❌ W0 | ⬜ pending |
| 04-01-xx | 01 | 0/1 | REQ-GPS-VALIDATE | — | GpsService hook returns `{coord,accuracy,mocked,timestamp}`, high-accuracy mode; iOS `mocked`→false | unit | `npm test -- src/features/locations/useGpsSample.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-xx | 02 | 0 | REQ-SUBMIT | Info Disclosure (pending leak) | `submit_location` inserts pending row on `submissions` (not `locations`), `confirmation_count=1`, coords as geography | integration (SQL) | pgTAP | ❌ W0 | ⬜ pending |
| 04-02-xx | 02 | 1 | REQ-SUBMIT | — | submit mutation maps fields, sensitive→`'sensitive'`, PIN only when `policy_tag='Code Required'` | unit (MSW) | `npm test -- src/features/submit/submitLocation.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-xx | 03 | 0 | REQ-CODE-WRITE | Tampering (malicious overwrite) | access code never in public search; `update_access_code` D-24 confirm-before-overwrite gate + `access_code_confirmed_at` reset | integration (SQL) | pgTAP | ❌ W0 | ⬜ pending |
| 04-03-xx | 03 | 0 | REQ-PENDING | Elevation of Privilege | `get_my_pending_submissions` returns only caller's pending rows; anon → none | integration (SQL) | pgTAP | ❌ W0 | ⬜ pending |
| 04-03-xx | 03 | 0 | REQ-PENDING | Tampering (withdraw others') | `withdraw_submission` deletes/cancels only the caller's own pending row | integration (SQL) | pgTAP | ❌ W0 | ⬜ pending |
| 04-02-xx | 02 | 0 | REQ-SENSITIVITY | — | staged `access_sensitivity` value survives staging (full filter semantics land Phase 5 publish) | integration (SQL, staging assert) | pgTAP | ❌ W0 | ⬜ pending |
| 04-04-xx | 04 | 1 | SC8 | Input Validation | SubmitFlow Zod schema: conditional PIN, required name/policy, all error states | unit | `npm test -- src/features/submit/submitSchema.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact task IDs finalized once the planner assigns plan/wave numbers — this map will be reconciled against the actual PLAN.md files.*

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

- [ ] All tasks have automated verify (pgTAP or jest) or explicit Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (pgTAP file, feature test scaffolds, MSW handlers, GPS mocks, type regen)
- [ ] No watch-mode flags in any automated command
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter once planner finalizes task IDs against this map

**Approval:** pending

---

## Carryover Risk (from 04-RESEARCH.md)

Phase 3's pgTAP suite (`phase3_read_rpcs.test.sql`, 24 assertions) has **never executed** — no Docker in this environment; tracked as an accepted override (todo: `2026-07-07-run-pgtap-suite-on-docker-capable-machine`). Phase 4 introduces 4 new RPCs whose correctness (GPS rejection, pending-row scoping, withdraw ownership, code-update gate) has **no automated coverage other than pgTAP**. The planner/executor should either:
(a) run the pgTAP suite (Phase 3 + Phase 4) on a Docker-capable machine before this phase closes, or
(b) explicitly re-accept the same tracked override and lean on Supabase MCP `apply_migration` + manual RPC probing as a stopgap — but this must be a conscious, user-signed-off decision at verification time, not a silent gap.
