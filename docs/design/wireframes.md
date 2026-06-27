# Gotta Go — ASCII Wireframes

**Phase 1.5 design contract.** Portrait-first ASCII wireframes for all 27 v1 screens and modal states. Screen H2 headings here match flow node names in `docs/design/flows.md` verbatim. No Phase 2–8 screen ships without a wireframe in this document.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `┌──────┐ │ │ └──────┘` | Screen frame (34-char wide portrait) |
| `9:41  ●●●●  WiFi  🔋` | Device status bar |
| `╔══════╗ ║ Label ║ ╚══════╝` | Primary button (filled) |
| `┌──────┐ │ Label │ └──────┘` | Secondary button OR text input |
| `( Label )` | Chip — inactive |
| `(●Label●)` | Chip — active (filled + bold) |
| `[!!!]` | FAB (Floating Action Button), bottom-right |
| `░░░░░░░` | Skeleton loading placeholder |
| `< text >` | Badge / pill |
| `①────②────③` | Progress steps (`●` = active/done) |
| `[Map][Nearby][Submit][Prf]` | Bottom tab bar |
| `[●]` | Map pin |
| `←` | Annotation arrow (outside frame) |
| `😣 😕 😐 😊 😍` | 1–5 emoji rating scale |

**Notation rules:** Frames are portrait. Annotations using `←` sit OUTSIDE the frame. Tap targets ≥44pt; emoji rating buttons ≥48×48pt. Every interactive element carries an accessibility label (VoiceOver/TalkBack), and every status uses color + icon/text (never color alone).

---

## Welcome Screen

Route: root (before tab navigation)

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│                                  │
│                                  │
│                                  │
│            🚪  ▶                 │
│                                  │
│           Gotta Go               │
│                                  │
│   Find a bathroom when           │
│      it matters most             │
│                                  │
│                                  │
│   ╔════════════════════════╗     │
│   ║   Find a Bathroom      ║     │
│   ╚════════════════════════╝     │
│                                  │
│  By continuing, you agree to     │
│  our [Terms of Service] and      │
│  [Privacy Policy].               │
│                                  │
└──────────────────────────────────┘
```

← "Find a Bathroom" is the single primary CTA → triggers GPS Consent Pre-prompt
← [Terms of Service] and [Privacy Policy] are tappable Termly links
← No tab bar on this screen (pre-navigation)

---

## GPS Consent Pre-prompt

Route: root overlay (fullscreen over Welcome)

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│                                  │
│                                  │
│              📍                  │
│                                  │
│        Enable Location           │
│                                  │
│   Gotta Go uses your location    │
│   to find bathrooms nearby.      │
│   We never share your exact      │
│   location or store your GPS     │
│   history.                       │
│                                  │
│   ╔════════════════════════╗     │
│   ║    Enable Location     ║     │
│   ╚════════════════════════╝     │
│                                  │
└──────────────────────────────────┘
```

← "Enable Location" triggers the OS permission dialog ONLY — it is NOT itself consent
← `users.gps_consent` is written only AFTER the OS dialog resolves to granted
← No tab bar

---

## Map Screen — Default State

Route: `/(tabs)/index`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│ ┌── 🔍 Search a city or address ─┐│
│ └────────────────────────────────┘│
│ ( Changing Table )( Wheelchair )  │
│ ( Chill Spot )( Open Now )( 4+ )  │
│                                  │
│         [●]Chill Spot            │
│                  [●]Code         │
│      [●]Public        [●]        │
│                                  │
│           [●]Purchase            │
│                                  │
│                          [!!!]   │
│ ┌──────────────────────────────┐ │
│ │[Map] [Nearby] [Submit] [Prf] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Search bar pinned top; filter chip row scrolls horizontally below it
← Map pins `[●]` colored by policy tag (green/orange/blue/gray) with label
← FAB `[!!!]` bottom-right, red/orange, above tab bar (thumb zone)
← Tab bar fixed at bottom; Map tab active

---

## Map Screen — GPS Denied State

Route: `/(tabs)/index`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│ ┌── 🔍 Search a city or address ─┐│
│ └────────────────────────────────┘│
│                                  │
│        ( city-level view )       │
│                                  │
│      Search a city or address     │
│       [●]      [●]               │
│            [●]        [●]        │
│                                  │
│                          [!!!]   │
│ ┌──────────────────────────────┐ │
│ │[Map] [Nearby] [Submit] [Prf] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Search bar is ACTIVE/highlighted by default (no GPS center) ← ACTIVE
← Filter chip row hidden when GPS denied
← Map opens to manual city/address search; no hardcoded default city; no GPS-centered pin
← FAB still present; no dead end — user browses via search

