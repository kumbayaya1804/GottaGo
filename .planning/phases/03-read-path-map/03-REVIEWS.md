---
phase: 3
reviewers: [antigravity, codex]
reviewed_at: 2026-07-05T16:09:38-00:00
plans_reviewed:
  - .planning/phases/03-read-path-map/03-01-PLAN.md
  - .planning/phases/03-read-path-map/03-02-PLAN.md
  - .planning/phases/03-read-path-map/03-03-PLAN.md
  - .planning/phases/03-read-path-map/03-04-PLAN.md
  - .planning/phases/03-read-path-map/03-05-PLAN.md
---

# Cross-AI Plan Review — Phase 3: Read Path & Map

Note: Gemini, Claude (self), OpenCode, Qwen, and Cursor CLIs were unavailable or excluded in this environment (only Codex and Antigravity CLIs are installed; Claude CLI would be self-review). Per this project's Reviewer Contract (`CLAUDE.md`), Claude wrote review packets (`.claude/codex-prompt-latest.md`, `.claude/antigravity-prompt-latest.md`) and the user ran both reviewers manually, saving verdicts to `.claude/codex-review-latest.md` and `.claude/antigravity-review-latest.md`.

## Antigravity Review

**VERDICT: REQUEST CHANGES**

### Summary
The proposed plan set provides a solid structural foundation for the Phase 3 Read Path. Spatially, it correctly utilizes geodesic PostGIS calculations (`ST_Distance` on `geography`) to prevent flat-surface degree distortion, and leverages standard `@rnmapbox/maps` native clustering to keep rendering overhead low. However, the current plans suffer from several significant PostGIS performance and logical defects: the bbox queries cast columns, bypassing the spatial index; filters do not comply with the locked default-include null policy (Decision D-08); the `update_profile` function wipes out display names during family mode toggles; and viewport pans across the 180-meridian will crash the application. These must be resolved before proceeding to execution.

### Issues

**[CRITICAL] `update_profile` Display Name Wipe Bug** — `03-01-PLAN.md:166`
The planned `update_profile(new_display_name text, new_family_mode boolean default null)` sets `display_name = new_display_name` unconditionally. Toggling family mode calls `update_profile(null, true)`, which would set `display_name = NULL` in the database, erasing it. Fix: use `case when new_display_name is not null then new_display_name else display_name end` (and the equivalent for `family_mode`).

**[MAJOR] Bbox Spatial Index Bypass** — `03-01-PLAN.md:162`
`where l.coordinates::geometry && ST_MakeEnvelope(...)` casts the indexed `geography` column to `geometry` on the left-hand side of `&&`, preventing the GiST index on `coordinates` from being used — forcing a sequential scan on every pan/zoom. Fix: keep the column raw and cast the envelope to `geography` instead: `l.coordinates && ST_MakeEnvelope(...)::geography`.

**[MAJOR] Violation of Decision D-08 (Incorrect Null Filtering)** — `03-01-PLAN.md:162`
D-08 requires locations with missing/null underlying data to be INCLUDED by default when a data-dependent filter is active. The planned `exists (select 1 from tags ...)` / `is_open_now = true` clauses will hide any location with missing data as soon as a filter is turned on — including all seed/new locations. Fix: add a "does this location have any data for this dimension at all" escape clause to each filter (e.g. `not exists (... key='accessibility')` as an additional OR branch), not just a direct boolean/tag match.

**[MAJOR] Bbox Antimeridian Crossing Crash** — `03-01-PLAN.md:162`
Panning across longitude 180 produces `min_lng > max_lng`, which `ST_MakeEnvelope` rejects with an exception, crashing the RPC. Fix: detect `min_lng > max_lng` and split into two envelopes (one wrapping to 180, one from -180), unioned with `OR`.

### Concerns
- **[MEDIUM]** Zustand + MMKV persistence is durable across app restarts by default, which would violate D-05 (filters must reset on cold start) unless the hook explicitly clears filters on first mount of a new process / injects a session marker.
- **[LOW]** The `tags` table lacks a composite index on `(location_id, key, value)` — negligible now, worth adding as data grows.

