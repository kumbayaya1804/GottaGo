# Phase 3: Read Path & Map - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The map renders real bathroom locations fetched from Supabase via PostGIS RPCs (`search_locations_bbox`, `search_locations_nearby`, `get_location_detail`). Public search excludes deleted/shadowbanned/suppressed/family_mode-sensitive records, enforced at the RPC layer. Users can filter, view a no-results/denied-location fallback, and tap a pin to see LocationDetail. This phase also closes two scope gaps discovered during discussion (Nearby list-view tab, family_mode settings toggle) that were designed in Phase 1.5 but never scheduled into any phase.

Emergency Mode's FAB/bottom-sheet UI is explicitly Phase 8's job — Phase 3 only builds the underlying `search_locations_nearby` RPC (ROADMAP SC4).

</domain>

<decisions>
## Implementation Decisions

### Map Viewport & Refresh Behavior
- **D-01:** Auto-refetch `search_locations_bbox` as the user pans/zooms, debounced 400ms after the map stops moving.
- **D-02:** Reuse the existing Phase 1.5 loading pattern for refetches (pins appear as data arrives; subtle non-blocking banner only if fetch exceeds 2s) — no new loading UI.
- **D-03:** Map viewport (center/zoom) persists within a session — leaving to another tab and returning to Map does NOT snap back to live GPS position. Resets only on a true cold start.
- **D-04:** Beyond a max zoom-out threshold, stop loading individual pins and show "Zoom in to see individual locations" instead of a misleadingly-sparse subset of a huge area. (Exact threshold: planner/researcher determines based on the pin cap in D-15.)

### Filters
- **D-05:** Filter chips reset on cold start (app fully closed and relaunched); no filter is active by default on fresh launch.
- **D-06:** Filters persist within a session — navigating to Profile and back to Map does not clear them.
- **D-07:** Multiple selected filters use AND logic (must match ALL selected filters, not any).
- **D-08:** Uniform policy across every data-dependent filter (Currently Open, Wheelchair Accessible, Changing Table, Cleanliness): a location with missing/null underlying data is INCLUDED by default, never silently excluded. Applies even though the underlying data (tags, ratings, hours) won't exist until Phase 4/8 ship — prevents each filter from hiding nearly all results during that window.

### No-Results State
- **D-09:** "Search this area" button re-runs the bbox query for the current viewport (not radius expansion).
- **D-10:** Distinguish "no bathrooms match your filters" (filtered-empty, with a clear-filters affordance) from "no bathrooms found nearby" (truly empty) — critical so a filtered user doesn't think there's genuinely nothing nearby.
- **D-11:** Keep the "Search this area" button even though auto-refetch (D-01) already covers panning — it's the explicit affordance for landing on empty results without having panned.

### LocationDetail Scope
- **D-12:** Build the full peek/half/full bottom-sheet component matching the Phase 1.5 design system now (not a minimal placeholder modal) — avoids a rebuild when later phases add functionality.
- **D-13:** Verify/Rate/Report action-row buttons are HIDDEN ENTIRELY (not shown-disabled) until their respective phases (4/8/6-7) ship real functionality. The action row appears once the first action (Verify, Phase 4) lands.
- **D-14:** Timing tips and ratings-summary sections are hidden entirely (not shown as empty states) until Phase 4/8 populate real data.
- **D-15:** Show the full designed confidence badge now (colored pill + tier text + verification count, e.g. "High — 14 GPS verifications") — the underlying `confidence_scores` data already exists in the live schema.
- **D-16:** "Last verified" displays as a relative label ("Verified 3 days ago"), not an exact timestamp.
- **D-17:** Dismiss via swipe-down or tap-outside-the-sheet — no explicit close button.
- **D-18:** When a location has no hours data, show explicit "Hours not yet available" copy rather than hiding the section.