---

## Map Screen + Bottom Sheet Peek (30%)

Route: `/(tabs)/index`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│                                  │
│              ( map )             │
│          [●]      [●]            │
│                                  │
│ ┌──────────────────────────────┐ │
│ │            ────              │ │
│ │  Riverside Cafe              │ │
│ │  ░░░░░░░░░░░  or  0.3 mi     │ │
│ │  < Chill Spot >  < High >   │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Map fills top ~70%; sheet peek occupies bottom ~30%
← `────` is the drag handle
← Name + distance + `< Chill Spot >` policy badge + `< High >` confidence badge
← Skeleton `░░░` shows while data loads; resolves to real content <300ms
← Tab bar hidden behind sheet at this snap point

---

## Map Screen + Bottom Sheet Half (55%)

Route: `/(tabs)/index`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│              ( map )             │
│ ┌──────────────────────────────┐ │
│ │            ────              │ │
│ │  Riverside Cafe   0.3 mi    │ │
│ │  < Chill Spot >  < High 14 >│ │
│ │ ──────────────────────────  │ │
│ │  Hours: 7am–9pm             │ │
│ │  Ratings: 😊 4.2  (38)      │ │
│ │  Access Code: ****          │ │
│ │            [Tap to reveal]  │ │
│ │ ──────────────────────────  │ │
│ │ [GPS Verify] [⭐ Rate] [🚩]  │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Map fills top ~45%; sheet at 55%
← Access code row shows masked `****` for signed-in users; hidden entirely for unauth
← Action row `[GPS Verify] [⭐ Rate] [🚩 Report]` — each ≥44pt min tap target, all auth-required
← Confidence badge shows tier + verification count `< High 14 >`

---

## Map Screen + Bottom Sheet Full (90%)

Route: `/(tabs)/index`

```
┌──────────────────────────────────┐
│  9:41    ●●●●  WiFi  🔋  ( map ) │
│ ┌──────────────────────────────┐ │
│ │            ────              │ │
│ │  Riverside Cafe   0.3 mi    │ │
│ │  < Chill Spot >  < High 14 >│ │
│ │ ── Timing Tips ───────────  │ │
│ │  • Busy noon–1pm            │ │
│ │  • Clean after 8am weekdays │ │
│ │ ── Ratings Breakdown ─────  │ │
│ │  Cleanliness     😊 4.4     │ │
│ │  Accessibility   😐 3.1     │ │
│ │  Convenience     😍 4.8     │ │
│ │ ── Reports: 0 open ───────  │ │
│ │ ┌────────────────────────┐  │ │
│ │ │      Directions        │  │ │
│ │ └────────────────────────┘  │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Map barely visible at top ~10%; sheet at 90%
← Full content: timing tips list (recent first), ratings breakdown by dimension, report history summary, Directions button

---

## Map Screen — Emergency Mode Active (FAB tapped)

Route: `/(tabs)/index`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│              ( map )             │
│ ┌──────────────────────────────┐ │
│ │████ NEAREST RESULT ████      │ │
│ │            ────              │ │
│ │ (●Any Bathroom●)(Changing)   │ │
│ │ ( Accessible )               │ │
│ │                              │ │
│ │  Quick Stop Market          │ │
│ │  0.3 mi                      │ │
│ │   ╔══════════════════════╗  │ │
│ │   ║       Navigate       ║  │ │
│ │   ╚══════════════════════╝  │ │
│ │   [ Dismiss ]               │ │
│ └──────────────────────────────┘ │
│                       [!!!]🔴    │
└──────────────────────────────────┘
```

← FAB tapped → emergency sheet opens directly at half (55%), no peek
← Red/orange header strip `████` + NEAREST RESULT badge
← Mode chips `(●Any Bathroom●) ( Changing ) ( Accessible )` INSIDE sheet (NOT FAB expand)
← Large location name (h1 weight), bold distance, Navigate primary CTA → device maps
← FAB shown in activated red state `[!!!]🔴`; filter chip row hidden

---

## Emergency Mode Fallback State