### Suggestions
- pgTAP tests for family_mode should use `set_config('request.jwt.claims', ...)` (or equivalent) to genuinely impersonate a family_mode=true vs. false user, not just query as service role.
- Test `max_pins_per_viewport` by calling with `max_pins := 2` against a larger seed set, rather than seeding >200 rows.

### Approved
- SECURITY DEFINER RPC isolation of client logic from structural fields (`deleted_at`, `shadowban_status`, `access_instructions`) is architecturally correct.
- Native `ShapeSource` clustering avoids expensive JS-side grid computation.
- Locale-based distance formatting matches the global launch strategy.

---

## Codex Review

**VERDICT: REQUEST CHANGES**

### Summary
The Phase 3 plan set is close: the wave ordering is coherent, the server-side moderation/family_mode boundary is mostly in the right layer, and the test plan correctly separates SQL/RPC correctness from React Native rendering checks. Codex would not start Wave 1 yet: two requirements are planned in a way that will fail later waves — the `family_mode` toggle writes through an RPC signature that cannot support family-mode-only calls, and the denied-GPS/manual-search flow no longer has a real city/address search mechanism despite ROADMAP and the UI spec still requiring one. There is also a medium configuration gap around `max_pins_per_viewport` being seeded but not actually used as the tunable source of truth.

### Concerns

**[HIGH] `update_profile` cannot support the planned family-mode-only write.**
Plan 03-01 defines `update_profile(new_display_name text, new_family_mode boolean default null)` keeping `display_name = new_display_name` (`03-01-PLAN.md:166,179`), but Plan 03-02's `setFamilyMode(value)` calls `rpc('update_profile', { new_family_mode: value })` with no `new_display_name` (`03-02-PLAN.md:200,204`), and Plan 03-04 wires the Settings switch through that same call (`03-04-PLAN.md:128-135`). This breaks ROADMAP SC12 before the toggle can work. Fix: make both args optional with `coalesce()` semantics (matches Antigravity's independently-found CRITICAL finding above), or add a dedicated `set_family_mode` RPC. Add tests proving a family-mode-only call changes only `family_mode` and a display-name-only call still works.

**[HIGH] The denied-GPS "manual city/address search" requirement is not actually planned.**
PROJECT.md (`:29-32`), ROADMAP SC6 (`:117-126`), and the locked UI spec (`03-UI-SPEC.md:127`, which specifies Google Places + an active focused search bar) all require a real manual city/address search when GPS is denied. Plan 03-05 instead explicitly scopes out Google Places/external geocoding and implements only "recenter + pan + Search this area" (`03-05-PLAN.md:76-77,98,128`) — a pan-and-refetch fallback, not a city/address search. Fix: either implement a minimal address/city resolution contract in Phase 3 (key management, privacy/logging constraints, empty/error states, tests), or explicitly revise PROJECT/ROADMAP/UI-SPEC before execution so Phase 3 no longer claims city/address search.

**[MEDIUM] `max_pins_per_viewport` is seeded but not used as the authoritative tunable.**
`app_config.max_pins_per_viewport` is claimed as the bbox RPC's limit source (`03-01-PLAN.md:34,62-65,135`), but the RPC contract still just accepts a client-passed `max_pins integer default 200` (`03-01-PLAN.md:162`; client passes it too, `03-02-PLAN.md:168`), and the pgTAP plan only checks that bbox respects a passed max, not that changing `app_config` changes server behavior (`03-01-PLAN.md:196`). Fix: have the RPC resolve the cap from `app_config` server-side (clamping any caller-provided value defensively), and test that updating `app_config` changes the observed cap.