### Directions (new addition — not in original Phase 1.5 design)
- **D-19:** Add a "Get Directions" button to the standard (non-emergency) LocationDetail action row — opens the device's native maps app with destination coordinates, same mechanism as Emergency Mode's existing "Navigate" CTA. Phase 1.5's design only specified this for Emergency Mode; the gap was identified during this discussion and the user chose to close it now since it has no dependency on later phases.
- **D-20:** Positioned first/leftmost in the action row: `[Get Directions] [GPS Verify] [Rate] [Report]` (with D-13's hidden-until-shipped rule applying to the latter three).
- **D-21:** No auth gate on Get Directions — available to anonymous browsers, unlike Verify/Rate/Report which require sign-in.

### Distance & Units
- **D-22:** Distance is straight-line/geodesic (PostGIS `ST_Distance`), not a routing/walking-time estimate — avoids adding an external routing-API dependency and per-pin latency.
- **D-23:** Display units auto-detect by device locale (miles for US/UK-locale devices, km/m elsewhere) — consistent with the global-availability launch strategy.

### Anonymous User Access
- **D-24:** Anonymous/unauthenticated users see everything in search results and LocationDetail except the access code (name, address, policy tag, confidence, last-verified, accessibility tags, hours all visible). No additional gating beyond the already-established PIN restriction.

### Map Visuals
- **D-25:** Mapbox map style switches between light/dark variants matching the app's theme (consistent with Phase 1.5's OS-following dark mode).
- **D-26:** Show a standard "you are here" blue-dot marker for the user's live GPS position, distinct from bathroom pins (via Mapbox's built-in user-location layer).
- **D-27:** Map screen itself is visual-only — no pin-level screen-reader/accessibility-action support is required. The Nearby list-view screen (D-29 below) is the designated accessible alternative per Phase 1.5's own nav model; duplicating that effort on the map canvas is out of scope.

### RPC / Network Failure Handling
- **D-28:** On a full RPC failure (network/server error), show an explicit error banner with a Retry button — never fail silently, critical for an urgency-focused app. Previously-loaded ("stale") pins remain visible on screen under the banner rather than clearing to an empty map.

