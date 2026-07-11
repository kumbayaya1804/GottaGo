# Gotta Go — Design System
**Status:** Source of truth for Phase 2–8 client implementation. No screen ships without matching this contract.
**Last updated:** 2026-06-25
**Replaces:** `app/constants/Colors.ts` (5-token placeholder) — Phase 2 must update that file to match the token table below.

---

## 1. Color Tokens

```typescript
// In any component (per CONTEXT.md dark mode decision):
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';

const colorScheme = useColorScheme() ?? 'light';
const colors = Colors[colorScheme];
// Usage: colors.primary, colors.textPrimary, etc.
// NEVER reference raw hex strings in component files.
```

### 1.1 Light Mode Tokens

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| primary | #1A73E8 | 26,115,232 | Primary buttons, active tab, links, standard actions |
| primaryPressed | #1557B0 | 21,87,176 | Pressed state on primary button |
| primarySurface | #E8F0FE | 232,240,254 | Tinted background behind primary UI elements |
| emergency | #D93025 | 217,48,37 | Emergency mode elements ONLY — FAB, sheet header strip, emergency CTAs |
| emergencyOrange | #EA8600 | 234,134,0 | Secondary emergency accent; also Code Required pin color |
| pinChillSpot | #34A853 | 52,168,83 | Chill Spot policy tag pin |
| pinCodeRequired | #EA8600 | 234,134,0 | Code Required policy tag pin |
| pinPublicFacility | #4285F4 | 66,133,244 | Public Facility policy tag pin |
| pinPurchaseRequired | #767676 | 118,118,118 | Purchase Required policy tag pin |
| pinPending | #9AA0A6 | 154,160,166 | Pending (submitter-only) pin — dashed outline style |
| confidenceHigh | #34A853 | 52,168,83 | High confidence badge pill |
| confidenceMedium | #FBBC04 | 251,188,4 | Medium confidence badge pill |
| confidenceLow | #EA4335 | 234,67,53 | Low confidence badge pill |
| background | #FFFFFF | 255,255,255 | App background |
| surface | #F8F9FA | 248,249,250 | Card, bottom sheet, modal background |
| surfaceOverlay | #FFFFFF | 255,255,255 | Map UI panel background |
| mapOverlay | rgba(255,255,255,0.92) | — | Semi-transparent map panel |
| textPrimary | #202124 | 32,33,36 | Primary labels and body text |
| textSecondary | #5F6368 | 95,99,104 | Secondary text, captions, metadata |
| textDisabled | #9AA0A6 | 154,160,166 | Disabled text, placeholders |
| textInverse | #FFFFFF | 255,255,255 | Text on colored/dark backgrounds |
| textLink | #1A73E8 | 26,115,232 | Tappable links in body text |
| border | #DADCE0 | 218,220,224 | Input borders, card borders |
| divider | #E8EAED | 232,234,237 | Section dividers |
| tabIconDefault | #9AA0A6 | 154,160,166 | Unselected tab icon |
| tabIconSelected | #1A73E8 | 26,115,232 | Selected tab icon |
| tabBackground | #FFFFFF | 255,255,255 | Tab bar background |
| skeletonBase | #E0E0E0 | 224,224,224 | Skeleton loader base color |
| skeletonHighlight | #F5F5F5 | 245,245,245 | Skeleton loader shimmer color |
| successGreen | #34A853 | 52,168,83 | Success states, checkmark icons |
| warningAmber | #EA8600 | 234,134,0 | Warning banners (offline, slow network) |
| errorRed | #EA4335 | 234,67,53 | Inline error text and icons |
| offlineBanner | #FFF3CD | 255,243,205 | Offline top-banner background |
| offlineBannerText | #664D03 | 102,77,3 | Offline banner text |
| scrim | rgba(0,0,0,0.4) | — | Modal backdrop, speed-dial overlay |

### 1.2 Dark Mode Tokens

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| primary | #8AB4F8 | 138,180,248 | Shifted blue for dark bg legibility |
| primaryPressed | #669DF6 | 102,157,246 | Pressed state |
| primarySurface | #1E3A5F | 30,58,95 | Tinted dark background |
| emergency | #F28B82 | 242,139,130 | Softer red on dark |
| emergencyOrange | #FDD663 | 253,214,99 | Softer orange on dark |
| pinChillSpot | #81C995 | 129,201,149 | Lighter green |
| pinCodeRequired | #FDD663 | 253,214,99 | Lighter orange |
| pinPublicFacility | #8AB4F8 | 138,180,248 | Matches dark primary |
| pinPurchaseRequired | #9AA0A6 | 154,160,166 | Lighter gray |
| pinPending | #5F6368 | 95,99,104 | Pending pin dark |
| confidenceHigh | #81C995 | 129,201,149 | High badge dark |
| confidenceMedium | #FDD663 | 253,214,99 | Medium badge dark |
| confidenceLow | #F28B82 | 242,139,130 | Low badge dark |
| background | #121212 | 18,18,18 | Material dark background |
| surface | #1E1E1E | 30,30,30 | Card, sheet |
| surfaceOverlay | #2C2C2C | 44,44,44 | Map UI panel dark |
| mapOverlay | rgba(30,30,30,0.92) | — | Dark semi-transparent panel |
| textPrimary | #E8EAED | 232,234,237 | Primary text dark |
| textSecondary | #9AA0A6 | 154,160,166 | Secondary text dark |
| textDisabled | #5F6368 | 95,99,104 | Disabled text dark |
| textInverse | #202124 | 32,33,36 | Text on light backgrounds in dark mode |
| textLink | #8AB4F8 | 138,180,248 | Link text dark |
| border | #3C3C3C | 60,60,60 | Borders dark |
| divider | #2C2C2C | 44,44,44 | Dividers dark |
| tabIconDefault | #5F6368 | 95,99,104 | Unselected tab icon dark |
| tabIconSelected | #8AB4F8 | 138,180,248 | Selected tab icon dark |
| tabBackground | #1E1E1E | 30,30,30 | Tab bar dark |
| skeletonBase | #3C3C3C | 60,60,60 | Skeleton base dark |
| skeletonHighlight | #4A4A4A | 74,74,74 | Skeleton shimmer dark |
| successGreen | #81C995 | 129,201,149 | Success dark |
| warningAmber | #FDD663 | 253,214,99 | Warning dark |
| errorRed | #F28B82 | 242,139,130 | Error text dark |
| offlineBanner | #3B2F00 | 59,47,0 | Offline banner bg dark |
| offlineBannerText | #FDD663 | 253,214,99 | Offline banner text dark |
| scrim | rgba(0,0,0,0.6) | — | Scrim dark |

### 1.3 Contrast Verification