**[MEDIUM] The current-position source for map/detail/Nearby distance is under-specified and partially misidentified.**
Plan 03-03 directs implementers to `app/src/features/auth/gpsConsent.ts` as the current-coordinates source (`03-03-PLAN.md:106-109,118`), but that file only requests foreground permission and records consent — it never exposes current coordinates (`gpsConsent.ts:19-29`). Since LocationDetail distance and Nearby sorting depend on real `userLat/userLng`, the plans should name one tested current-location hook/service (with permission-denied/null/stale cases) instead of leaving duplicated screen-level Expo Location calls in thin screens.

### Suggestions
- Add an acceptance criterion to 03-01 exercising all intended `update_profile` call shapes against the generated `database.types.ts` args, not just a grep for `new_family_mode`.
- Add an SC coverage table to the phase summary before execution — SC2/3/4/8/9/11 are well covered; SC6 and SC12 need the fixes above.
- Treat manual device checks as gates only after the automated contracts are corrected, so device verification doesn't surface issues the plan should have caught.

### Risk Assessment
**MEDIUM-HIGH** until the fixes land. Core security posture is directionally good (server-filtered reads, sensitive columns omitted, SQL-layer tests planned), but two visible Phase 3 commitments — city/address search and family-mode activation — don't currently line up with their implementation contracts. Starting Wave 1 uncorrected risks downstream churn across 03-02–03-05 and could leave SC6/SC12 falsely marked complete.

---

## Consensus Summary

### Agreed Concerns (raised independently by both reviewers — highest priority)
- **`update_profile` / family_mode toggle is broken as planned.** Antigravity (CRITICAL) traced the exact bug: the RPC unconditionally sets `display_name = new_display_name`, so the family-mode-only call `update_profile(null, true)` nulls out the user's display name. Codex (HIGH) independently traced the same defect from the other direction — 03-02/03-04's family-mode-only call site has no `new_display_name` to pass. Both proposed the same fix: `coalesce()`/conditional-update semantics on both columns (or a dedicated `set_family_mode` RPC), plus a test proving a family-mode-only call touches only `family_mode`.

### Divergent Findings (each reviewer caught issues the other didn't — both need addressing)
- **Antigravity-only (PostGIS-specific, not visible without spatial expertise):**
  - Bbox `&&` cast bypasses the GiST index (`coordinates::geometry` on the LHS) — full seq scan every pan/zoom.
  - D-08 null-inclusion policy is violated by the planned filter SQL as written.
  - Antimeridian crossing (`min_lng > max_lng`) will crash `ST_MakeEnvelope`.
- **Codex-only (product/contract-compliance, not visible without cross-referencing PROJECT/ROADMAP/UI-SPEC):**
  - The denied-GPS fallback silently drops the "manual city/address search" requirement in favor of pan-only — a scope regression against three locked documents (PROJECT, ROADMAP SC6, UI-SPEC), not just a technical gap.
  - `max_pins_per_viewport` is configured but not actually read back by the RPC — the admin-tunable requirement (D-32) is currently decorative.
  - The current-location source named in 03-03 (`gpsConsent.ts`) does not actually expose coordinates — a broken cross-reference that would surface as a runtime bug, not a planning nitpick.

### Agreed Strengths
- SECURITY DEFINER RPC isolation of client logic from structural/sensitive fields (`deleted_at`, `shadowban_status`, `access_instructions`) is architecturally sound.
- The four-clause moderation filter + server-derived `family_mode` via `auth.uid()` (never a client parameter) is correctly placed in the RPC layer.
- Wave dependency ordering (01→02→03→04/05) is coherent and the validation plan correctly separates SQL/pgTAP correctness from Jest/device-level checks.

### Recommendation
**Do not start Wave 1 execution yet.** Six issues need to land in the plans before `/gsd:execute-phase 3`: the shared `update_profile` fix (both reviewers), the three PostGIS defects (Antigravity), and the two contract-compliance gaps (Codex — one of which, the manual search regression, needs a product decision, not just a code fix, since it either requires scoping in a geocoding dependency or a deliberate ROADMAP/UI-SPEC revision). Recommend running `/gsd:plan-phase 3 --reviews` to incorporate this feedback before execution.
