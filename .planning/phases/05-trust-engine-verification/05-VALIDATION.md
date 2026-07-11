---
phase: 05
slug: trust-engine-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-11
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pgTAP via `supabase test db` (DB) + jest `^29.7.0` (client) |
| **Config file** | `supabase/tests/*.test.sql` (DB) / `app/jest.config.js` (client) |
| **Quick run command** | `cd app && npx jest <path>` |
| **Full suite command** | `supabase test db` (requires Docker — unavailable in this environment, tracked carry-forward) + `cd app && npm test` |
| **Estimated runtime** | ~30-60s client suite; DB suite unexecuted pending Docker |

---

## Sampling Rate

- **After every task commit:** Run the relevant jest file or targeted pgTAP suite file.
- **After every plan wave:** Run full jest suite (`cd app && npm test`) + `supabase test db` when Docker is available.
- **Before `/gsd:verify-work`:** Full suite must be green (pgTAP execution remains a tracked carry-forward override if Docker is still unavailable, consistent with Phase 3/4).
- **Max feedback latency:** ~60s (jest suite).

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| SC1 | `verify_location` validates GPS triple + inserts event | pgTAP | `supabase test db` (`phase5_verify_publish`) | ❌ Wave 0 | ⬜ pending |
| SC2 | `weight = trust_multiplier × proximity_decay × accuracy_decay` computed correctly | pgTAP | same | ❌ Wave 0 | ⬜ pending |
| SC3 | pending→published after 2 distinct verifiers, including concurrent race | pgTAP (2-session) | same | ❌ Wave 0 | ⬜ pending |
| SC4/SC5 | shadowbanned user's verification → weight 0, no publish | pgTAP | same | ❌ Wave 0 | ⬜ pending |
| SC6 | `trust_events` delta sign matches `action_type` | pgTAP | `phase5_verify_publish` | ❌ Wave 0 | ⬜ pending |
| D-43 | duplicate verify by same user on same submission rejected/no-op | pgTAP | `phase5_event_model` | ❌ Wave 0 | ⬜ pending |
| D-57 | atomic publish transaction; rollback on partial failure | pgTAP | `phase5_verify_publish` | ❌ Wave 0 | ⬜ pending |
| — | direct authenticated INSERT into `verification_events` still rejected (42501) | pgTAP | `phase5_event_model` | ❌ Wave 0 | ⬜ pending |
| SC7 | VerifyFlow accepted/rejected/denied states, generic rejection copy (no reason leaked) | jest | `cd app && npx jest features/verify` | ❌ Wave 0 | ⬜ pending |
| SC10 | private, non-comparative impact stat renders correctly | jest | `cd app && npx jest features/profile` | ❌ Wave 0 | ⬜ pending |
| SC9 | outbox idempotency / no double-send notification | pgTAP + jest | `phase5_notifications` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/tests/phase5_event_model.test.sql` — event-model schema evolution, D-43 uniqueness, verification_events lockdown regression
- [ ] `supabase/tests/phase5_discovery.test.sql` — 500m radius, exclusions (own + already-verified), result cap, no submitter-identity leak
- [ ] `supabase/tests/phase5_verify_publish.test.sql` — concurrency (2-session race), shadowban-zero, atomicity, rollback, trust delta sign
- [ ] `supabase/tests/phase5_confidence.test.sql` — numeric confidence authority, tier derivation, backfill correctness
- [ ] `supabase/tests/phase5_notifications.test.sql` — outbox idempotency, device-token RLS isolation
- [ ] `app/src/features/verify/__tests__/` — VerifyFlow state coverage, generic-error mapping
- [ ] `app/src/features/notifications/__tests__/` — permission/token/in-app-fallback paths

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live GPS-based verification walkthrough | SC1/SC7 | Requires physical device + real location fix; mocked GPS in CI can't validate real-world accuracy/timing | Walk to within 500m of a pending submission, run VerifyFlow, confirm accepted/rejected copy matches design; deferred per project's existing device-UAT pattern (Phase 3/4) |
| Push notification delivery end-to-end | SC9 | Requires live Expo push credentials — explicitly deferred behind a separate deployment checkpoint (D-66) | After live credentials are authorized and deployed, submit → verify → confirm push arrives on a physical device |
| pgTAP suite execution | SC1-SC6, D-43, D-57 | No Docker-backed local Supabase runner in this environment (same tracked override as Phase 3/4) | Run `supabase test db` on a Docker-capable machine per the existing pending todo |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (client); DB suite tracked as carry-forward override
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