| Foreground Token | Hex | Background Token | Hex | Ratio | WCAG Level | Result |
|-----------------|-----|-----------------|-----|-------|-----------|--------|
| textPrimary (light) | #202124 | background (light) | #FFFFFF | 16.1:1 | AAA | PASS |
| textSecondary (light) | #5F6368 | background (light) | #FFFFFF | 5.9:1 | AA | PASS |
| textDisabled (light) | #9AA0A6 | background (light) | #FFFFFF | 2.9:1 | Exempt (disabled) | N/A |
| textInverse | #FFFFFF | primary (light) | #1A73E8 | 4.6:1 | AA | PASS (button label on blue) |
| textInverse | #FFFFFF | emergency (light) | #D93025 | 5.1:1 | AA | PASS |
| textInverse | #FFFFFF | emergencyOrange (light) | #EA8600 | 2.9:1 | Fails AA | NOTE: use textPrimary (#202124) on emergencyOrange — ratio 5.5:1, AA PASS |
| textPrimary (light) | #202124 | emergencyOrange (light) | #EA8600 | 5.5:1 | AA | PASS (use this combination) |
| confidenceHigh (light) | #34A853 | background (light) | #FFFFFF | 4.5:1 | AA | PASS (large text or icon; body text borderline — always pair with icon+text) |
| confidenceMedium (light) | #FBBC04 | background (light) | #FFFFFF | 1.9:1 | Fails | NOTE: yellow on white fails — use textPrimary on confidenceMedium surface, not confidenceMedium on white directly |
| textPrimary (light) | #202124 | confidenceMedium (light) | #FBBC04 | 8.6:1 | AAA | PASS |
| textPrimary (dark) | #E8EAED | background (dark) | #121212 | 14.7:1 | AAA | PASS |
| textSecondary (dark) | #9AA0A6 | background (dark) | #121212 | 5.2:1 | AA | PASS |
| primary (dark) | #8AB4F8 | background (dark) | #121212 | 7.2:1 | AAA | PASS |
| emergency (dark) | #F28B82 | background (dark) | #121212 | 4.9:1 | AA | PASS |
| offlineBannerText (light) | #664D03 | offlineBanner (light) | #FFF3CD | 7.1:1 | AAA | PASS |

