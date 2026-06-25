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
| (pending) | Pending | surface #F8F9FA | surface #1E1E1E | textSecondary | clock-outline | Dashed border, gray — visible to submitter only via submissions JOIN |

ARCHITECTURE NOTE: Pending pin visibility is submitter-only. The `locations` table has no `submitter_id` column. Visibility requires a JOIN against `submissions.submitter_id` inside `search_locations_bbox` RPC. The client-side filter is FORBIDDEN — it is a server-side concern only. Phase 3/4 plans must include this JOIN in the RPC, not a client-side conditional render.

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
| Pending | pinPending (#9AA0A6 light) | Dashed-outline pin, gray | Submitter only — requires submissions JOIN in RPC |
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
| ERR-01 | GPS Denied | OS location permission resolves to denied | "We can't find your location. Use search to browse bathrooms near an address." | Map opens at city-level (Eugene, OR default). Search bar active and focused. Filter chips hidden. No blocking modal — inline empty state only. | User types in search bar; result re-centers map |
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
