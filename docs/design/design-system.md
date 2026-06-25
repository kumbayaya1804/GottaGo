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
