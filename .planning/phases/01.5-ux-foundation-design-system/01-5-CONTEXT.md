# Phase 1.5 Context: UX Foundation & Design System

**Phase:** 01.5 — UX Foundation & Design System
**Date:** 2026-06-24
**Status:** Ready for planning

---

## Domain

Produce a design contract — markdown spec + ASCII wireframes — that all client-facing phases (2–8) implement against. No code is produced in this phase. The output is a set of docs in `docs/design/` that function as the source of truth for every screen, flow, and component state in v1.

---

## Decisions

### Brand & Visual Personality

**Visual mood:** Google Maps + Waze blend. Clean white/light-gray base (Google Maps) with bold urgent action buttons and community personality (Waze). Functional core with character.

**Color system:**
- Primary: Blue (Google Maps range, ~#1A73E8) for standard actions (Find, Submit, Verify, navigation)
- Emergency accent: Red/orange — reserved exclusively for the 3 emergency modes and critical alerts. Never used for non-emergency actions.
- Base: White / light gray. Dark mode tokens defined alongside light tokens from the start.
- Map pin colors: coded by policy tag — Chill Spot=green, Code Required=orange, Public Facility=blue, Purchase Required=gray
- Cluster pins: circle in dominant policy tag color + count

**Dark mode:** Design system defines both light and dark token values from day one. Implementation uses Expo's `useColorScheme` hook (already scaffolded in `app/constants/Colors.ts`). App follows OS setting — no in-app toggle in v1.

**Typography:** System font (SF Pro on iOS, Roboto on Android). Dynamic Type / Scalable Pixels supported automatically. No custom font bundle. All text sizes defined in sp/pt units.

**Accessibility commitment (WCAG 2.1 AA — universal baseline):**
- Minimum contrast: 4.5:1 for body text, 3:1 for large text
- Emergency-mode elements: target AAA where feasible
- All interactive elements have accessibility labels (VoiceOver/TalkBack)
- Non-color-only status: every state uses color + icon/text combination
- Touch targets: ≥44pt minimum on all interactive elements
- Dynamic Type tolerance: layouts must not break at 5 type size steps up or down
- Reduced motion: animation-heavy transitions have reduced-motion alternatives
- High Contrast Mode: deferred to Phase 8 as an optional settings toggle (not a design baseline)

**Map pins:**
- Policy-tag color (see above)
- Wheelchair-accessible locations: wheelchair icon overlay on pin corner
- Changing table locations: baby/changing icon overlay on pin corner
- Pending (submitter-only): gray dashed-outline pin
- Cluster: circular badge with count in dominant policy tag color

**App icon direction:** Abstract urgency symbol — running figure or open door. Bold, single color. Specific design is a Phase 1.5 deliverable.

**Tagline (welcome screen):** "Find a bathroom when it matters most"

---

### Emergency Mode

**Entry point:** Floating Action Button (FAB) on the Map screen only. Persistent, bottom-right, thumb zone. Red/orange color. Map-tab-scoped — not accessible from Nearby, Submit, or Profile tabs without navigating to Map first (2 taps maximum from any top-level route).

**FAB interaction (single-tap, no expand):** Single tap activates emergency mode immediately — finds the nearest any bathroom and shows the emergency bottom sheet. No intermediate expansion menu. This ensures ≤2 taps from any top-level route (other tab → Map tab = 1 tap; FAB tap = 2nd tap; emergency active).

Mode switching (Changing Table NOW / Accessible NOW) happens via chips INSIDE the emergency bottom sheet itself — user can switch modes without dismissing the sheet. Chips: [Any Bathroom] [Changing Table] [Accessible]. Active chip = filled. Map re-centers and sheet updates on chip selection.

Changing Table and Accessible chips are visible to all users (not gated by family_mode).

**When emergency mode activates:**
- Map re-centers on nearest qualifying location
- Bottom sheet slides up to half-snap (55%) immediately — no peek state
- Sheet header: red/orange strip + 'NEAREST RESULT' badge + mode chips ([Any Bathroom] [Changing Table] [Accessible])
- Large location name (h1), bold distance, 'Navigate' as primary CTA (opens device maps app)
- Map continues to show full context behind the half-sheet

**No qualifying location found (mode-specific):** When Changing Table or Accessible chip is selected and no confirmed matching location exists nearby, show nearest ANY bathroom as fallback. Required display:
- "No confirmed [changing table / accessible] bathroom found nearby — showing nearest available."
- "This location has not been confirmed for [wheelchair access / changing table]."
- Alternate action button: "Search more" (expands search radius) or "View [accessible/changing table] list" (switches to Nearby tab with mode filter active)
- Never navigate silently to a location that doesn't meet the user's urgent need without clear labeling.
- No empty state, no dead end.

**Dismiss:** User taps 'Dismiss' button on the bottom sheet OR taps the FAB again. Sheet collapses to baseline. No auto-dismiss based on GPS proximity.

---

### Navigation Model

**Tab bar (4 tabs, icon + label below each):**

| Tab | Icon | Label | Notes |
|-----|------|-------|-------|
| Map | Map icon | Map | Home tab; emergency FAB lives here |
| Nearby | List icon | Nearby | List view sorted by distance; accessible alt to map |
| Submit | Plus icon | Submit | Add a new location (auth required) |
| Profile | Person icon | Profile | Account, stats, settings |

**Unauthenticated tab behavior:**
- Map: fully accessible, no sign-in required
- Nearby: fully accessible, no sign-in required
- Submit: shows inline "Sign in to contribute" modal on tap, returns to action after auth
- Profile: shows sign-in/sign-up CTA + value proposition ("Sign in to track your contributions and access door codes") + muted preview of stats

**Protected actions (require auth):** Submit, Verify, Rate, Report, view access code. Trigger inline slide-up modal: "Sign in to contribute" with Sign In / Create Account / Cancel. After auth, returns to the same action flow.

**Filters:** Horizontal chip row below the search bar on the Map screen. Scrollable. Chips: [Changing Table] [Wheelchair] [Chill Spot] [Open Now] [Clean: 4+]. Active chip = filled/highlighted. Map updates immediately on toggle. Emergency mode overrides: hides filter row.

---

### First Launch Flow

1. **Welcome screen:** App name (large) + tagline "Find a bathroom when it matters most" + single 'Find a Bathroom' CTA button + below CTA: "By continuing, you agree to our [Terms of Service] and [Privacy Policy]." (tappable links). No carousel, no feature list.
2. **GPS consent pre-prompt:** Full screen before OS dialog. Copy: "Gotta Go uses your location to find bathrooms nearby. We never share your exact location or store your GPS history." Button: 'Enable Location' → triggers OS permission dialog.
3. **GPS denied fallback:** Map opens at city-level view (Eugene, OR default) with manual search bar active. No dead end.
4. **Map:** Main experience.

**GPS consent capture:** Only after the OS permission dialog resolves to `granted` — never before. Sequence: user taps 'Enable Location' → OS permission dialog fires → if OS grants permission, THEN write `users.gps_consent = true` and `users.gps_consent_at = now()`. If the OS dialog is denied, `gps_consent` must remain `false`/unset. Writing consent before the OS result would record false consent, violating GDPR. The pre-prompt screen's button triggers the OS dialog only; it does not itself constitute consent.

---

### LocationDetail Bottom Sheet

**Snap points:** Peek (30%) → Half (55%) → Full (90%)

**Peek content:** Name, distance, policy tag badge, confidence badge (High/Medium/Low + verification count)

**Half content:** Full detail — hours, available flags, ratings summary, access code (signed-in only), action row (Verify / Rate / Report)

**Full content:** Timing tips list, full ratings breakdown, report history summary, directions

**Access code display (signed-in only):** Masked by default ("Access Code: ****") with 'Tap to reveal' affordance. After tap: shows plain code + copy-to-clipboard button. Never visible to unauthenticated users.

**Timing tips:** Community-submitted free-text notes shown as a scrollable list below hours. Most recent first. Examples: "Busy noon–1pm", "Clean after 8am weekdays".

**Confidence badge:** Colored pill + text tier:
- High (green pill) + "14 GPS verifications"
- Medium (yellow pill) + "3 GPS verifications"
- Low (red pill) + "1 GPS verification"

**Action row (bottom of half-sheet):** Horizontal row of icon+label buttons: [GPS Verify] [Rate] [Report]. Below fold at peek state (prevents accidental taps during urgency). Auth required for all 3.

**Multiple pin taps:** Sheet content animates in-place to new location. No dismiss/re-open animation. Map re-centers on new pin. Sheet stays at current snap point.

**Emergency mode sheet:** Same structure + red/orange header strip + 'NEAREST RESULT' badge + mode chips ([Any Bathroom] [Changing Table] [Accessible]) below the header. Opens directly to half-snap (no peek). Name in h1, bold distance, Navigate as primary CTA above the fold. Switching chips re-centers map and updates sheet content in-place without dismissing.

---

### Loading & Skeleton States

**Map pins:** Map tile renders immediately. Pins appear as RPC data arrives (no blocking spinner). If fetch >2s: subtle non-blocking banner at top ("Loading..."). Standard Mapbox async tile + GeoJSON pattern.

**LocationDetail sheet:** On pin tap, sheet opens immediately to peek snap. Shows animated skeleton bars (gray placeholder) for name, address, tags. Resolves to real content on fetch completion (<300ms typical).

---

### Auth Flow (Sign-in / Sign-up)

**Sign-in screen:** Email/password form + "Continue with Google" button (Android only; iOS shows "Sign in with Apple — coming soon" in place of Google button) + "Create account" link.

**Sign-up screen:** Email + password + display name. After creation: profile auto-created by DB trigger. Return to map or to the action that triggered auth.

---

### Verify Flow

**VerifyFlow screen (full-screen modal):**
- Location name (h2)
- Live GPS readout: "Accuracy: 12m ✅" / "68m ⚠ — move to an open area"
- Distance from location: "You are 45m away" (updates in real time)
- "I'm Here" primary button (enabled when accuracy ≤50m and within 100m)
- Error states:
  - Too far: "You're too far away — need to be within 100m"
  - Low accuracy: "GPS accuracy too low — move to an open area and try again"
  - Stale fix: "GPS fix is stale — wait a moment and retry"
  - Already verified: "You've already verified this location today"
  - Security-sensitive (mocked GPS, shadowbanned): "Unable to verify your location. Please try again." (generic — never reveals detection)
- Success: Checkmark animation + "Verified! Thanks for keeping data fresh."

---

### Submit Flow

**3-step wizard with progress indicator:**

Step 1 — Location details:
- Name (required)
- Address (required, with Google Places autocomplete)
- Policy tag (required, picker: Chill Spot / Code Required / Purchase Required / Public Facility)
- Accessibility tags (multi-select: Wheelchair Accessible, Baby Changing Table, Family Restroom)

Step 2 — Access & hours:
- Hours (optional, JSON day+time picker)
- Access code / PIN (optional, text input — auth required to submit)
- Timing tips (optional, free text)

Step 3 — GPS confirm:
- Shows live GPS accuracy + distance from entered address
- "I'm at this location" primary button
- Same GPS error states as VerifyFlow

**Submit error states (Step 2 — GPS confirm):** In addition to GPS accuracy errors shared with VerifyFlow, the submit flow must handle:
- **Possible duplicate detected:** "A bathroom at this address may already exist. [View existing location]" — user can continue submitting or cancel. Duplicate detection runs server-side via proximity check in `submit_location` RPC.

**Post-success:** Success screen: "Location submitted! It'll appear publicly after 2 GPS verifications. You can see it on the map now." → 'Back to Map' button → map re-opens with gray dashed pending pin visible to submitter only.

**Pending pin LocationDetail:** "Pending — 1 of 2 GPS verifications received. Share with friends to speed up verification."

**Pending pin visibility note:** The `locations` table has no `submitter_id` column. Pending pin visibility (submitter-only) requires a server-side JOIN against `submissions.submitter_id` inside the search RPCs. The design system must document this constraint so Phase 3/4 plans include the JOIN, not a client-side filter.

---

### Report Flow

**Step 1 — Select type:**
Large tappable rows:
- Permanently Closed
- Access Denied / Currently Locked
- Code is Wrong (under 'inaccurate_information' report type)
- Dirty or Unsafe
- Duplicate Location

**Step 2 — Confirm:**
"Report this as [type]? This helps keep data accurate."
Buttons: 'Submit Report' (primary), 'Cancel'

No required text input. Success: toast — "Report submitted. Thanks for helping."

---

### Rating UI

4 dimensions (cleanliness, accessibility, convenience, changing surface cleanliness — last one only visible if location has changing table):

1–5 emoji scale per dimension. Each number maps to a distinct emoji representing quality (e.g., 1=😣 through 5=😍). Planner defines exact emoji mapping in design system doc. All have screen reader labels: "Rating: 3 out of 5 — Acceptable."

---

### Map Clustering

Circular badge with count showing number of pins in cluster. Cluster circle color = dominant policy tag color in cluster. Tap cluster → map zooms in to expand cluster. Uses @rnmapbox/maps ShapeSource + SymbolLayer with `cluster: true`.

---

### Search Bar

City / address / neighborhood search via Google Maps Places API (already licensed). Auto-suggest as user types (debounced 300ms). Selecting a result re-centers the map and fetches bathroom pins for new viewport via `search_locations_bbox` RPC. Does NOT search bathroom names — browsing handles discovery.

Denied GPS: search bar is active by default instead of GPS-centered view.

---

### Profile Tab

**Signed-in:**
- Display name + avatar placeholder (top)
- Stats section: GPS verifications count, locations submitted, ratings given
- Settings list: Account (email), Privacy Policy (Termly link), Terms of Service (Termly link), Delete Account, Sign Out

**Unauthenticated:**
- "Sign in to contribute" headline
- Value prop: "Track your contributions and access door codes."
- Sign In + Create Account buttons
- Muted stats preview

---

## Canonical Refs

Downstream agents must read these before planning or implementing Phase 1.5:

| File | Purpose |
|------|---------|
| `.planning/ROADMAP.md` | Phase 1.5 success criteria and deliverables |
| `.planning/PROJECT.md` | Requirements, constraints, key decisions |
| `SPEC.md` | Core user flows — Find, Add, Verify, Report, Moderation |
| `docs/schema-contract.md` | DB field names, types, and RLS rules (field names locked: weight not weighted_value, etc.) |
| `.planning/research/STACK.md` | Tech stack — Expo SDK 55, @rnmapbox/maps, TanStack Query, Zustand |
| `.planning/research/ARCHITECTURE.md` | Build order, component boundaries |
| `.planning/phases/01-foundation-scaffold/01-CONTEXT.md` | Phase 1 decisions (app_config thresholds, directory structure, token strategy) |
| `app/constants/Colors.ts` | Existing color scaffolding to replace with design system tokens |
| `app/src/app/` | Existing screen structure (auth/tabs/location layout already in place) |
| `AGENTS.md` | Multi-agent review workflow — all Phase 1.5 docs must pass review gate before Phase 2 starts |

---

## Code Context

Reusable from Phase 1:
- `app/constants/Colors.ts` — template color file; Phase 1.5 design system replaces this with proper token pairs (light/dark)
- `app/components/` — Expo template boilerplate (Themed, StyledText, etc.); NOT the design system — Phase 1.5 defines what components Phase 2+ should build
- `app/src/app/(auth)/`, `(tabs)/`, `location/` — routing structure already in place; Phase 1.5 wireframes must match this navigation skeleton
- `useColorScheme` hook in `app/components/useColorScheme.ts` — already set up for OS dark mode detection

The design system doc should define tokens that replace `Colors.ts` and components that replace the Expo template boilerplate. Downstream phase PLAN.md files must cite `docs/design/design-system.md` as the source of truth.

---

## Deferred Ideas

- **High Contrast Mode toggle** — Phase 8 settings screen feature (not a design baseline)
- **Text size override in-app** — Phase 8 settings, supplements OS Dynamic Type
- **Screen Reader announcement customization** — Phase 8 or later
- **Apple Sign-In credential revocation** — Phase 9 (requires Apple Developer enrollment; Apple token revocation API call)
- **Google OAuth token revocation on account delete** — Phase 2 (Google revocation API call on `DELETE /auth/user`; no Apple Developer enrollment required)
- **Onboarding carousel (3 screens)** — deferred to v2 after product validates
- **Video/animation welcome screen** — deferred to v2

---

## Security & Enforcement Notes

- **Family mode filter** — `users.family_mode` filtering of `access_sensitivity` locations must be enforced at the Supabase RPC layer (server-side), not in client-side JS. The design system must specify this as a server-side search constraint so Phase 3 plans implement it in the RPC, not the UI layer.
- **GPS consent** — See First Launch Flow section. Consent is recorded only after OS permission grants. Phase 2 implementation must follow this sequence; pre-prompt acknowledgement does not constitute consent.
- **Pending pin visibility** — JOIN on `submissions.submitter_id` required in search RPCs; documented in Submit Flow section above.

---

## Open Questions for Planner

- Exact emoji mapping for 1–5 rating scale: planner proposes in `docs/design/design-system.md` for review gate approval
- Specific hex values for all color tokens (light + dark): planner derives from Google Maps + Waze reference palette and proposes in design system doc
- App icon: planner produces an ASCII/text description of the running figure / door concept; actual asset design is out of Phase 1.5 scope
- GPS consent for unauthenticated first-launch users: pre-prompt screen fires OS dialog; if granted, consent is recorded when account is created (sign-up flow) or on first authenticated GPS read