### Scope Additions — Gaps Found During Discussion
Two systematic cross-reference passes (Phase 1.5's design doc + PROJECT.md requirements vs. actual ROADMAP scheduling) surfaced two features that were designed but never scheduled into any phase. The user chose to close both within Phase 3 rather than leave them as silent gaps:

- **D-29 — Nearby list-view tab:** Phase 1.5 explicitly designed this as the accessible alternative to the map ("List view sorted by distance; accessible alt to map" — part of the WCAG 2.1 AA commitment), but no phase's ROADMAP success criteria ever scheduled building it. Add it now as **new plan 03-04**, reusing the same `search_locations_bbox`/`search_locations_nearby` RPC data as MapScreen, rendered as a sorted list instead of pins. Depends on 03-01 (RPCs), same as 03-02/03-03.
- **D-30 — family_mode Settings toggle:** Phase 3 builds RPC-layer enforcement of the `family_mode` filter (ROADMAP SC3), but no phase anywhere adds a UI for a user to ever turn `family_mode` on — making the filter unreachable for any real user. Add a small toggle to the existing Settings screen (`app/src/app/(tabs)/profile.tsx`, built in Phase 2). Write path extends the existing `update_profile` RPC (Phase 2, SECURITY DEFINER, authenticated-only) with an optional `family_mode` parameter, rather than creating a near-duplicate RPC. **Folded into plan 03-04** alongside the Nearby screen (both are discussion-discovered gap-closures for Phase 3, not warranting separate plans).
- **D-31 — Dev-only seed script/migration:** The live `locations` table currently has zero rows (confirmed: no seed INSERTs in any migration) — Phase 3 has nothing real to render/demo without it, and Phase 4 (Submit) is what would normally populate it. Add a dev-only seed script/migration (~10-20 fake locations) that only runs against dev/local Supabase, never production. Geographic center: **Claude's discretion at implementation time** (user suggested Eugene, OR — matches the "Eugene density requirement" constraint elsewhere in the project — but did not lock it).
- **D-32 — Max pins per viewport as tunable config:** The ~200-pin-per-viewport cap (from `.planning/research/ARCHITECTURE.md`) should be a tunable `app_config` value, not a hardcoded constant — consistent with the established Phase 1 pattern (`max_accuracy_m`, `verify_radius_m`, `decay_half_life_days`, etc.), admin-editable via Supabase Studio without a redeploy.
- **D-33 — Accepted exception: Phase 1.5 typography/spacing tokens exceed gsd-ui-checker's generic thresholds.** `/gsd:ui-phase 3`'s checker BLOCKed the UI-SPEC on two mechanical rules: (1) more than 4 font sizes (Phase 3 exercises 5: 22/17/15/13/11px from the locked `typography.ts` scale) and more than 2 font weights (Phase 3 uses 3: 400/500/600), and (2) spacing values outside the standard {4,8,16,24,32,48,64} set (`spacing.ts` includes `md=12px` and `lg=20px`). Both stem from the already-shipped, already-in-use Phase 1.5 design system (`app/src/constants/typography.ts`, `spacing.ts`), not a Phase-3-specific authoring choice — shrinking them now would mean reworking already-built Phase 1/2 screens for a generic visual-noise heuristic, not a real defect. User explicitly accepted these as an intentional, standing exception (2026-07-04): do not re-flag this in Phase 3 or any future phase reusing the same token files. `03-UI-SPEC.md` is approved with this exception recorded rather than trimmed to fit.

### Cross-AI Review Decisions (2026-07-05)
- **D-34 — [APPROVED 2026-07-05] Denied-GPS fallback narrowed to recenter + "Search this area" (no external geocoding).** ROADMAP SC6, PROJECT.md, and the LOCKED UI-SPEC ERR-01 all described the GPS-denied fallback as a "manual city/address search (Google Places)". Cross-AI review (Codex, 2026-07-05) flagged that plan 03-05 as written implements only map-recenter + pan + "Search this area" (bbox re-query) with NO geocoding — a real narrowing of three locked documents, not merely a technical gap. RESEARCH.md OQ-4 (RESOLVED) recommended exactly this narrowing for Phase 3 (deferring a Places/geocoding API + key + rate-limit/privacy surface to its own future plan). User approved the narrow-defer option (2026-07-05): Phase 3 ships recenter + pan + "Search this area" only, no external geocoding dependency. ROADMAP SC6 and UI-SPEC ERR-01 have been updated to match this narrowed scope. Full city/address Places autocomplete is deferred to a separate future decision/plan (see Deferred Ideas below). 03-05's Task 0 decision checkpoint is resolved — plans proceed as written.

### Claude's Discretion
- Exact geographic center/coordinates for the dev seed data (D-31) — user explicitly deferred this to implementation time.
- Exact max zoom-out threshold for D-04's pin-loading cutoff.
- Clustering implementation approach: `.planning/research/ARCHITECTURE.md` specifies client-side `supercluster` library over raw points from the bbox RPC; Phase 1.5's context doc mentions Mapbox's native `ShapeSource`/`cluster: true` GeoJSON clustering. This is a technical implementation detail, not a user-facing gray area — the phase researcher should reconcile these using `ARCHITECTURE.md` (the dedicated, more specific technical research artifact) as authoritative, and confirm during research rather than re-asking the user.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 3: Read Path & Map" (lines 100-121) — goal, requirements, 11 success criteria, draft plans 03-01/02/03
- `.planning/PROJECT.md` — Map & Discovery requirements section; global-availability launch strategy; Eugene density requirement context

### Design System (Phase 1.5)
- `.planning/phases/01.5-ux-foundation-design-system/01-5-CONTEXT.md` — LocationDetail bottom sheet snap points, action row, confidence badge tiers, map pin colors/clustering badge, filter chip row, search bar behavior, loading/skeleton states, dark mode tokens, Emergency Mode (Phase 8, not this phase)
- `docs/design/design-system.md` §20 — Component Acceptance Checklist, must be cited in this phase's PLAN.md files before the review gate (ROADMAP SC10)

### Technical Research
- `.planning/research/ARCHITECTURE.md` — authoritative on client-side `supercluster` clustering approach (server returns raw points, client clusters visually); build-order tier boundaries
- `.planning/research/STACK.md` — Mapbox `<ShapeSource>` + `<SymbolLayer>` performance pattern (avoid plain `View` children for >50 markers)

### Schema & RPC Contract
- `docs/schema-contract.md` — DB field names, RLS rules, `locations`/`tags` table structure
- Prior-phase carry-forward (from project memory): `has_changing_table` comes from the `tags` table (key/value), not a `locations` column — the Phase 3 search RPC must include a tags join, not a direct column filter

### Prior Phase (extending, not duplicating)
- `.planning/phases/02-auth-profiles/02-CONTEXT.md` — `update_profile` RPC (Phase 2, SECURITY DEFINER, authenticated-only) being extended with `family_mode` (D-30); `app/src/app/(tabs)/profile.tsx` Settings screen being extended with the family_mode toggle

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/lib/supabase.ts` — typed Supabase client, AsyncStorage-backed session, no changes needed
- `app/src/constants/` (Colors, typography, spacing, radius) — design tokens from Phase 1.5, moved here during the 2026-07-03 audit; all new screens use these, no raw hex/magic numbers
- `app/src/app/(tabs)/profile.tsx` — existing Settings screen (Phase 2) to extend with the family_mode toggle (D-30)
- `update_profile` RPC (`supabase/migrations/20260627000004_profile_rpcs.sql`) — existing SECURITY DEFINER RPC to extend with an optional `family_mode` parameter
- `app/src/features/auth/gpsConsent.ts` — Phase 2 hook that requests foreground GPS permission + records consent, but exposes NO live coordinates. Phase 3 adds a dedicated `useCurrentPosition` hook (03-02) as the single live-coordinate source; screens forward its coords into `useLocationDetail`/`useNearby`. (Codex 2026-07-05 review finding.)
- TanStack Query pattern already established (Phase 2) with user-id-scoped `queryKey`s on an app-lifetime `QueryClient` — any new user-scoped query in this phase (e.g. family_mode read) must follow the same scoping to avoid cross-user cache leaks (Codex WU-02-T5 finding, carried forward)

### Established Patterns
- 100% coverage gate on `src/features/**` + `src/lib/**`; `src/app/` screens remain thin wrappers excluded from coverage (existing jest.config.js rule)
- Component Acceptance Checklist (design-system.md §20) must be cited in every PLAN.md that creates/modifies a screen, before the review gate

### Integration Points
- `search_locations_bbox`/`search_locations_nearby`/`get_location_detail` RPCs (new, plan 03-01) are the shared data layer for MapScreen (03-02), Filters (03-03), and the new Nearby screen (03-04, D-29)
- `family_mode` toggle write (D-30) integrates into the existing `update_profile` RPC and Settings screen rather than new infrastructure. The extended `update_profile` uses `coalesce()` on both `display_name` and `family_mode` so a family-mode-only write never nulls the display name (both reviewers, 2026-07-05).

</code_context>

<specifics>
## Specific Ideas

- Eugene, OR was suggested (not locked) as the dev seed-data center, matching the project's stated Eugene density requirement.
- The "Get Directions" button should reuse the exact same device-maps-app deep-link mechanism that Emergency Mode's "Navigate" CTA already requires — no separate implementation needed, just exposed one level earlier (D-19).

</specifics>

<deferred>
## Deferred Ideas

- **Emergency Mode UI (FAB, bottom sheet, mode chips):** Explicitly Phase 8's job (ROADMAP "08-01: Emergency Mode... one-tap flows"). Phase 3 only builds the underlying `search_locations_nearby` RPC.
- **Pending-pin display (submitter-only, gray dashed pin):** Phase 4's job (Submit) — Phase 3's goal statement scopes to published locations only.
- **Access code display + reveal UX:** Write path is Phase 4; the tap-to-reveal display gate is Phase 8 (`08-02`).
- **Ratings, timing tips, reports:** Phases 8, 4, 6/7 respectively — LocationDetail sections for these are built but hidden (D-14) until then.
- **Full city/address geocoding search (Google Places autocomplete):** Deferred out of Phase 3 by D-34 (pending user sign-off) — Phase 3's denied-GPS fallback is recenter + "Search this area" only. Live geocoding warrants its own decision/plan (API key, privacy/logging constraints).
- **Apple Sign-In / iOS parity:** Unrelated to this phase (Phase 9, Apple Developer enrollment blocker).

### Reviewed Todos (not folded)
None — no pending todos were checked against this phase during this discussion.

</deferred>

---

*Phase: 03-Read Path & Map*
*Context gathered: 2026-07-04*
</content>