Route: `/(tabs)/index`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│              ( map )             │
│ ┌──────────────────────────────┐ │
│ │████ NEAREST RESULT ████      │ │
│ │ ( Any )(●Changing●)(Access.) │ │
│ │                              │ │
│ │ No confirmed changing table  │ │
│ │ bathroom found nearby —      │ │
│ │ showing nearest available.   │ │
│ │ This location has not been   │ │
│ │ confirmed for changing table.│ │
│ │  Gas Station #4   0.5 mi     │ │
│ │   ╔══════════════════════╗  │ │
│ │   ║       Navigate       ║  │ │
│ │   ╚══════════════════════╝  │ │
│ │ [ Search more ][ View list ]│ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Same structure as Emergency Mode Active, with fallback copy when no confirmed match nearby
← Alternate actions: `[ Search more ]` (expand radius) `[ View changing table list ]` (Nearby tab w/ filter)
← Never navigates silently to an unconfirmed location without the explicit "not confirmed" label

---

## Sign-In Screen

Route: `/(auth)/sign-in`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│                                  │
│           Sign In                │
│                                  │
│  ┌────────────────────────────┐  │
│  │ Email                      │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Password                   │  │
│  └────────────────────────────┘  │
│  ╔════════════════════════════╗  │
│  ║          Sign In           ║  │
│  ╚════════════════════════════╝  │
│  ───────────  or  ───────────    │
│  ┌────────────────────────────┐  │
│  │   Continue with Google     │  │
│  └────────────────────────────┘  │
│                                  │
│      Create account              │
└──────────────────────────────────┘
```

← "Continue with Google" is Android only ← iOS shows "[ Sign in with Apple — coming soon ]" stub here
← "Create account" link routes to Sign-Up Screen
← No tab bar

---

## Sign-Up Screen

Route: `/(auth)/sign-up`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│                                  │
│        Create Account            │
│                                  │
│  ┌────────────────────────────┐  │
│  │ Display Name               │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Email                      │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Password                   │  │
│  └────────────────────────────┘  │
│  ╔════════════════════════════╗  │
│  ║      Create Account        ║  │
│  ╚════════════════════════════╝  │
│                                  │
│  Already have an account? Sign In│
└──────────────────────────────────┘
```

← On success, DB trigger auto-creates the `users` row; returns to triggering action
← "Sign In" link routes back to Sign-In Screen
← No tab bar

---

## Submit Flow Step 1

Route: `/(tabs)/submit` (auth required)

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│        ①────○────○               │
│        Add a Bathroom            │
│  ┌────────────────────────────┐  │
│  │ Name (required)            │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Address 🔍 (Places auto)   │  │
│  └────────────────────────────┘  │
│  Policy: ( Chill Spot )(Code Req)│
│          ( Purchase )( Public )  │
│  Accessibility:                  │
│   ☐ Wheelchair  ☐ Changing Table │
│   ☐ Family Restroom              │
│  ┌────────────────────────────┐  │
│  │          Next →            │  │
│  └────────────────────────────┘  │
│ ┌──────────────────────────────┐ │
│ │[Map] [Nearby] [Submit] [Prf] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Progress `①────○────○` (step 1 active)
← Address input has Google Places autocomplete active
← "Baby Changing Table" checkbox writes `{key:'has_changing_table', value:'true'}` to tags table (Phase 4)
← Tab bar shown

---

## Submit Flow Step 2

Route: `/(tabs)/submit` (auth required)

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│        ●────②────○               │
│      Access & Hours              │
│  Hours:                          │
│  ┌────────────────────────────┐  │
│  │ Mon–Fri  7:00am – 9:00pm   │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Access Code / PIN (optional)│ │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Timing tips (optional)     │  │
│  │                            │  │
│  └────────────────────────────┘  │
│  [ ← Back ]      [   Next →  ]   │
│ ┌──────────────────────────────┐ │
│ │[Map] [Nearby] [Submit] [Prf] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Progress `●────②────○` (step 1 done, step 2 active)
← All fields optional; Access Code requires auth to submit
← `[ ← Back ]` returns to Step 1; `[ Next → ]` advances to Step 3
← Tab bar shown

---

## Submit Flow Step 3

