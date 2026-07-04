---
phase: 3
slug: read-path-map
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `jest@29.7.0` + `jest-expo@~55` (pinned; jest@30 incompatible) + `@testing-library/react-native@^13.3.3` + `@testing-library/jest-native@^5` + `msw@^2.14.6` (`msw/native`) for mocking Supabase `/rest/v1/rpc/*` HTTP calls |
| **Config file** | `app/jest.config.js` (100% lines/branches on `src/features/**` + `src/lib/**`; `src/app/` screens excluded as thin wrappers) |
| **Quick run command** | `cd app && npm test -- <touched feature test>` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~30-60 seconds (full suite, current project size) |

RPC/RLS correctness is validated separately via pgTAP / local Supabase integration tests, NOT jest — see Manual/SQL section below.

---

## Sampling Rate

- **After every task commit:** Run `cd app && npm test -- <touched feature test>`
- **After every plan wave:** Run `cd app && npm test` (full suite, 100% gate on `src/features/**` + `src/lib/**`)
- **Before `/gsd:verify-work`:** Full jest suite green AND SQL/pgTAP RPC tests green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-xx | 01 | 1 | REQ-FAMILY | RLS/RPC — family_mode enforcement | RPC excludes `access_sensitivity='sensitive'` when `users.family_mode=true`, read via `auth.uid()` server-side, never a client param | integration (pgTAP) | local Supabase RPC test | ❌ W0 | ⬜ pending |
| 03-01-xx | 01 | 1 | REQ-EMERGENCY | — | `search_locations_nearby` returns nearest-N, excludes deleted/shadowbanned/suppressed | integration (pgTAP) | local Supabase RPC test | ❌ W0 | ⬜ pending |
| 03-01-xx | 01 | 1 | moderation filters | RLS/RPC — public search exclusions | shadowbanned/suppressed/deleted rows absent from all public RPC results | integration (pgTAP) | local Supabase RPC test | ❌ W0 | ⬜ pending |
| 03-01-xx | 01 | 1 | access-code gating | RLS/RPC — anon access | anon call to `get_location_detail` never returns `access_instructions` | integration (pgTAP) | local Supabase RPC test | ❌ W0 | ⬜ pending |
| 03-02-xx | 02 | 2 | REQ-MAP | — | bbox hook maps viewport→RPC, transforms rows→GeoJSON | unit (MSW) | `npm test -- src/features/locations/useLocationsBbox.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-xx | 02 | 2 | REQ-DETAIL | — | detail hook fetches + shapes; access-code absent for anon (client-side confirmation) | unit (MSW) | `npm test -- src/features/locations/useLocationDetail.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-xx | 03 | 2 | REQ-FILTER | — | filter store AND logic; null-data includes (D-08) | unit | `npm test -- src/features/filters/useFiltersStore.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-xx | 03 | 2 | REQ-SEARCH | — | denied-GPS empty/fallback state hook | unit | screen-level state hook test (thin screen excluded) | ❌ W0 | ⬜ pending |
| 03-04-xx | 04 | 3 | REQ-NEARBY | — | nearby hook sorts by distance; a11y row labels present | unit | `npm test -- src/features/locations/useNearby.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-xx | 04 | 3 | REQ-FAMILY-TOGGLE | RLS/RPC — write path | `update_profile` writes `family_mode`; read uses user-id-scoped TanStack Query key (cross-user cache-leak guard) | unit (MSW) | `npm test -- src/features/locations/useFamilyMode.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-xx | 02 | 2 | distance format | — | meters→mi/km by device locale | unit | `npm test -- src/features/locations/formatDistance.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact task IDs assigned by the planner; this table maps requirements to test surfaces, not final task numbering.*

---

## Wave 0 Requirements

- [ ] `src/features/locations/useLocationsBbox.test.ts` — stub for REQ-MAP
- [ ] `src/features/locations/useLocationDetail.test.ts` — stub for REQ-DETAIL
- [ ] `src/features/locations/useNearby.test.ts` — stub for REQ-NEARBY
- [ ] `src/features/locations/useFamilyMode.test.ts` — stub for REQ-FAMILY-TOGGLE
- [ ] `src/features/locations/formatDistance.test.ts` — stub for distance-format behavior
- [ ] `src/features/filters/useFiltersStore.test.ts` — stub for REQ-FILTER (D-07 AND logic, D-08 null-inclusion)
- [ ] MSW handlers for `/rest/v1/rpc/search_locations_bbox`, `/search_locations_nearby`, `/get_location_detail`, `/update_profile`
- [ ] SQL/pgTAP RPC test harness (confirm existing or establish) — covers REQ-FAMILY, REQ-EMERGENCY, moderation-filter and access-code assertions
- [ ] Test fixtures: sample location rows (published, suppressed, shadowbanned, sensitive) for filter assertions
- [ ] `@rnmapbox/maps` jest mock (per STACK.md §8 pattern) — extend for `ShapeSource`/`SymbolLayer`/`CircleLayer`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mapbox clustering visual behavior (pin colors, cluster badges, zoom-to-expand) | REQ-MAP | Native Mapbox rendering (`ShapeSource cluster:true`) is not observable through jest/RN Testing Library — no canvas assertions | Run app on device/simulator, verify cluster badges show dominant policy-tag color + count, tap-to-zoom expands cluster |
| LocationDetail bottom-sheet snap points (peek/half/full) and swipe-dismiss | REQ-DETAIL | `@gorhom/bottom-sheet` gesture/animation behavior is not meaningfully unit-testable | Manual device test: verify peek/half/full snap points render correct content tiers, swipe-down and tap-outside-scrim both dismiss |
| Nearby tab screen-reader semantics | REQ-NEARBY | Requires an actual screen reader (VoiceOver/TalkBack) to confirm `accessibilityRole`/`accessibilityLabel`/`accessibilityHint` produce correct spoken output | Manual VoiceOver/TalkBack pass over Nearby list rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
