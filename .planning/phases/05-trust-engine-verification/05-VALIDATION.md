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
| **Full suite command** | `supabase test db` on a Docker-capable or isolated non-production environment + `cd app && npm test` |
| **Estimated runtime** | ~30-60s client suite; DB duration measured on first required execution |

---

## Sampling Rate

- **After every task commit:** Run the relevant jest file or targeted pgTAP suite file.
- **After every plan wave:** Run full jest suite (`cd app && npm test`) + `supabase test db` when Docker is available.
- **Before the first Phase 5 live push and `/gsd:verify-work`:** the full inherited + Phase 5 pgTAP suite must be green. Phase 5 may not reuse the Phase 3/4 unexecuted-pgTAP override because trust/publish concurrency depends on it.
- **Max feedback latency:** ~60s (jest suite).

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| SC1 | `verify_location` validates GPS triple + inserts event | pgTAP | `supabase test db` (`phase5_verify_publish`) | ❌ Wave 0 | ⬜ pending |
| SC2 | `weight = trust_multiplier × proximity_decay × accuracy_decay` computed correctly | pgTAP | same | ❌ Wave 0 | ⬜ pending |
| SC3 | pending→published after two identities total: the creator's implicit claim (which counts even when the creator is currently shadowbanned — see D-69) plus one currently-eligible independent verifier; currently-shadowbanned creator's claim still counts but published location inherits shadowban_status=true (suppressed from public search) and the creator earns no published_contribution trust credit for it (D-69) | pgTAP — named two-session races: CREATOR-SHADOWBAN-RACE (session 2 must block, then reflect committed state — not a sequential either/or), DECIDING-VERIFIER-SHADOWBAN-RACE, CURRENT-CALLER-SHADOWBAN-RACE, plus a RECIPROCAL-USER lock-order test across two different submissions with overlapping creator/caller sets (proves no deadlock) | same | ❌ Wave 0 | ⬜ pending |
| SC4/SC5 | shadowbanned user's verification → weight 0, no publish, including the CURRENT CALLER being shadowbanned CONCURRENTLY mid-call (not just already-shadowbanned before the call starts) | pgTAP — single-session SHADOWBAN-AFTER-EVENT plus two-session CURRENT-CALLER-SHADOWBAN-RACE | same | ❌ Wave 0 | ⬜ pending |
| SC6 | `trust_events` delta sign matches `action_type` | pgTAP | `phase5_verify_publish` | ❌ Wave 0 | ⬜ pending |
| D-43 | duplicate verify by same user on same submission rejected/no-op | pgTAP | `phase5_event_model` | ❌ Wave 0 | ⬜ pending |
| D-57 | atomic publish transaction; rollback on partial failure | pgTAP | `phase5_verify_publish` | ❌ Wave 0 | ⬜ pending |
| D-36 | discovery + verification cooldowns are server-enforced and rejected verify attempts persist the timestamp | pgTAP | `phase5_discovery`, `phase5_verify_publish` | ❌ Wave 0 | ⬜ pending |
| D-40/D-41 | timed raw-GPS purge preserves derived evidence; account deletion purges immediately | pgTAP | `phase5_event_model`, `phase5_lifecycle_jobs` | ❌ Wave 0 | ⬜ pending |
| D-59 | past-due pending submissions become expired with events retained | pgTAP | `phase5_lifecycle_jobs` | ❌ Wave 0 | ⬜ pending |
| D-62/D-64 | selected accessibility tags stage/copy; grandfathered missing tags stay untagged | pgTAP + jest | `phase5_verify_publish`, submit tests | ❌ Wave 0 | ⬜ pending |
| D-68 | unseen publication is owner-scoped, renderable after pending row disappears, and acknowledgeable | pgTAP + jest | `phase5_verify_publish`, submission-publication tests | ❌ Wave 0 | ⬜ pending |
| — | direct authenticated INSERT into `verification_events` still rejected (42501) | pgTAP | `phase5_event_model` | ❌ Wave 0 | ⬜ pending |
| SC7 | VerifyFlow accepted/rejected/denied states, generic rejection copy (no reason leaked) | jest | `cd app && npx jest features/verify` | ❌ Wave 0 | ⬜ pending |
| SC10 | private, non-comparative impact stat renders correctly | jest | `cd app && npx jest features/profile` | ❌ Wave 0 | ⬜ pending |
| SC9 | idempotent enqueue + mutually exclusive queue claims (external delivery remains best-effort/at-least-once) | pgTAP + jest | `phase5_notifications` | ❌ Wave 0 | ⬜ pending |
| SC9-runtime | queue claim/ticket/receipt/backoff/DeviceNotRegistered and cron auth | pgTAP + Deno | `phase5_notifications`, `deno test .../index.test.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/tests/phase5_event_model.test.sql` — event-model schema evolution, D-43 uniqueness, verification_events lockdown regression
- [ ] `supabase/tests/phase5_discovery.test.sql` — 500m radius, exclusions (own + already-verified), result cap, no submitter-identity leak
- [ ] `supabase/tests/phase5_verify_publish.test.sql` — concurrency: CREATOR-SHADOWBAN-RACE, DECIDING-VERIFIER-SHADOWBAN-RACE, CURRENT-CALLER-SHADOWBAN-RACE (two-session each), and a RECIPROCAL-USER lock-order deadlock test across two submissions with overlapping creator/caller sets; plus shadowban-zero, atomicity, rollback, trust delta sign
- [ ] `supabase/tests/phase5_confidence.test.sql` — numeric confidence authority, tier derivation, backfill correctness
- [ ] `supabase/tests/phase5_notifications.test.sql` — outbox idempotency, device-token RLS isolation
- [ ] `supabase/tests/phase5_lifecycle_jobs.test.sql` — raw-GPS purge, expiry transition, disabled promotion
- [ ] `app/src/features/verify/__tests__/` — VerifyFlow state coverage, generic-error mapping
- [ ] `app/src/features/notifications/__tests__/` — permission/token/in-app-fallback paths
- [ ] `supabase/functions/drain-notification-outbox/index.test.ts` — cron auth, claims, tickets, receipts, retry and invalid-token handling

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live GPS-based verification walkthrough | SC1/SC7 | Requires physical device + real location fix | Discover within 500m, move to within the 100m server verification gate, run accepted/rejected/denied/offline/retry paths, and confirm generic server-rejection copy |
| Push notification delivery end-to-end | SC9 | Requires live Expo push credentials — explicitly deferred behind a separate deployment checkpoint (D-66) | After live credentials are authorized and deployed, submit → verify → confirm push arrives on a physical device |
| pgTAP suite execution | SC1-SC6 and trust/lifecycle/RLS/concurrency boundaries | Current workstation lacks Docker | BLOCK the first Phase 5 live push until `supabase test db` passes on a Docker-capable or isolated non-production environment |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (client); the full inherited + Phase 5 pgTAP DB suite is a BLOCKING pre-push gate (no carry-forward override — see line 32) that must pass on a Docker-capable or isolated non-production environment before any Phase 5 live push
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