Route: `/(tabs)/submit` (auth required)

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│        ○────○────③               │
│       GPS Confirm                │
│                                  │
│   Accuracy: 12m ✅               │
│   You are 45m away               │
│                                  │
│  ┌── inline GPS error area ───┐  │
│  │ (empty when valid)         │  │
│  └────────────────────────────┘  │
│                                  │
│  ╔════════════════════════════╗  │
│  ║   I'm at This Location     ║  │
│  ╚════════════════════════════╝  │
│  [ ← Back ]                      │
│ ┌──────────────────────────────┐ │
│ │[Map] [Nearby] [Submit] [Prf] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Progress `○────○────③` (step 3 active)
← Live GPS readout: "Accuracy: 12m ✅" or "68m ⚠ — move to open area"
← "I'm at This Location" ENABLED only when accuracy ≤50m AND within 100m → disabled state otherwise ← DISABLED until GPS valid
← Inline GPS error area shows too-far / low-accuracy / stale-fix / possible-duplicate messages

---

## Submit Success Screen

Route: `/(tabs)/submit` (auth required)

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│                                  │
│              ✅                  │
│                                  │
│      Location Submitted!         │
│                                  │
│   It'll appear publicly after    │
│   2 GPS verifications. You can   │
│   see it on the map now.         │
│                                  │
│  ╔════════════════════════════╗  │
│  ║       Back to Map          ║  │
│  ╚════════════════════════════╝  │
│                                  │
└──────────────────────────────────┘
```

← "Back to Map" re-opens map ← pending pin (gray dashed) appears on map for SUBMITTER ONLY
← Submitter-only visibility requires JOIN on `submissions.submitter_id` in search RPC (not client filter)

---

## Verify Flow Screen

Modal: `router.push('/modals/verify')`

```
┌──────────────────────────────────┐
│  9:41    ●●●●  WiFi  🔋    Cancel │
│                                  │
│       Verify Location            │
│                                  │
│       Riverside Cafe             │
│                                  │
│   Accuracy: 12m ✅               │
│   You are 45m away (updates live)│
│                                  │
│  ╔════════════════════════════╗  │
│  ║         I'm Here           ║  │
│  ╚════════════════════════════╝  │
│  ┌── inline error area ───────┐  │
│  │ (empty when valid)         │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

← "I'm Here" is full-width, 56pt height ← enabled when accuracy ≤50m AND within 100m
← "Cancel" link top-right dismisses the modal
← Distance updates live; no tab bar (modal)

---

## Verify Flow Error State

Modal: `router.push('/modals/verify')`