CRITICAL: `confidenceMedium` (#FBBC04) must never be used as a text color on white. The medium badge renders as a yellow pill containing `textPrimary`-colored text (`#202124`). See Section 9 (Confidence Badge Spec) for the correct implementation.

---

## 2. Typography Scale

System font only — no custom font bundle. SF Pro Display/Text on iOS, Roboto on Android. React Native renders the system font automatically; no fontFamily declaration needed.

| Style | Size | Weight | Line Height | iOS DT Category | Android SP Equiv | Usage |
|-------|------|--------|-------------|----------------|-----------------|-------|
| Display | 34pt | Bold (700) | 41pt | largeTitle | 34sp | Welcome screen headline |
| H1 | 28pt | Bold (700) | 34pt | title1 | 28sp | Emergency location name in bottom sheet |
| H2 | 22pt | SemiBold (600) | 28pt | title2 | 22sp | Screen titles, modal titles |
| H3 | 17pt | SemiBold (600) | 22pt | title3 | 17sp | Section headers, card titles |
| Body | 17pt | Regular (400) | 24pt | body | 17sp | Primary body text |
| BodyMedium | 17pt | Medium (500) | 24pt | body | 17sp | Emphasized body (distance label, bold distance in emergency sheet) |
| Subhead | 15pt | Regular (400) | 20pt | subheadline | 15sp | Secondary body, hours, metadata |
| Caption | 13pt | Regular (400) | 18pt | caption1 | 13sp | Badge labels, chip text, timestamps |
| Label | 11pt | Medium (500) | 16pt | caption2 | 11sp | Tab bar labels |

Layouts must not break at ±5 accessibility size steps (iOS: Settings → Accessibility → Display & Text Size → Larger Text). Use flex-based sizing — never hardcoded row heights. `numberOfLines` is forbidden on any critical-path label (location name, distance, CTA text, error copy).

All `fontSize` values in component StyleSheet MUST use pt/sp values from this table. No inline `fontSize: 14` raw numbers — always reference the typography scale token. Phase 2+ plans must implement a `typography.ts` constants file that exports these scale values by name.

---

## 3. Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| spacing.xs | 4 | Icon padding, micro gaps |
| spacing.sm | 8 | Between label and icon, chip internal padding |
| spacing.md | 12 | Between list items |
| spacing.base | 16 | Standard horizontal screen margin, card padding |
| spacing.lg | 20 | Between card and next section |
| spacing.xl | 24 | FAB safe-area inset from bottom, section gaps |
| spacing.xxl | 32 | Between major screen sections |
| spacing.xxxl | 48 | Full-screen modal top padding |
| spacing.giant | 64 | FAB minimum touch target dimension |

All spacing values must be sourced from this table. No magic numbers in StyleSheet. Phase 2+ plans must implement a `spacing.ts` constants file.

---

## 4. Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| radius.xs | 4 | Small UI chips in non-prominent contexts |
| radius.sm | 8 | Cards, input fields, secondary buttons |
| radius.md | 12 | Bottom sheet corners, primary buttons |
| radius.lg | 16 | Modals, large cards |
| radius.xl | 24 | FAB, large rounded containers |
| radius.pill | 9999 | Confidence badges, filter chips, policy tag badges |

---

## 5. Shadow / Elevation

| Use Case | Shadow Props | Notes |
|----------|-------------|-------|
| Cards / Bottom Sheet | shadowColor: #000, shadowOffset: {width:0, height:2}, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 | Light mode only; dark mode: no shadow (surfaces already visible) |
| FAB | shadowColor: #000, shadowOffset: {width:0, height:4}, shadowOpacity: 0.20, shadowRadius: 12, elevation: 8 | Both modes |
| Modal / Slide-up sheet | shadowColor: #000, shadowOffset: {width:0, height:-2}, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 | Top edge shadow for bottom sheets |
| Tab bar | shadowColor: #000, shadowOffset: {width:0, height:-1}, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 | Separator from content |
| Dark mode general | No shadow | Use border token instead — border: colors.border, borderWidth: 1 |

---

## 6. Button Hierarchy

Four levels. One Primary per screen. Destructive only for irreversible actions.

**Level 1 — Primary (Filled Blue)**
- Background: `colors.primary` (#1A73E8 light / #8AB4F8 dark)
- Label: `colors.textInverse` (#FFFFFF light / #202124 dark)
- Border: none
- Border radius: `radius.md` (12)
- Height: 56pt minimum (48pt for non-CTA contexts like sign-in form)
- Width: full-width (`flex: 1`) in most contexts; fixed only for paired button rows
- Font: BodyMedium (17pt, Medium 500)
- Pressed state: background shifts to `colors.primaryPressed`
- Disabled state: background `colors.border`, label `colors.textDisabled` — no opacity trick
- One per screen — if a second primary-level action is needed, demote one to Secondary
- `accessibilityRole="button"`, `accessibilityState={{ disabled: bool }}`

**Level 2 — Secondary (Outlined Blue)**
- Background: transparent
- Label: `colors.primary`
- Border: 1.5pt solid `colors.primary`, `radius.md`
- Height: 48pt minimum
- Font: BodyMedium (17pt, Medium 500)
- Pressed state: background `colors.primarySurface`
- Disabled state: border and label shift to `colors.textDisabled`
- `accessibilityRole="button"`

**Level 3 — Destructive (Filled Red)**
- Background: `colors.emergency` (#D93025 light / #F28B82 dark)
- Label: `colors.textInverse`
- Border: none
- Height: 48pt minimum
- Font: BodyMedium (17pt, Medium 500)
- Use ONLY for: Delete Account, permanently destructive actions
- Must be preceded by a confirmation step — never fire destructive action on first tap
- `accessibilityRole="button"`, `accessibilityHint="This will permanently delete your account"`

**Level 4 — Ghost / Text (No Border)**
- Background: transparent
- Label: `colors.primary` (or `colors.textSecondary` for dismiss/cancel)
- Border: none
- Height: 44pt minimum (touch target enforced via `hitSlop: {top:8,bottom:8,left:8,right:8}`)
- Font: Body (17pt, Regular 400) — bold weight is reserved for Primary/Secondary
- Pressed state: label color shifts to `colors.primaryPressed`
- Use for: Cancel, Dismiss, "Not now", inline text links

---

## 7. Icon Rules

Use `@expo/vector-icons` with the `Ionicons` set (already available in Expo SDK 55). Do not import multiple icon libraries — one source per project.

| Use | Icon Name (Ionicons) | Color Token | Size (pt) | Notes |
|-----|---------------------|-------------|-----------|-------|
| Map tab | map-outline / map | tabIconDefault / tabIconSelected | 24 | Selected = filled variant |
| Nearby tab | list-outline / list | tabIconDefault / tabIconSelected | 24 | |
| Submit tab | add-circle-outline / add-circle | tabIconDefault / tabIconSelected | 24 | |
| Profile tab | person-outline / person | tabIconDefault / tabIconSelected | 24 | |
| FAB (emergency) | flash or alert — filled variant | textInverse on emergency bg | 28 | 64pt container |
| GPS Verify action | location-outline | primary | 22 | |
| Rate action | star-outline | primary | 22 | |
| Report action | flag-outline | primary | 22 | |
| Close / X | close | textSecondary | 22 | All modal dismiss buttons |
| Back arrow | arrow-back | textPrimary | 22 | |
| Search | search-outline | textSecondary | 20 | In search bar |
| Filter chip active | checkmark | textInverse on primary | 14 | In filled chip |
| Confidence High | checkmark-circle | confidenceHigh | 16 | Badge icon |
| Confidence Medium | time-outline | confidenceMedium | 16 | Badge icon |
| Confidence Low | warning-outline | errorRed | 16 | Badge icon |
| GPS accuracy good | checkmark-circle | successGreen | 16 | Verify screen readout |
| GPS accuracy poor | warning | warningAmber | 16 | Verify screen readout |
| Wheelchair | accessibility-outline | textSecondary | 16 | Pin overlay, detail flags |
| Changing table | people-outline | textSecondary | 16 | Pin overlay, detail flags |
| Offline banner | wifi-outline (crossed) | offlineBannerText | 16 | Top banner |
| Copy to clipboard | copy-outline | primary | 18 | Access code reveal |
| Navigate (CTA) | navigate | textInverse | 20 | Emergency sheet primary CTA |

Every icon used as a status indicator MUST appear alongside text. Color alone is never the sole status signal (WCAG 1.4.1).

---

## 8. Policy Tag Badge Spec

Every location carries exactly one `policy_tag` from the DB. The badge renders as a colored pill with text label. Color alone is never sufficient — always render text + color together (WCAG 1.4.1).

| policy_tag | Display Label | Pill bg (light) | Pill bg (dark) | Text | Icon | Notes |
|-----------|--------------|----------------|----------------|------|------|-------|
| chill_spot | Chill Spot | pinChillSpot #34A853 | pinChillSpot #81C995 | textInverse #FFFFFF | None | Community-reported framing in tooltip: "Users report this as a no-purchase-required space" |
| code_required | Code Required | emergencyOrange #EA8600 | pinCodeRequired #FDD663 | textPrimary #202124 on dark/light amber | None | Note: white on #EA8600 fails contrast — use textPrimary |
| public_facility | Public Facility | pinPublicFacility #4285F4 | pinPublicFacility #8AB4F8 | textInverse #FFFFFF | None | |
| purchase_required | Purchase Required | pinPurchaseRequired #767676 | pinPurchaseRequired #9AA0A6 | textInverse #FFFFFF | None | |
| (pending) | Pending | surface #F8F9FA | surface #1E1E1E | textSecondary | clock-outline | Dashed border, gray — visible to submitter only via the separate `get_my_pending_submissions` RPC |

ARCHITECTURE NOTE (updated — Phase 4 implemented): Pending pin visibility is submitter-only. As built, this is NOT a JOIN inside `search_locations_bbox`/`search_locations_nearby`. `get_my_pending_submissions()` is a separate, no-arg, `auth.uid()`-scoped RPC returning the caller's own pending rows; MapScreen renders it as a second, independent Mapbox `ShapeSource` ("pendingLocations") layered above the main published-locations layer — never merged into the same feature collection and never client-side filtered. See `app/src/app/(tabs)/index.tsx` and `.planning/phases/04-gps-service-submission/04-CONTEXT.md` D-26.

Pin color in Mapbox must be driven by a `match` expression on the `policy_tag` GeoJSON property:
```
iconColor: ['match', ['get', 'policy_tag'],
  'chill_spot',        '#34A853',
  'code_required',     '#EA8600',
  'public_facility',   '#4285F4',
  'purchase_required', '#767676',
  '#767676'  // fallback
]
```
Dark mode map tiles: use shifted dark-mode hex values for the same match expression.

Wheelchair and Changing Table overlays use a separate SymbolLayer stacked above the base pin layer, filtered by `['==', ['get', 'has_wheelchair'], true]` and `['==', ['get', 'has_changing_table'], true]` respectively. Use `iconOffset: [8, -8]` as the starting point for corner positioning — calibrate in Phase 3 against live map tiles. Do NOT use Option B (composite images) — it creates combinatorial asset explosion.

Cluster circle color = dominant policy tag color determined by `clusterProperties` count aggregation. Cluster circle radius: 20pt, white 2pt stroke. Count label: 14pt white. Tap cluster → zoom in to expand. Implementation pattern in RESEARCH.md Section 6.

---

## 9. Confidence Badge Spec

`locations.confidence_score` is stored as a text tier label: 'High' | 'Medium' | 'Low' (not a numeric). The badge renders at Peek snap of the bottom sheet.

| Tier | Pill bg (light) | Pill bg (dark) | Icon | Icon color | Label | Sub-label | Screen Reader |
|------|----------------|----------------|------|-----------|-------|-----------|--------------|
| High | confidenceHigh #34A853 | #81C995 | checkmark-circle | textInverse | High | "14 GPS verifications" | "Confidence: High — 14 GPS verifications" |
| Medium | confidenceMedium #FBBC04 | #FDD663 | time-outline | textPrimary #202124 | Medium | "3 GPS verifications" | "Confidence: Medium — 3 GPS verifications" |
| Low | confidenceLow #EA4335 | #F28B82 | warning-outline | textInverse | Low | "1 GPS verification" | "Confidence: Low — 1 GPS verification" |

Text in badge: `textInverse` (#FFFFFF) for High and Low tiers. `textPrimary` (#202124) for Medium tier (yellow pill fails contrast with white — see Section 1.3). The `accessibilityRole` of the badge is `text` (non-interactive). Pair icon + label + sub-label — never render color only.

---

## 10. Map Marker States

| State | Color Token | Visual Treatment | Visibility Rule |
|-------|-------------|-----------------|----------------|
| Chill Spot | pinChillSpot | Filled pin, policy color | Authenticated + unauthenticated |
| Code Required | pinCodeRequired/emergencyOrange | Filled pin, amber | Authenticated + unauthenticated |
| Public Facility | pinPublicFacility | Filled pin, blue | Authenticated + unauthenticated |
| Purchase Required | pinPurchaseRequired | Filled pin, gray | Authenticated + unauthenticated |
| Pending | pinPending (#9AA0A6 light) | Dashed-outline pin, gray | Submitter only — served by the separate `get_my_pending_submissions` RPC, not a JOIN in the search RPC |
| Cluster | Dominant policy tag color | Circle badge with count, white stroke | All users |

Selected (tapped) pin: scale up 1.2×, add white halo ring. Sheet opens to Peek snap immediately.

---

## 11. Bottom Sheet Snap Point Spec

Snap points: exactly 30% / 55% / 90% of screen height. No intermediate states. Implementation: `@gorhom/bottom-sheet` or equivalent; snap points configured in the component, not computed at runtime.

| Snap | % | Content Visible | Map Visible | Mode |
|------|---|----------------|-------------|------|
| Peek | 30% | Name, distance, policy badge, confidence badge | Yes (70% of screen) | Map pannable — sheet non-modal |
| Half | 55% | Full detail: hours, flags, ratings summary, access code (auth), action row [GPS Verify / Rate / Report] | Yes (45%) | Primary use case — primary CTA above fold |
| Full | 90% | Timing tips, full ratings breakdown, report history, directions | Barely (10%) | Effectively modal |

Emergency mode: sheet opens DIRECTLY to Half (55%) — no Peek state. Sheet header: red/orange strip (`colors.emergency`) with 'NEAREST RESULT' text badge. Mode chips [Any Bathroom] [Changing Table] [Accessible] below header. Location name in H1 style. Bold distance. 'Navigate' as full-width Primary button above the fold. Switching chips re-centers map and updates sheet content in-place — no dismiss/re-open.

On subsequent pin taps while sheet is open: content animates in-place to new location data. Sheet stays at current snap point. Map re-centers on new pin. No dismiss/re-open animation flash.

`accessibilityRole='adjustable'` on drag handle. `accessibilityValue={{ text: 'Peek' | 'Half' | 'Full' }}` reflects current snap. VoiceOver/TalkBack users must be able to cycle snap points via increment/decrement actions without dragging.

On pin tap, sheet opens immediately to Peek. Skeleton bars (`skeletonBase` background, animated to `skeletonHighlight`) render for name, address, tags while data fetches. Target resolution: <300ms. Skeleton uses `Animated.loop` with `useNativeDriver: true`. Reduced motion: show skeleton without animation (instant reveal).

---

## 12. FAB Speed Dial Spec

Position: `bottom: 24pt` + safe area bottom inset, `right: 16pt`. React Native: `position: 'absolute', bottom: insets.bottom + 24, right: 16`. Map tab only — not visible on Nearby, Submit, or Profile tabs.

FAB size: 64×64pt (larger than Material Design standard 56pt — emergency context warrants extra target area). Background: `colors.emergency` (#D93025 light / #F28B82 dark). Icon: `flash` or `alert` from Ionicons, `colors.textInverse`, 28pt. Border radius: `radius.xl` (24). Shadow: FAB elevation spec from Section 5.

Single tap activates emergency mode immediately — finds nearest any bathroom and opens emergency bottom sheet at Half snap. There is NO expand menu. This ensures the ≤2 tap rule: switch to Map tab (1 tap) + FAB tap (2 taps). Mode switching (Changing Table NOW / Accessible NOW) happens via chips INSIDE the emergency bottom sheet, not via a pre-tap expand menu.

User taps 'Dismiss' button on the bottom sheet OR taps the FAB again. Sheet collapses to baseline. No auto-dismiss based on GPS proximity.

`accessibilityRole='button'`, `accessibilityLabel='Emergency bathroom finder'`, `accessibilityHint='Finds nearest bathroom immediately'`.

Speed dial expands instantly (no stagger animation) when `AccessibilityInfo.isReduceMotionEnabled()` is true.

---

## 13. Emoji Rating Scale

Selected mapping: Option A — face progression. Rationale: cross-cultural, universally understood negative-to-positive arc, renders consistently on iOS/Android, avoids poop emoji (inappropriate for medical/disability-adjacent context). Used for all four rating dimensions.

| Rating | Emoji | Label | accessibilityValue.text |
|--------|-------|-------|------------------------|
| 1 | 😣 | Awful | "1 out of 5 — Awful" |
| 2 | 😕 | Poor | "2 out of 5 — Poor" |
| 3 | 😐 | Okay | "3 out of 5 — Okay" |
| 4 | 😊 | Good | "4 out of 5 — Good" |
| 5 | 😍 | Excellent | "5 out of 5 — Excellent" |

**Rating dimensions (from CONTEXT.md):**
1. Cleanliness
2. Accessibility (physical ease of use)
3. Convenience (location / hours)
4. Changing Surface Cleanliness — CONDITIONAL: shown only when `has_changing_table === true`

> **Schema notes (RC-03):**
> - `has_changing_table` is NOT a `locations` column. It is derived from the `tags` table: `tags.find(t => t.key === 'has_changing_table')?.value === 'true'`. Phase 3 search RPC must include tags in the location payload, or Phase 8 must perform a separate tags lookup.
> - The `changing_surface_cleanliness` dimension requires adding `changing_surface_cleanliness integer null check (changing_surface_cleanliness >= 1 and changing_surface_cleanliness <= 5)` to the `ratings` table via Phase 8 migration. The live schema has no such column.

Each emoji button: `accessibilityRole='button'`, `accessibilityValue={{ min: 1, max: 5, now: N, text: 'N out of 5 — Label' }}`. Touch target: 48×48pt per button. Rating row width = 5 × 48pt = 240pt — fits within 375pt baseline screen width with spacing.

Unrated (default) state: emoji buttons rendered at 70% opacity. Selected emoji: 100% opacity, scale 1.1×, with a subtle underline or selection indicator (not color-only). Screen reader announces selection immediately via `accessibilityValue`.

Tapping an emoji selects that rating for that dimension — does not auto-submit. A 'Submit Rating' Primary button at the bottom of the Rating screen is the single submit action. This prevents accidental submission from a single tap.

---

## 14. Tab Bar Spec

| Tab | Inactive Icon | Active Icon | Label | Route | Auth | Unauth Behavior |
|-----|--------------|------------|-------|-------|------|----------------|
| Map | map-outline | map | Map | /(tabs)/index | No | Fully accessible |
| Nearby | list-outline | list | Nearby | /(tabs)/nearby | No | Fully accessible |
| Submit | add-circle-outline | add-circle | Submit | /(tabs)/submit | Yes | Inline slide-up "Sign in to contribute" modal on tap, returns to submit after auth |
| Profile | person-outline | person | Profile | /(tabs)/profile | No | Shows sign-in/sign-up CTA + value prop + muted stats preview |

Icon + label always visible below icon. Active tab: icon switches to filled variant, label color changes to `tabIconSelected`. Inactive: `tabIconDefault`. Tab bar background: `tabBackground`.

Tab bar height: 49pt + safe area bottom inset. Icon: 24pt. Label: 11pt (Label scale from typography). Tap target for each tab: full tab width × 49pt.

---

## 15. Error-State Copy Matrix

All 11 named error states. Every Phase 2+ component must handle all applicable states. Exact copy strings are LOCKED — do not paraphrase. UI treatment is the implementation contract.

| State ID | Name | Trigger | Exact Copy | UI Treatment | Recovery |
|----------|------|---------|-----------|-------------|---------|
| ERR-01 | GPS Denied | OS location permission resolves to denied | "We can't find your location. Use search to browse bathrooms near an address." | Map opens to manual city/address search with no hardcoded default city. If a prior search exists, the map may use that last searched area. Search bar active and focused. Filter chips hidden. No blocking modal — inline empty state only. | User types in search bar; result re-centers map |
| ERR-02 | GPS Low Accuracy | GPS accuracy > 50m on Verify or Submit Step 3 screen | "GPS accuracy too low — move to an open area and try again." | Inline below GPS readout on Verify screen. Icon: warning-outline, warningAmber. 'I'm Here' button disabled. Updated in real-time as accuracy improves. | Accuracy improves → button re-enables automatically |
| ERR-03 | GPS Stale Fix | GPS fix timestamp stale (implementation-defined threshold) | "GPS fix is stale — wait a moment and retry." | Inline below GPS readout. Icon: time-outline. 'I'm Here' button disabled. | Tap 'Retry' button → requests fresh GPS read |
| ERR-04 | Offline | Network unreachable | "No connection — showing cached results. Tap to retry." | Top-edge banner (non-blocking): background `offlineBanner`, text `offlineBannerText`, icon wifi-outline, 16pt. Banner persists until network restored. Cached pins remain visible on map. New fetch attempts fail silently with this banner visible. | User taps banner → retry network request |
| ERR-05 | Slow Network | Data fetch exceeds 2 seconds | (No copy — non-blocking) | Subtle top-edge banner: "Loading..." in `textSecondary`. No modal, no spinner overlay. Map/sheet content shows skeleton until data arrives. | Automatic — resolves when data arrives |
| ERR-06 | No Results in Viewport | `search_locations_bbox` RPC returns 0 results for current viewport | "No bathrooms found nearby. Try 'Search this area' or adjust filters." | Inline empty state on map (centered card) with 'Search this area' button below. No full-screen block. Filter chips still accessible. | 'Search this area' → expands search radius; filter chip → removes filter |
| ERR-07 | Suppressed Location | Location has `access_sensitivity` filtered by RPC / shadowban RPC exclusion | (No copy — transparent to user) | Location simply absent from results. No tombstone, no "this was removed" message. Implementation: Supabase RPC filters suppressed locations server-side — client sees nothing. | None — user does not know suppression occurred |
| ERR-08 | Failed Submit | `submit_location` RPC returns error | "Couldn't submit your location. Check your connection and try again." | Inline below the 'Submit' button on Step 3. Icon: alert-circle, errorRed. 'Retry' secondary button appears. Progress not lost (form data preserved). | Tap 'Retry' → re-attempts RPC call |
| ERR-09 | Failed Verification | `submit_verification_event` RPC returns error (includes mocked GPS, shadowban, distance failure, generic network error) | "Unable to verify your location. Please try again." | Inline below 'I'm Here' button. Generic — never reveals detection reason (security requirement: do not reveal shadowban detection or GPS spoofing detection). Icon: alert-circle, errorRed. | Tap 'Try Again' → re-attempts GPS read + verification |
| ERR-10 | Auth Required | Unauthenticated user attempts protected action (Submit, Verify, Rate, Report, access code reveal) | "Sign in to [action]" (action = specific verb: "Sign in to contribute", "Sign in to verify", "Sign in to rate", "Sign in to report", "Sign in to see access code") | Slide-up modal (not full navigation). Buttons: Primary 'Sign In', Secondary 'Create Account', Ghost 'Cancel'. After auth completes, returns user to same action flow — no navigation loss. | Tap 'Sign In' → /(auth)/sign-in with returnTo param |
| ERR-11 | Code-Gated Content | Unauthenticated user on location detail with access code | "Sign in to view the access code" | Access code field not rendered for unauthenticated users — field is absent, not masked. Shows inline link "Sign in to view the access code" in place of the code field. For authenticated users: field renders as "Access Code: ****" with 'Tap to reveal' affordance; after tap: plain code + copy button. | Tap link → ERR-10 flow |

Every error state must have a defined recovery action. 'No internet' is not a dead end — cached data remains. 'No results' is not a dead end — search/filter options remain. An error screen with no actionable next step is a product defect.

ERR-09 copy is intentionally generic. It must NOT change to reveal information such as 'GPS spoofing detected', 'You are too far away', 'Your account is restricted', or any other signal. The generic message applies for ALL rejection reasons including mocked GPS, shadowban, genuine network failure, and distance failure.

---

## 16. Navigation Model

Route structure (matches `app/src/app/` file layout — Expo Router v4, auto-discovered):

```
app/src/app/
├── (tabs)/
│   ├── index.tsx         → Map tab  [/(tabs)/index]
│   ├── nearby.tsx        → Nearby tab  [/(tabs)/nearby]  (Phase 2)
│   ├── submit.tsx        → Submit tab  [/(tabs)/submit]  (Phase 2)
│   └── profile.tsx       → Profile tab  [/(tabs)/profile]
├── (auth)/
│   ├── sign-in.tsx       → Sign-in  [/(auth)/sign-in]
│   └── sign-up.tsx       → Sign-up  [/(auth)/sign-up]
├── location/
│   └── [id].tsx          → Location detail (deep link / share target)  [/location/[id]]
└── modals/ (via router.push — full-screen)
    ├── verify.tsx         → Verify flow modal
    ├── report.tsx         → Report flow modal
    └── rating.tsx         → Rating flow modal
```

Protected routes require an authenticated Supabase session. Unauthenticated access triggers ERR-10 (Auth Required) inline modal — never a hard redirect that loses navigation state.

| Route | Protected | Auth Behavior |
|-------|----------|--------------|
| /(tabs)/index | No | Fully accessible |
| /(tabs)/nearby | No | Fully accessible |
| /(tabs)/submit | Yes | Inline modal ERR-10 on tab tap; returns to submit after auth |
| /(tabs)/profile | No | Shows sign-in CTA; stats/settings only visible when authenticated |
| /(auth)/sign-in | No | Unauthenticated only; if already signed in, redirect to /(tabs)/index |
| /(auth)/sign-up | No | Unauthenticated only |
| /location/[id] | No (basic detail) | Access code field: protected (ERR-11) |
| /modals/verify | Yes | ERR-10 if unauthenticated when opened |
| /modals/report | Yes | ERR-10 if unauthenticated when opened |
| /modals/rating | Yes | ERR-10 if unauthenticated when opened |

All modals must have an explicit close affordance. Swipe-to-dismiss-only is FORBIDDEN — it is inaccessible for users who cannot swipe.

| Modal | Close Affordance | Back Button | Swipe Dismiss | State on Dismiss |
|-------|-----------------|-------------|--------------|-----------------|
| Auth Required (ERR-10) | 'Cancel' ghost button | Dismisses | No | Returns to originating screen |
| Verify flow | 'X' icon top-right | Dismisses | No | Returns to location detail |
| Report flow | 'Cancel' button (Step 2) | Dismisses | No | Returns to location detail |
| Rating flow | 'X' icon top-right | Dismisses | No | Returns to location detail |
| Sign-in/sign-up | 'X' or back (Android) | Dismisses | No | Returns to originating action |

≤2 taps from ANY top-level route to emergency mode (per ROADMAP Phase 1.5 success criterion 5).

| Starting Tab | Tap 1 | Tap 2 | Emergency Active |
|-------------|-------|-------|-----------------|
| Map (already on Map) | FAB tap | — | Yes (1 tap) |
| Nearby | Map tab | FAB tap | Yes (2 taps) |
| Submit | Map tab | FAB tap | Yes (2 taps) |
| Profile | Map tab | FAB tap | Yes (2 taps) |

ARCHITECTURE NOTE: `users.family_mode` filtering of `access_sensitivity` locations is enforced at the Supabase RPC layer (server-side). The client MUST NOT filter `access_sensitivity` in JavaScript. Phase 3 `search_locations_bbox` RPC implementation must include `WHERE access_sensitivity IS NULL OR users.family_mode = false` or equivalent server-side filter. Any client-side implementation is a security defect.

GPS consent capture sequence (non-negotiable — GDPR requirement):
1. User taps 'Enable Location' on GPS Consent Pre-prompt screen
2. OS permission dialog fires (`Location.requestForegroundPermissionsAsync()`)
3. IF OS dialog resolves to `granted`: write `users.gps_consent = true` and `users.gps_consent_at = now()` to Supabase (via SECURITY DEFINER RPC)
4. IF OS dialog resolves to `denied`: `gps_consent` remains false/unset; map opens to ERR-01 state
DO NOT write consent before the OS dialog resolves. The pre-prompt button triggers the OS dialog only — it is not itself consent. Writing consent before OS resolution would record false consent.

---

## 17. Emergency-Use UX Rules

These rules apply to every screen and element reachable while emergency mode is active. Emergency mode is defined as: the period after the user taps the FAB and before they tap 'Dismiss'. During this window, the user is in motion, one-handed, and urgency is high.

### 17.1 One-Handed Reach Targets

Thumb zone analysis (right-hand portrait hold, 375pt baseline screen width): the lower-right quadrant is comfortable reach; upper half is stretch territory. Emergency elements must be in the lower 60% of screen.

| Element | Minimum Size | Position | Rationale |
|---------|-------------|---------|-----------|
| FAB | 64×64pt | bottom: 24pt + safe area, right: 16pt | Lower-right thumb zone; 64pt exceeds AAA target for emergency |
| Emergency sheet 'Navigate' CTA | Full-width, 56pt height | Below fold at 55% snap, above action row | Primary emergency action; full-width maximizes tap surface while moving |
| Emergency 'Dismiss' button | 44pt height minimum | Bottom of emergency sheet | Ghost/text style; must not be accidentally tapped during navigation |
| Mode chips [Any / Changing Table / Accessible] | 36pt height minimum, 12pt horizontal padding | Top of emergency sheet, below header strip | Secondary action — mode switching; not the most urgent action |
| 'Navigate' icon button in sheet header | 44×44pt | Top-right of sheet | Redundant quick access for screen-reader users |

**The ≤2 Tap Rule:**

From ANY top-level tab, emergency mode must be reachable in at most 2 taps. This is enforced by design: the Map tab FAB is always visible on the Map tab, and all other tabs are one tap from the Map tab. Implementation MUST NOT add any intermediate screen or confirmation between the FAB tap and the emergency bottom sheet appearing.

Diagram:
```
[Any Tab]
    ↓ Tap 1: switch to Map tab (or already on Map)
[Map Tab — FAB visible]
    ↓ Tap 2: tap FAB
[Emergency Mode Active — sheet at 55% snap immediately]
```

Violation: Adding an 'Are you sure?' dialog between FAB tap and emergency sheet = dead tap, forbidden.

### 17.2 No Dead-End States

A dead-end state is any screen or error where the user cannot take a meaningful next action. Every dead-end is a product defect for all users, and a safety hazard for emergency-mode users.

| Scenario | Forbidden Dead End | Required Recovery |
|----------|--------------------|------------------|
| GPS denied | Empty map, no UI | Search bar active (ERR-01); map at city view |
| No results for Changing Table chip | Empty sheet | Show nearest ANY bathroom as fallback with clear disclaimer (per CONTEXT.md) |
| No results for Accessible chip | Empty sheet | Show nearest ANY bathroom with disclaimer |
| No results in viewport | Empty map | 'Search this area' button + adjust filters prompt (ERR-06) |
| Network failure during emergency | Blocking spinner | Cached pins remain visible; ERR-04 banner shows |
| Verification failure | Lock-out | Generic retry message (ERR-09); user can attempt again |
| Auth modal dismissed | Auth wall | Returns to original screen with content still visible |

When a mode chip is selected (Changing Table or Accessible) and no confirmed matching location exists nearby, the emergency sheet MUST:
1. Show nearest ANY bathroom result
2. Display: 'No confirmed [changing table / accessible] bathroom found nearby — showing nearest available.'
3. Display: 'This location has not been confirmed for [wheelchair access / changing table].'
4. Show alternate action button: 'Search more' (expands search radius) or 'View [accessible / changing table] list' (switches to Nearby tab with mode filter active)
5. NEVER navigate silently to a non-qualifying location — always label the fallback explicitly

### 17.3 Large Primary Actions

Emergency context requires oversized, unambiguous primary actions. General UI sizing rules do not apply during emergency mode.

| Element | Standard Size | Emergency Minimum | Token |
|---------|-------------|-----------------|-------|
| Primary CTA button | 48pt height | 56pt height, full-width | — |
| FAB | Standard 56pt | 64×64pt | spacing.giant |
| Mode chip height | 32pt | 36pt | — |
| Text in emergency sheet | Body (17pt) | H1 (28pt) for location name, H3 (17pt) for distance | Typography scale |
| 'Navigate' CTA label | Body | BodyMedium, 17pt | — |

Emergency elements use `colors.emergency` and `colors.emergencyOrange` tokens EXCLUSIVELY. Using `colors.primary` (blue) for emergency-mode elements is a design defect — blue is reserved for standard navigation and non-urgent actions.

---

## 18. Accessibility Rules

Baseline: WCAG 2.1 AA for all elements. Target: WCAG 2.1 AAA for emergency-mode elements. These rules are enforced by the component acceptance checklist (Section 20).

### 18.1 Contrast Requirements

See Section 1.3 for the full contrast verification table. Summary:
- Body text (< 18pt or < 14pt bold): 4.5:1 minimum (AA)
- Large text (≥ 18pt or ≥ 14pt bold): 3:1 minimum (AA)
- Emergency mode primary elements (H1 location name, Navigate CTA): target 7:1 (AAA)
- Non-text UI elements (icons, borders): 3:1 minimum (WCAG 1.4.11)
- Disabled elements: exempt from contrast requirements
- CRITICAL: `confidenceMedium` (#FBBC04) fails on white — always render `textPrimary` (#202124) text inside medium-tier badges (see Section 1.3)

### 18.2 Touch Targets

Minimum touch targets per Apple HIG and WCAG 2.5.8:

| Element Type | Minimum Size | Implementation |
|-------------|-------------|---------------|
| Standard interactive element | 44×44pt | Set explicitly via `style={{ minWidth: 44, minHeight: 44 }}` or `hitSlop` |
| Emergency mode elements | 56×56pt | Explicit dimensions; `hitSlop` fallback |
| FAB | 64×64pt | Explicit container size |
| Rating emoji buttons | 48×48pt each | Row width = 5 × 48pt = 240pt minimum |
| Tab bar buttons | Full tab width × 49pt | Provided by Expo Router tab bar |
| Bottom sheet drag handle | Full sheet width × 44pt | `hitSlop: { top: 20, bottom: 20 }` on visible handle |

Use `hitSlop` to extend tap area beyond visual bounds when the visual element is smaller than the minimum. Do not resize visual elements to meet touch target minimums — extend the tap area instead.

### 18.3 Required Accessibility Props

Every interactive element must declare all applicable props:

| Element | accessibilityRole |
|---------|------------------|
| Tab bar button | tab |
| FAB button | button |
| Map pin | button (announces location name) |
| Rating emoji | button with accessibilityValue |
| Filter chip | togglebutton with accessibilityState.checked |
| Bottom sheet drag handle | adjustable with accessibilityValue |
| Search field | search |
| Auth form field | none (label from associated Text) |
| Confidence badge | text (non-interactive) |
| Policy tag badge | text (non-interactive) |
| Modal close button | button |
| Mode chip in emergency sheet | togglebutton |

In addition to `accessibilityRole`, every interactive element also requires:
- `accessibilityLabel` — string description of what the element IS (announced first by screen reader)
- `accessibilityHint` — string description of what happens on tap (use when outcome is not obvious from label alone)
- `accessibilityState` — object with `{ disabled, selected, checked, expanded }` as applicable

Rating inputs additionally require:
```
accessibilityValue={{ min: 1, max: 5, now: selectedRating, text: 'N out of 5 — Label' }}
```

Bottom sheet drag handle additionally requires:
```
accessibilityValue={{ text: 'Peek' | 'Half' | 'Full' }}
```

### 18.4 Non-Color-Only Status (WCAG 1.4.1)

Color must never be the ONLY indicator of status. Every status must include a secondary indicator (icon, text, or pattern).

| Status | Color | Required Secondary Indicator |
|--------|-------|------------------------------|
| Confidence: High | Green pill | Text: "High" + checkmark-circle icon |
| Confidence: Medium | Yellow pill | Text: "Medium" + time-outline icon |
| Confidence: Low | Red pill | Text: "Low" + warning-outline icon |
| GPS Accuracy: Good | Green text | "✓" checkmark-circle prefix |
| GPS Accuracy: Poor | Orange/red text | "⚠" warning-outline prefix |
| Filter chip: Active | Filled/primary bg | Bold label text + checkmark icon |
| Emergency mode | Red/orange strip | "NEAREST RESULT" text badge |
| Pending pin | Gray dashed | "Pending" text label in bottom sheet detail |
| Policy tag: Chill Spot | Green pill | "Chill Spot" text label |
| Policy tag: Code Required | Orange pill | "Code Required" text label |
| Policy tag: Public Facility | Blue pill | "Public Facility" text label |
| Policy tag: Purchase Required | Gray pill | "Purchase Required" text label |
| Offline state | Amber banner | "⚠ No connection" text in banner |
| Error state (inline) | Red text/icon | alert-circle icon + error message text |

### 18.5 Dynamic Type Tolerance

All layouts must not break at ±5 accessibility text size steps (iOS: Settings → Accessibility → Display & Text Size → Larger Text; Android: Font Size accessibility setting).

Rules:
- Use flex-based sizing — no hardcoded row heights (e.g., `height: 60` is forbidden on content rows; `minHeight: 56` is permitted for buttons where a minimum size is required)
- `numberOfLines` prop is forbidden on: location name, distance text, CTA labels, error copy, badge labels
- `numberOfLines` is permitted on: timing tips list items, report history entries (truncation expected with 'read more')
- Bottom sheet content must scroll (ScrollView), not clip, at maximum text size
- Test at iOS Larger Text step 5 (approximately 1.6× base size) before signing off on any screen

### 18.6 Reduced Motion

All transitions that animate position, scale, or opacity must check `AccessibilityInfo.isReduceMotionEnabled()` at render time and substitute an instant show/hide for the animation.

Elements requiring reduced-motion alternatives:

| Element | Default Animation | Reduced-Motion Substitute |
|---------|------------------|--------------------------|
| Bottom sheet snap | Spring/easing animation | Instant snap to position |
| Skeleton loader shimmer | Animated.loop opacity | Static skeleton (no shimmer) |
| FAB pulse/glow (if added) | Scale pulse animation | Static FAB, no pulse |
| Emergency sheet slide-up | Spring slide from bottom | Instant appear at 55% snap |
| Success checkmark animation | Scale + opacity sequence | Static checkmark, instant show |
| Mode chip transition | Crossfade | Instant swap |

Implementation pattern:
```typescript
import { AccessibilityInfo } from 'react-native';

const [reduceMotion, setReduceMotion] = useState(false);
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
}, []);

// In animation: if reduceMotion, skip Animated.timing — directly set value
```

---

## 19. Skeleton Loading Pattern

Use skeleton placeholders (not spinners) for content areas. Spinners are forbidden for full-content areas — use spinners only for point-in-time actions (submitting a form, GPS verification in progress).

Skeleton uses `colors.skeletonBase` as the base color and `colors.skeletonHighlight` as the shimmer peak. Animated via `Animated.loop` with `useNativeDriver: true` (opacity oscillation). See Section 18.6 for reduced-motion substitute.

| Context | Skeleton Elements |
|---------|-----------------|
| Bottom sheet Peek (pin tap) | Gray bar 60% width (name), gray bar 30% width (distance), two small gray pills (badges) |
| Bottom sheet Half (loading) | All Peek elements + 3 gray bars full-width (hours/detail lines) + gray action row placeholder |
| Nearby list item | Left gray square 48×48pt (pin icon), right: two gray bars 70% and 40% width |
| Profile stats (not yet loaded) | Three gray number placeholders 32×24pt each |

---

## 20. Component Acceptance Checklist

**This checklist is mandatory for every Phase 2+ screen before Codex review is requested.** Phase 2+ PLAN.md files must cite this section verbatim as the pre-review gate. A screen that fails any item is not review-ready.

Copy this checklist into each PLAN.md that creates or modifies a screen component. All items must be checked before running `/review-gate`.

```markdown
## Component Acceptance Checklist (from docs/design/design-system.md §20)

### Visual Tokens
- [ ] All color values reference `Colors[colorScheme].tokenName` — no raw hex strings in component StyleSheet
- [ ] All text sizes reference the typography scale (`typography.ts` constants) — no inline `fontSize` raw numbers
- [ ] All spacing values reference the spacing scale (`spacing.ts` constants) — no magic numbers
- [ ] Dark mode tested: toggle OS dark mode setting, verify no color inversion artifacts or invisible elements
- [ ] Policy tag badge colors match Section 8 token table — `code_required` uses `textPrimary` text (not white)
- [ ] Confidence badge colors match Section 9 — `confidenceMedium` uses `textPrimary` text (not white)

### Accessibility
- [ ] All tappable elements have `accessibilityLabel` (non-empty string)
- [ ] All tappable elements have `accessibilityRole` (see Section 18.3 role table)
- [ ] `accessibilityHint` added on any element whose action outcome is not obvious from the label
- [ ] `accessibilityState` reflects current state: `{ disabled, selected, checked, expanded }` as applicable
- [ ] Rating inputs have `accessibilityValue={{ min: 1, max: 5, now: N, text: 'N out of 5 — Label' }}`
- [ ] No status uses color as its only indicator — every status has icon + text alongside color (Section 18.4)
- [ ] All touch targets ≥44pt; emergency-mode elements ≥56pt; FAB 64×64pt (Section 18.2)
- [ ] No `numberOfLines` on critical labels (location name, CTA text, error copy, distance)
- [ ] Tested at iOS maximum Larger Text size (+5 steps) — no content clipping, no layout breakage

### Error States
- [ ] All error conditions applicable to this screen are handled (reference Section 15 Error-State Copy Matrix)
- [ ] No screen state is a dead end — every error has a recovery action with a tappable affordance
- [ ] Auth-required state (ERR-10) triggers inline slide-up modal, not a full navigation redirect
- [ ] Failed verification copy (ERR-09) is generic — does not reveal detection method or rejection reason

### Emergency Mode
- [ ] Emergency-mode elements use `colors.emergency` / `colors.emergencyOrange` tokens — not `colors.primary`
- [ ] Any screen reachable during emergency mode has ≥56pt primary action height
- [ ] Emergency mode dismiss is explicit (Dismiss button or FAB re-tap) — no auto-dismiss
- [ ] Emergency mode is reachable from this tab in ≤2 taps (verify against Section 16 reachability matrix)

### Loading States
- [ ] Skeleton placeholders (not spinners) used for content area loading (Section 19 skeleton spec)
- [ ] Skeleton uses `colors.skeletonBase` / `colors.skeletonHighlight` tokens
- [ ] Reduced-motion: skeleton renders without animation when `AccessibilityInfo.isReduceMotionEnabled()` is true

### Map Pins (Map-screen components only)
- [ ] Pin colors driven by Mapbox `match` expression on `policy_tag` — not React state or client-side conditional
- [x] Pending pin visible only via the separate `get_my_pending_submissions` RPC (server-scoped to `auth.uid()`) rendered as its own ShapeSource — not a client-side filter, not merged into the main search RPC's feature collection (implemented Phase 4)
- [ ] Overlay icons (wheelchair, changing table) use separate SymbolLayer with `iconOffset: [8, -8]` starting point

### Bottom Sheet (components using bottom sheet)
- [ ] Snap points configured as exactly 30% / 55% / 90% — no intermediate or computed snap states
- [ ] Drag handle has `accessibilityRole='adjustable'` and `accessibilityValue={{ text: 'Peek'|'Half'|'Full' }}`
- [ ] Emergency mode sheet opens directly to 55% — no Peek state in emergency context

### GPS Consent (sign-up / first-launch components only)
- [ ] `gps_consent = true` and `gps_consent_at = now()` written ONLY after OS dialog resolves to `granted`
- [ ] Pre-prompt button triggers OS dialog only — does not itself write consent

### Security & Server Enforcement
- [ ] Access code field is ABSENT (not masked) for unauthenticated users — no client-side masking as the sole gate (T-1.5-05)
- [ ] `access_sensitivity` and `family_mode` filtering enforced at the RPC layer — client code must not apply these as a client-side filter (T-1.5-04)
- [ ] Public search results exclude deleted, shadowbanned, and suppressed locations at the server RPC — client-side filtering of these properties is forbidden
- [ ] No PII (email, display name) and no precise GPS coordinates written to `console.log`, analytics events, or crash/error reports
- [ ] No client-side trust score, shadowban status, or suppression logic — client receives pre-filtered results only; enforcement is server-side
```

---

## 21. App Icon Concept

The app icon concept is a text/ASCII description only. The actual asset is out of Phase 1.5 scope and will be produced as a separate design asset before App Store submission.

Concept: Bold, single-color icon on a solid background. Two viable directions:

**Direction A — Running Figure:**
A simplified silhouette of a person in a running posture (forward lean, one foot up, arms mid-swing). The figure conveys urgency without specifying the reason. Single flat color (emergency red, `#D93025`) on white background. No text, no bathroom iconography — the action speaks. Association: 'moving fast' — abstract enough for broad audiences, specific enough to suggest urgency.

**Direction B — Open Door with Arrow:**
A simplified door silhouette with a bold right-pointing arrow through the threshold. Conveys 'access' and 'entry' — metaphor for finding a way in. Single color (primary blue, `#1A73E8`) on white background. Association: 'finding access' — clear metaphor without embarrassment.

**Recommendation for Phase 1.5 review:** Direction A (running figure) aligns better with the 'urgency' brand pillar. Direction B risks being read as generic navigation. Codex/Antigravity review should confirm direction before commissioning the asset.

Asset format requirements (for when asset is produced):
- iOS: 1024×1024pt @1x PNG, no alpha channel, no rounded corners (iOS adds rounding automatically)
- Android: 512×512pt @1x PNG for Play Store; `android/app/src/main/res/` mipmap-* variants generated via `expo-build-properties`
- Expo: configured via `app.config.ts` `ios.icon` and `android.adaptiveIcon.foregroundImage` fields
