# Phase 3: Read Path & Map - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 03-Read Path & Map
**Areas discussed:** Map viewport refresh strategy, Filter persistence, No-results button behavior, LocationDetail scope now vs later, Search bar visibility, OS-level permission revocation, Initial map zoom level, Directions button (new addition), Distance calculation method, Distance display units, LocationDetail dismiss gesture, Empty locations table (seed data), Max pins per viewport, Anonymous user data visibility, "Last verified" timestamp precision, Map viewport session persistence, Multi-filter logic, Map pin screen-reader accessibility, Dark mode map style, Missing hours display, "Currently Open" filter with no hours data, Uniform missing-data filter policy, "You are here" marker, Max zoom-out limit, Nearby tab gap, family_mode toggle gap

---

## Map Viewport Refresh Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-refetch, debounced | Re-runs bbox query ~300-500ms after map stops moving | ✓ |
| Manual "Search this area" button | Only refetches on explicit tap | |
| Hybrid: auto on zoom, manual on pan | Auto on zoom-size change, manual on pan | |

**User's choice:** Auto-refetch, debounced.
**Follow-up:** Debounce delay = 400ms (matches the 300ms search-bar debounce from Phase 1.5, slightly longer for continuous panning). Loading indicator = reuse the existing subtle >2s banner pattern, no new UI.

---

## Filter Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Reset each launch | Filters clear on cold start | ✓ |
| Persist via local storage | Filters survive app restarts | |

**User's choice:** Reset each launch.
**Follow-up:** Within a session (tab switches, not app restart), filters DO persist (not reset per Map-tab-visit). No filter active by default on fresh launch (not even "Currently Open").

---

## No-Results Button Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run bbox query for current viewport | Simple, matches panning behavior | ✓ |
| Expand search radius outward | Widens bbox automatically | |

**User's choice:** Re-run current viewport query.
**Follow-up:** Distinguish filtered-empty ("no bathrooms match your filters") from truly-empty ("no bathrooms found nearby") messaging — user said yes, distinguish them. Keep the button even though auto-refetch already covers panning — user said keep it, for the landing-on-empty-without-panning case.

---

## LocationDetail Scope Now vs Later

| Option | Description | Selected |
|--------|-------------|----------|
| Full sheet shell now, actions disabled/hidden | Build real peek/half/full component now | ✓ |
| Minimal info-only modal now, replace later | Simple modal, swap in full component later | |

**User's choice:** Full sheet shell now, actions disabled/hidden.
**Follow-up:** Disabled action buttons should be HIDDEN entirely (not shown grayed-out) — avoids a stressed user tapping a dead button. Timing tips/ratings sections: same treatment, hidden until data exists (not shown as explicit empty states).

---

## Search Bar Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Search available regardless of GPS state | ✓ |
| Only appears when GPS denied | Hidden/absent when GPS granted | |

**User's choice:** Always visible.

---

## OS-Level Permission Revocation

| Option | Description | Selected |
|--------|-------------|----------|
| Re-check live OS permission on every Map load | Query actual OS state each mount | ✓ |
| Trust the stored gps_consent flag | Only check once at consent time | |

**User's choice:** Re-check live OS permission on every Map load.

---

## Initial Map Zoom Level

| Option | Description | Selected |
|--------|-------------|----------|
| Tight, ~1km radius | A few blocks visible | ✓ |
| Wider, ~5km radius | Neighborhood-level view | |

**User's choice:** Tight, ~1km radius.

---

## Directions Button (new addition, not in original Phase 1.5 design)

**Context:** User asked mid-discussion whether the app gives walking/driving directions. Investigation found Emergency Mode has a "Navigate" CTA (opens device maps app) but the standard LocationDetail sheet's action row (per Phase 1.5) was only [GPS Verify] [Rate] [Report] — no directions action for normal browsing.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add it to Phase 3 | New "Get Directions" action, reuses Emergency Mode's deep-link logic | ✓ |
| No, leave it out for now | Match Phase 1.5 spec exactly as written | |

**User's choice:** Yes, add it to Phase 3.
**Follow-up:** Placement = first/leftmost in the action row. Auth gate = none, available to everyone (unlike Verify/Rate/Report which write data).

---

## Distance Calculation Method

| Option | Description | Selected |
|--------|-------------|----------|
| Straight-line/geodesic distance | PostGIS ST_Distance, free, no extra latency | ✓ |
| Walking-time estimate via routing API | More useful but adds external dependency/latency | |

**User's choice:** Straight-line/geodesic distance.

---

## Distance Display Units

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect by device locale | Miles US/UK, km/m elsewhere | ✓ |
| Always miles/feet | US-centric regardless of locale | |
| Always kilometers/meters | Metric regardless of locale | |

**User's choice:** Auto-detect by device locale.

---

## LocationDetail Dismiss Gesture

| Option | Description | Selected |
|--------|-------------|----------|
| Swipe down + tap map outside sheet | Both gestures, no close button | ✓ |
| Explicit close button only | Visible X button | |
| All three | Swipe, tap-outside, and close button | |

**User's choice:** Swipe down + tap outside sheet.

---

## Empty Locations Table — How to Test/Demo

**Context:** Investigation confirmed the live `locations` table has zero rows (no seed INSERTs in any migration) — Phase 4 (Submit) is what would normally populate it, but Phase 3 needs something to render.

| Option | Description | Selected |
|--------|-------------|----------|
| Dev-only seed migration/script | 10-20 fake locations, dev/local only | ✓ |
| Manually insert via Supabase Studio | Ad-hoc, not reproducible | |
| Defer, rely on Jest fixtures only | No real DB round-trip data | |