```
┌──────────────────────────────────┐
│  9:41    ●●●●  WiFi  🔋    Cancel │
│                                  │
│       Verify Location            │
│                                  │
│       Riverside Cafe             │
│                                  │
│   Accuracy: 88m ⚠               │
│   You are 240m away              │
│                                  │
│  ┌────────────────────────────┐  │
│  │     I'm Here (disabled)    │  │
│  └────────────────────────────┘  │
│  ┌── inline error area ───────┐  │
│  │ You're too far away — need │  │
│  │ to be within 100m          │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

← Error area populated: "You're too far away — need to be within 100m" OR "GPS accuracy too low — move to an open area and try again"
← Button shown disabled `[ I'm Here (disabled) ]` ← disabled until GPS valid
← Security-sensitive rejections show generic "Unable to verify your location. Please try again."

---

## Verify Flow Success State

Modal: `router.push('/modals/verify')`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│                                  │
│                                  │
│              ✅                  │
│           (animation)            │
│                                  │
│          Verified!               │
│                                  │
│   Thanks for keeping data        │
│   fresh.                         │
│                                  │
│  ┌────────────────────────────┐  │
│  │          Done              │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

← Checkmark animation area (reduced-motion alternative: static checkmark)
← `[ Done ]` returns to the bottom sheet; no retry needed

---

## Report Flow Step 1

Modal: `router.push('/modals/report')`

```
┌──────────────────────────────────┐
│  9:41    ●●●●  WiFi  🔋    Cancel │
│                                  │
│       Report a Problem           │
│                                  │
│  ┌────────────────────────────┐  │
│  │ Permanently Closed         │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Access Denied / Locked     │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Code is Wrong              │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Dirty or Unsafe            │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Duplicate Location         │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

← 5 large tappable rows, each ≥44pt min tap target
← "Cancel" link top-right ← exactly 5 report types matching CONTEXT.md
← "Duplicate Location" maps to `duplicate_location` (Phase 7 migration required)

---

## Report Flow Step 2

Modal: `router.push('/modals/report')`

```
┌──────────────────────────────────┐
│  9:41    ●●●●  WiFi  🔋    Cancel │
│                                  │
│                                  │
│   Report this as                 │
│   "Permanently Closed"?          │
│                                  │
│   This helps keep data           │
│   accurate.                      │
│                                  │
│  ╔════════════════════════════╗  │
│  ║      Submit Report         ║  │
│  ╚════════════════════════════╝  │
│  ┌────────────────────────────┐  │
│  │          Cancel            │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

← No text input required ← intentional (low-friction reporting)
← "Submit Report" → `report_location` RPC → toast "Report submitted. Thanks for helping." → sheet returns

---

## Rating Screen

Modal: `router.push('/modals/rating')`

```
┌──────────────────────────────────┐
│  9:41    ●●●●  WiFi  🔋    Cancel │
│                                  │
│     Rate This Bathroom           │
│                                  │
│  Cleanliness                     │
│   😣  😕  😐  😊  😍             │
│  Accessibility                   │
│   😣  😕  😐  😊  😍             │
│  Convenience                     │
│   😣  😕  😐  😊  😍             │
│  Changing Surface  (if avail.)   │
│   😣  😕  😐  😊  😍             │
│                                  │
│  ╔════════════════════════════╗  │
│  ║       Submit Rating        ║  │
│  ╚════════════════════════════╝  │
└──────────────────────────────────┘
```

← 4 dimensions, each a 1–5 emoji scale `😣 😕 😐 😊 😍`
← Changing Surface row renders ONLY if location has_changing_table (derived from tags table)
← Emoji buttons ≥48×48pt; each carries accessibilityValue "Rating: 3 out of 5 — Acceptable"

---

## Nearby Tab

Route: `/(tabs)/nearby`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│           Nearby                 │
│ ┌──────────────────────────────┐ │
│ │[●] Riverside Cafe            │ │
│ │    0.3 mi  < High > Chill    │ │
│ ├──────────────────────────────┤ │
│ │[●] Quick Stop Market         │ │
│ │    0.4 mi  < Med >  Code Req │ │
│ ├──────────────────────────────┤ │
│ │[●] City Library              │ │
│ │    0.6 mi  < High > Public   │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │[Map] [Nearby] [Submit] [Prf] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Screen created in Phase 2 ← accessible list alternative to map
← Rows sorted by distance: `[●] Name — 0.3 mi — < High > — Chill Spot`
← No FAB (FAB is Map-tab only); tab bar shown

---

## Profile Tab — Signed In

Route: `/(tabs)/profile`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│                                  │
│           ( ◯ )                  │
│         Jamie Rivera             │
│        j••••@gmail.com           │
│  ── Stats ──────────────────     │
│   GPS Verifications: 12          │
│   Locations Submitted: 3         │
│   Ratings Given: 8               │
│  ── Settings ───────────────     │
│   Account                        │
│   Privacy Policy        →        │
│   Terms of Service      →        │
│   Delete Account                 │
│   Sign Out                       │
│ ┌──────────────────────────────┐ │
│ │[Map] [Nearby] [Submit] [Prf] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Avatar placeholder circle + display name + masked email
← Stats: GPS verifications, locations submitted, ratings given
← Privacy Policy / Terms of Service are Termly links; tab bar shown

---

## Profile Tab — Unauthenticated

Route: `/(tabs)/profile`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│                                  │
│      Sign in to contribute       │
│                                  │
│   Track your contributions       │
│   and access door codes.         │
│                                  │
│  ╔════════════════════════════╗  │
│  ║          Sign In           ║  │
│  ╚════════════════════════════╝  │
│  ┌────────────────────────────┐  │
│  │      Create Account        │  │
│  └────────────────────────────┘  │
│   ? GPS Verifications  (muted)   │
│   ? Locations Submitted (muted)  │
│ ┌──────────────────────────────┐ │
│ │[Map] [Nearby] [Submit] [Prf] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← "Sign in to contribute" headline + value prop
← Stats preview grayed/muted ("? GPS Verifications") ← muted until signed in
← Tab bar shown

---

## Auth Required Modal

Inline slide-up (appears over any screen when a protected action is tapped)

```
┌──────────────────────────────────┐
│░░░░░░░░ dimmed backdrop ░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ┌──────────────────────────────┐ │
│ │            ────              │ │
│ │   Sign in to verify          │ │
│ │                              │ │
│ │  ╔════════════════════════╗  │ │
│ │  ║        Sign In         ║  │ │
│ │  ╚════════════════════════╝  │ │
│ │  ┌────────────────────────┐  │ │
│ │  │    Create Account      │  │ │
│ │  └────────────────────────┘  │ │
│ │  [ Cancel ]                  │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Slide-up sheet (not full navigation); backdrop dims underlying screen
← Heading is action-specific: "Sign in to [verify / rate / report / submit]"
← After auth ← returns to the triggering action flow

---

## Pending Location Detail Sheet

Route: `/(tabs)/index`

```
┌──────────────────────────────────┐
│  9:41          ●●●●  WiFi  🔋     │
│              ( map )             │
│ ┌──────────────────────────────┐ │
│ │            ────              │ │
│ │ ┊●┊ New Spot   < Pending >   │ │
│ │  0.2 mi                      │ │
│ │ ──────────────────────────  │ │
│ │ Pending — 1 of 2 GPS         │ │
│ │ verifications received.      │ │
│ │ Share with friends to speed  │ │
│ │ up verification.             │ │
│ │ ──────────────────────────  │ │
│ │ [GPS Verify]                 │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

← Same as Bottom Sheet Half but gray dashed pin indicator `┊●┊` + `< Pending >` badge
← Body: "Pending — 1 of 2 GPS verifications received…"
← Action row shows ONLY [GPS Verify] (no Rate/Report for pending)
← Visibility requires JOIN on `submissions.submitter_id` in search RPC ← submitter-only

---

## Filter Chip Row — Active State

Inset frame (not full screen)

```
┌──────────────────────────────────┐
│ (●Changing Table●)(●Wheelchair●) │
│ ( Chill Spot )( Open Now )(Clean:4+)│
└──────────────────────────────────┘
```

← Active chip = filled background + bold label + check `(●Label●)`
← Row is horizontally scrollable
← Hidden entirely during emergency mode

---

## Wireframe Index

| # | Screen | Route / Modal | Plan Created |
|---|--------|---------------|--------------|
| 1 | Welcome Screen | root | Phase 2 |
| 2 | GPS Consent Pre-prompt | root overlay | Phase 2 |
| 3 | Map Screen — Default State | /(tabs)/index | Phase 3 |
| 4 | Map Screen — GPS Denied State | /(tabs)/index | Phase 3 |
| 5 | Map Screen + Bottom Sheet Peek | /(tabs)/index | Phase 3 |
| 6 | Map Screen + Bottom Sheet Half | /(tabs)/index | Phase 3 |
| 7 | Map Screen + Bottom Sheet Full | /(tabs)/index | Phase 3 |
| 8 | Map Screen — Emergency Mode Active | /(tabs)/index | Phase 8 |
| 9 | Emergency Mode Fallback State | /(tabs)/index | Phase 8 |
| 10 | Sign-In Screen | /(auth)/sign-in | Phase 2 |
| 11 | Sign-Up Screen | /(auth)/sign-up | Phase 2 |
| 12 | Submit Flow: Step 1 | /(tabs)/submit | Phase 4 |
| 13 | Submit Flow: Step 2 | /(tabs)/submit | Phase 4 |
| 14 | Submit Flow: Step 3 | /(tabs)/submit | Phase 4 |
| 15 | Submit Flow: Success | /(tabs)/submit | Phase 4 |
| 16 | Verify Flow Screen | modal: /modals/verify | Phase 5 |
| 17 | Verify Flow: Error State | modal: /modals/verify | Phase 5 |
| 18 | Verify Flow: Success State | modal: /modals/verify | Phase 5 |
| 19 | Report Flow: Step 1 | modal: /modals/report | Phase 7 |
| 20 | Report Flow: Step 2 | modal: /modals/report | Phase 7 |
| 21 | Rating Screen | modal: /modals/rating | Phase 8 |
| 22 | Nearby Tab | /(tabs)/nearby | Phase 2 |
| 23 | Profile Tab — Signed In | /(tabs)/profile | Phase 2 |
| 24 | Profile Tab — Unauthenticated | /(tabs)/profile | Phase 2 |
| 25 | Auth Required Modal | inline slide-up | Phase 2 |
| 26 | Pending Location Detail Sheet | /(tabs)/index | Phase 4 |
| 27 | Filter Chip Row — Active State | /(tabs)/index | Phase 3 |