**User's choice:** Dev-only seed migration/script.
**Follow-up:** Geographic center — user chose "You decide at implementation time" (Eugene, OR was suggested as matching the project's Eugene density requirement, but not locked).

---

## Max Pins Per Viewport Query

| Option | Description | Selected |
|--------|-------------|----------|
| Tunable app_config value | Matches Phase 1's threshold pattern | ✓ |
| Hardcoded constant | Simpler, no migration needed | |

**User's choice:** Tunable app_config value.

---

## Anonymous User Data Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, everything except the PIN | Full browsing access, only access code gated | ✓ |
| Gate more than just the PIN | Restrict more fields to signed-in users | |

**User's choice:** Everything except the PIN.

---

## "Last Verified" Timestamp Precision

| Option | Description | Selected |
|--------|-------------|----------|
| Relative label | "Verified 3 days ago" | ✓ |
| Exact date/time | "Verified July 2, 2026 3:14pm" | |

**User's choice:** Relative label.

---

## Map Viewport Session Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Stay where they left it | Consistent with filter-persistence decision | ✓ |
| Snap back to live GPS every time | Always re-centers on return to Map | |

**User's choice:** Stay where they left it.

---

## Multi-Filter Logic (AND vs OR)

| Option | Description | Selected |
|--------|-------------|----------|
| AND — must match all selected | Narrows results to intersection | ✓ |
| OR — match any selected | Broadens results to union | |

**User's choice:** AND.

---

## Map Pin Screen-Reader Accessibility

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, Map is visual-only | Nearby tab is the designated accessible alt | ✓ |
| Add basic pin accessibility to Map too | Defense-in-depth beyond Nearby | |

**User's choice:** Map is visual-only.

---

## Dark Mode Map Style

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, switch with app theme | Matches Phase 1.5's OS-following dark mode | ✓ |
| Always light style | Simpler, one asset | |

**User's choice:** Switch with app theme.

---

## Missing Hours Display

| Option | Description | Selected |
|--------|-------------|----------|
| "Hours not yet available" | Explicit empty-state copy | ✓ |
| Hide the section entirely | Cleaner but could look broken | |

**User's choice:** "Hours not yet available."

---

## "Currently Open" Filter With No Hours Data

| Option | Description | Selected |
|--------|-------------|----------|
| Include by default | Benefit of the doubt | ✓ |
| Exclude — can't confirm open | Stricter interpretation | |

**User's choice:** Include by default.
**Follow-up:** Generalized into a uniform policy (see below) rather than deciding per-filter.

---

## Uniform Missing-Data Filter Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Apply uniformly to all filters | One consistent rule across wheelchair/changing table/cleanliness/currently open | ✓ |
| Decide per-filter individually later | Revisit each as its data source ships | |

**User's choice:** Apply uniformly to all filters.

---

## "You Are Here" Marker

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, standard blue dot | Universal native-maps convention | ✓ |
| No user-location marker | Only bathroom pins shown | |

**User's choice:** Yes, standard blue dot.

---

## Max Zoom-Out Limit

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, cap zoom-out with a message | "Zoom in to see individual locations" beyond a threshold | ✓ |
| No zoom restriction | 200-pin cap silently applies at any zoom | |

**User's choice:** Yes, cap zoom-out with a message.

---

## Nearby Tab Gap (scope discovery, not a gray area)

**Context:** Systematic cross-reference of Phase 1.5's design doc against ROADMAP found the Nearby list-view tab (designed as the accessible alternative to the map, part of the WCAG 2.1 AA commitment) was never scheduled into any phase's success criteria.

| Option | Description | Selected |
|--------|-------------|----------|
| Add it to Phase 3 now | New plan 03-04, reuses existing RPC data | ✓ |
| Defer to a later phase, note the gap | Schedule into a specific later phase | |
| Intentionally cut from v1 | Confirm deliberate 3-tab nav, update docs | |

**User's choice:** Add it to Phase 3 now, as new plan 03-04.

---

## family_mode Toggle Gap (scope discovery, not a gray area)

**Context:** Further cross-reference found Phase 3 builds RPC-layer `family_mode` filter enforcement, but no phase anywhere adds a UI toggle for a user to ever set `family_mode = true` — the filter would be unreachable for any real user.

| Option | Description | Selected |
|--------|-------------|----------|
| Add a Settings toggle to Phase 3 now | Small addition to existing Settings screen | ✓ |
| Defer to a later phase, note the gap | Schedule separately | |
| Intentionally admin-only for now | Confirm deliberate choice, no self-service toggle | |

**User's choice:** Add a Settings toggle to Phase 3 now.
**Follow-up:** Write path extends the existing `update_profile` RPC (not a new dedicated RPC). Folded into plan 03-04 alongside the Nearby screen (not its own plan).

---

## Claude's Discretion

- Exact geographic center/coordinates for dev seed data (Eugene, OR suggested but not locked).
- Exact max zoom-out threshold for pin-loading cutoff.
- Reconciling the clustering implementation approach: `ARCHITECTURE.md` specifies client-side `supercluster` over raw bbox points; Phase 1.5's context mentions Mapbox's native `ShapeSource`/`cluster: true`. Treated as a technical detail for the phase researcher to resolve using `ARCHITECTURE.md` as the more specific, authoritative technical research artifact — not re-raised as a user question.

## Deferred Ideas

- Emergency Mode UI (FAB, bottom sheet, mode chips) — Phase 8.
- Pending-pin display (submitter-only) — Phase 4.
- Access code write path and tap-to-reveal display gate — Phase 4 (write) / Phase 8 (display gate).
- Ratings, timing tips, reports content — Phases 8, 4, 6/7 respectively; LocationDetail sections built but hidden until then.
- Apple Sign-In / iOS parity — unrelated, Phase 9.
