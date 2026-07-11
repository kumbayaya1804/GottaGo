# Gotta Go — Navigation & Interaction Flows

**Phase 1.5 design contract.** This document is the canonical source of truth for every named user flow in v1. No Phase 2–8 screen ships without a flow node defined here and a matching wireframe in `docs/design/wireframes.md`.

Each H2 section contains exactly one `flowchart TD` Mermaid block. Screen node names here are canonical — `docs/design/wireframes.md` uses the same names verbatim.

**Node shape conventions:**

- `([text])` — rounded rectangle — start / terminal end state
- `[text]` — rectangle — screen or system action
- `{text}` — diamond — decision point
- `[/text/]` — parallelogram — user input / user action
- `-->|label|` — labeled transition
- Terminal states styled green; error exits styled red.

---

## First Launch Flow

```mermaid
flowchart TD
    Start([App Launch])
    Welcome[Welcome Screen]
    TapFind[/User taps Find a Bathroom/]
    PrePrompt[GPS Consent Pre-prompt]
    OSDialog{OS Permission Dialog}
    WriteConsent[System: write users.gps_consent=true, gps_consent_at=now]
    MapGPS[Map Screen GPS Centered]
    MapCity[Map Screen City View Search Active]
    EndMain([Main Experience])

    Start --> Welcome
    Welcome --> TapFind
    TapFind --> PrePrompt
    PrePrompt --> OSDialog
    OSDialog -->|Granted| WriteConsent
    WriteConsent --> MapGPS
    MapGPS --> EndMain
    OSDialog -->|Denied| MapCity
    MapCity --> EndMain

    style Start fill:#E6F4EA,stroke:#34A853
    style EndMain fill:#E6F4EA,stroke:#34A853
```

> GPS consent (the `users.gps_consent` write) occurs ONLY after the OS dialog resolves to Granted — never on the pre-prompt tap. If the OS dialog is denied, `gps_consent` remains false/unset and the app falls back to city view (no dead end).

---

## GPS Consent — Grant Path

```mermaid
flowchart TD
    PrePrompt[GPS Consent Pre-prompt]
    TapEnable[/Tap Enable Location/]
    OSDialog{OS Permission Dialog}
    Write[Write users.gps_consent=true, gps_consent_at=now]
    MapGPS([Map Screen GPS Centered])

    PrePrompt --> TapEnable
    TapEnable --> OSDialog
    OSDialog -->|Granted| Write
    Write --> MapGPS

    style MapGPS fill:#E6F4EA,stroke:#34A853
```

---

## GPS Consent — Deny Path

```mermaid
flowchart TD
    PrePrompt[GPS Consent Pre-prompt]
    TapEnable[/Tap Enable Location/]
    OSDialog{OS Permission Dialog}
    MapCity[Map Screen City View]
    SearchActive[Search bar active, GPS-centered view disabled]
    EndBrowse([User can still browse])

    PrePrompt --> TapEnable
    TapEnable --> OSDialog
    OSDialog -->|Denied| MapCity
    MapCity --> SearchActive
    SearchActive --> EndBrowse

    style MapCity fill:#FCE8E6,stroke:#EA4335
    style EndBrowse fill:#E6F4EA,stroke:#34A853
```

---

## Sign-In Flow

```mermaid
flowchart TD
    Trigger1[/Protected action tapped/]
    Trigger2[/Profile tab tapped (unauth)/]
    Modal[Auth Required Modal]
    Choice{Choice}
    SignIn[Sign-In Screen]
    EnterCreds[/Enter email + password/]
    AuthResult{Auth result}
    ReturnAction([Return to triggering action])
    InlineErr[Inline error: Invalid credentials]
    GoogleLink[Deep link to Google]
    OAuthResult{OAuth result}
    OAuthErr[Inline error]
    ReturnOAuth([Return to triggering action])

    Trigger1 --> Modal
    Trigger2 --> Modal
    Modal --> Choice
    Choice -->|Sign In| SignIn
    SignIn --> EnterCreds
    EnterCreds --> AuthResult
    AuthResult -->|Success| ReturnAction
    AuthResult -->|Failed| InlineErr
    InlineErr --> SignIn
    Choice -->|Google OAuth Android| GoogleLink
    GoogleLink --> OAuthResult
    OAuthResult -->|Success| ReturnOAuth
    OAuthResult -->|Failed| OAuthErr
    OAuthErr --> SignIn

    style ReturnAction fill:#E6F4EA,stroke:#34A853
    style ReturnOAuth fill:#E6F4EA,stroke:#34A853
    style InlineErr fill:#FCE8E6,stroke:#EA4335
    style OAuthErr fill:#FCE8E6,stroke:#EA4335
```

> Google OAuth is Android-only. iOS shows an "Sign in with Apple — coming soon" stub in place of the Google button.

---

## Sign-Up Flow

```mermaid
flowchart TD
    SignIn[Sign-In Screen]
    TapCreate[/Tap Create Account/]
    SignUp[Sign-Up Screen]
    EnterFields[/Enter email, password, display name/]
    Validation{Validation}
    Signup[Supabase signup: DB trigger creates users row]
    ReturnAction([Return to triggering action])
    FieldErr[Inline field errors]

    SignIn --> TapCreate
    TapCreate --> SignUp
    SignUp --> EnterFields
    EnterFields --> Validation
    Validation -->|Valid| Signup
    Signup --> ReturnAction
    Validation -->|Invalid| FieldErr
    FieldErr --> SignUp

    style ReturnAction fill:#E6F4EA,stroke:#34A853
    style FieldErr fill:#FCE8E6,stroke:#EA4335
```

---

## Map Discovery Flow

```mermaid
flowchart TD
    Map[Map Screen]
    TapPin[/Tap bathroom pin/]
    PeekSkel[Bottom Sheet Peek 30%: skeleton loading]
    Loaded{Data loaded?}
    PeekReal[Bottom Sheet Peek 30%: name, distance, policy badge, confidence badge]
    DragHalf[/Drag or tap/]
    Half[Bottom Sheet Half 55%: hours, ratings, access code auth only, action row]
    DragFull[/Drag or tap/]
    Full([Bottom Sheet Full 90%: timing tips, ratings breakdown, directions])
    Banner[Loading banner at top]
    TapOther[/Tap different pin/]
    Animate([Bottom Sheet content animates in-place, no dismiss])

    Map --> TapPin
    TapPin --> PeekSkel
    PeekSkel --> Loaded
    Loaded -->|Yes| PeekReal
    PeekReal --> DragHalf
    DragHalf --> Half
    Half --> DragFull
    DragFull --> Full
    Loaded -->|No >2s| Banner
    Banner --> Loaded
    PeekReal --> TapOther
    TapOther --> Animate

    style Full fill:#E6F4EA,stroke:#34A853
    style Animate fill:#E6F4EA,stroke:#34A853
```

---

## Emergency Mode Flow

```mermaid
flowchart TD
    Map[Map Screen]
    TapFAB[/Tap FAB red bottom-right/]
    Fetch[Fetch nearest any bathroom]
    Sheet[Emergency Result Sheet Half 55%: red header, NEAREST RESULT badge, mode chips Any/Changing Table/Accessible]
    TapNav[/Tap Navigate/]
    Maps([Device maps app opens])
    TapDismiss[/Tap Dismiss or FAB again/]
    Collapse([Sheet collapses, emergency mode off])

    Map --> TapFAB
    TapFAB --> Fetch
    Fetch --> Sheet
    Sheet --> TapNav
    TapNav --> Maps
    Sheet --> TapDismiss
    TapDismiss --> Collapse

    style Maps fill:#E6F4EA,stroke:#34A853
    style Collapse fill:#E6F4EA,stroke:#34A853
```

> FAB is single-tap (no expand menu). Mode switching happens via chips INSIDE the result sheet — see Changing Table NOW and Accessible NOW flows.

---

## Changing Table NOW Flow

```mermaid
flowchart TD
    Sheet[Emergency Result Sheet]
    TapChip[/Tap Changing Table chip/]
    Confirmed{Confirmed changing table location nearby?}
    Recenter[Map re-centers, sheet updates in-place: confirmed changing table location]
    TapNav[/Tap Navigate/]
    Maps([Device maps app opens])
    Fallback[Fallback: nearest any bathroom shown]
    FallbackCopy[Display: No confirmed changing table bathroom nearby — showing nearest available. This location has not been confirmed for changing table]
    AltAction[Alternate action: Search more button OR View changing table list button]

    Sheet --> TapChip
    TapChip --> Confirmed
    Confirmed -->|Yes| Recenter
    Recenter --> TapNav
    TapNav --> Maps
    Confirmed -->|No| Fallback
    Fallback --> FallbackCopy
    FallbackCopy --> AltAction

    style Maps fill:#E6F4EA,stroke:#34A853
    style Fallback fill:#FCE8E6,stroke:#EA4335
    style FallbackCopy fill:#FCE8E6,stroke:#EA4335
```

---

## Accessible NOW Flow

```mermaid
flowchart TD
    Sheet[Emergency Result Sheet]
    TapChip[/Tap Accessible chip/]
    Confirmed{Confirmed wheelchair-accessible location nearby?}
    Recenter[Map re-centers, sheet updates in-place]
    TapNav[/Tap Navigate/]
    Maps([Device maps app opens])
    Fallback[Fallback: nearest any bathroom]
    FallbackCopy[Display: No confirmed accessible bathroom nearby — showing nearest available. This location has not been confirmed for wheelchair access]
    AltAction[Alternate action: Search more OR View accessible list]

    Sheet --> TapChip
    TapChip --> Confirmed
    Confirmed -->|Yes| Recenter
    Recenter --> TapNav
    TapNav --> Maps
    Confirmed -->|No| Fallback
    Fallback --> FallbackCopy
    FallbackCopy --> AltAction

    style Maps fill:#E6F4EA,stroke:#34A853
    style Fallback fill:#FCE8E6,stroke:#EA4335
    style FallbackCopy fill:#FCE8E6,stroke:#EA4335
```

---

## Submit Flow

```mermaid
flowchart TD
    TapSubmit[/Tap Submit tab auth required/]
    Authd{Authenticated?}
    Modal[Auth Required Modal]
    AuthScreens[Sign-In/Sign-Up]
    Step1[Submit Flow Step 1: Name, Address Places autocomplete, Policy tag picker, Accessibility tags]
    TapNext1[/Tap Next/]
    Step2[Submit Flow Step 2: Hours picker, Access code optional, Timing tips]
    TapNext2[/Tap Next/]
    Step3[Submit Flow Step 3 GPS Confirm: Live GPS accuracy, distance from address, I am at this location button]
    GPSValid{GPS valid?}
    RPC[submit_location RPC called]
    RPCResult{RPC result?}
    Success[Submit Success Screen]
    TapBack[/Tap Back to Map/]
    MapPending([Map Screen: pending pin visible to submitter only via the separate get_my_pending_submissions RPC])
    DupInline[Inline: A bathroom at this address may already exist. View existing]
    DupChoice{User choice}
    RPCConfirm[submit_location RPC called with confirm_duplicate true]
    SuccessDup[Submit Success Screen]
    MapCancel([Map Screen])
    GPSErr[Inline GPS error: too far / low accuracy / stale fix]

    TapSubmit --> Authd
    Authd -->|No| Modal
    Modal --> AuthScreens
    AuthScreens --> Step1
    Authd -->|Yes| Step1
    Step1 --> TapNext1
    TapNext1 --> Step2
    Step2 --> TapNext2
    TapNext2 --> Step3
    Step3 --> GPSValid
    GPSValid -->|Valid| RPC
    RPC --> RPCResult
    RPCResult -->|success no duplicate| Success
    Success --> TapBack
    TapBack --> MapPending
    RPCResult -->|duplicate_candidate| DupInline
    DupInline --> DupChoice
    DupChoice -->|Continue| RPCConfirm
    RPCConfirm --> SuccessDup
    SuccessDup --> MapPending
    DupChoice -->|Cancel| MapCancel
    GPSValid -->|GPS invalid| GPSErr
    GPSErr --> Step3

    style MapPending fill:#E6F4EA,stroke:#34A853
    style MapCancel fill:#E6F4EA,stroke:#34A853
    style GPSErr fill:#FCE8E6,stroke:#EA4335
    style DupInline fill:#FCE8E6,stroke:#EA4335
```

> **Server contract (STALE — needs reconciliation before citing as current):** this section originally described a client-generated `submission_id` UUID with `duplicate_candidate`/`confirm_duplicate` idempotency semantics. The live `submit_location` RPC signature (`supabase/migrations/20260707020000_phase4_submission_staging.sql`) takes `p_name, p_lat, p_lng, p_accuracy_m, p_mocked, p_captured_at, p_policy_tag, p_address, p_access_sensitivity, p_hours, p_access_code, p_timing_tip` and returns a plain `uuid` — there is no `submission_id`/`confirm_duplicate` parameter and no duplicate-candidate return shape in the shipped function. Whether client-side or server-side duplicate detection exists at all was not re-verified during this doc pass — check `04-CONTEXT.md`/`04-RESEARCH.md`/`submit.tsx` directly before relying on this diagram's duplicate-handling branch.

> **Pending pin visibility (corrected — Phase 4 implemented):** `get_my_pending_submissions()` is a separate, no-arg, `auth.uid()`-scoped RPC — not a JOIN inside the search RPCs. MapScreen renders its result as an independent Mapbox layer, never a client-side filter.

---

## Verify Flow

```mermaid
flowchart TD
    TapVerify[/Tap GPS Verify in action row auth required/]
    Authd{Authenticated?}
    Modal[Auth Required Modal]
    SignIn[Sign-In]
    VerifyScreen[Verify Flow Screen: Location name, live GPS accuracy readout, distance from location, I am Here button]
    GPSValid{GPS valid AND within 100m?}
    TapHere[/Tap I am Here/]
    RPC[verify_location RPC]
    RPCResult{RPC result}
    SuccessState[Verify Success State: checkmark + Verified! Thanks for keeping data fresh]
    SheetReturn([Sheet returns])
    AlreadyVerified[Inline: You have already verified this location today]
    GenericErr[Inline: Unable to verify your location. Please try again]
    GPSNotReady[Inline GPS error shown, button disabled]

    TapVerify --> Authd
    Authd -->|No| Modal
    Modal --> SignIn
    SignIn --> VerifyScreen
    Authd -->|Yes| VerifyScreen
    VerifyScreen --> GPSValid
    GPSValid -->|Yes| TapHere
    TapHere --> RPC
    RPC --> RPCResult
    RPCResult -->|Success| SuccessState
    SuccessState --> SheetReturn
    RPCResult -->|Already verified today| AlreadyVerified
    AlreadyVerified --> VerifyScreen
    RPCResult -->|RPC error generic| GenericErr
    GenericErr --> VerifyScreen
    GPSValid -->|GPS not ready| GPSNotReady
    GPSNotReady --> VerifyScreen

    style SheetReturn fill:#E6F4EA,stroke:#34A853
    style GenericErr fill:#FCE8E6,stroke:#EA4335
    style AlreadyVerified fill:#FCE8E6,stroke:#EA4335
    style GPSNotReady fill:#FCE8E6,stroke:#EA4335
```

> Security-sensitive rejections (mocked GPS, shadowbanned) surface the generic copy "Unable to verify your location. Please try again." — never a specific reason that reveals detection.

---

## Report Flow

```mermaid
flowchart TD
    TapReport[/Tap Report in action row auth required/]
    Authd{Authenticated?}
    Modal[Auth Required Modal]
    SignIn[Sign-In]
    Step1[Report Step 1: Permanently Closed / Access Denied Currently Locked / Code is Wrong / Dirty or Unsafe / Duplicate Location]
    SelectType[/Select report type/]
    Step2[Report Step 2: Confirm Report this as type? This helps keep data accurate. Submit Report button + Cancel]
    TapSubmit[/Tap Submit Report/]
    RPC[report_location RPC]
    Toast[Toast: Report submitted. Thanks for helping]
    SheetReturn([Bottom sheet returns])
    TapCancel[/Tap Cancel/]
    SheetReturnCancel([Bottom sheet returns])

    TapReport --> Authd
    Authd -->|No| Modal
    Modal --> SignIn
    SignIn --> Step1
    Authd -->|Yes| Step1
    Step1 --> SelectType
    SelectType --> Step2
    Step2 --> TapSubmit
    TapSubmit --> RPC
    RPC --> Toast
    Toast --> SheetReturn
    Step2 --> TapCancel
    TapCancel --> SheetReturnCancel

    style SheetReturn fill:#E6F4EA,stroke:#34A853
    style SheetReturnCancel fill:#E6F4EA,stroke:#34A853
```

**Report type DB mapping (for Phase 7 implementation):**

| User Label | DB value (reports.report_type) |
|---|---|
| Permanently Closed | permanently_closed |
| Access Denied / Currently Locked | currently_locked |
| Code is Wrong | inaccurate_information |
| Dirty or Unsafe | dirty_unsafe |
| Duplicate Location | duplicate_location ⚠ NOT in live CHECK constraint — Phase 7 must add via migration |

> **Schema dependency (RC-02):** The live `reports.report_type` CHECK constraint does NOT include 'duplicate_location'. Phase 7's `report_location` RPC will hit a DB constraint violation unless this migration runs first: add 'duplicate_location' to the CHECK array in `reports`.

---

## Rating Flow

```mermaid
flowchart TD
    TapRate[/Tap Rate in action row auth required/]
    Authd{Authenticated?}
    Modal[Auth Required Modal]
    SignIn[Sign-In]
    RatingScreen[Rating Screen: 4 emoji dimensions Cleanliness, Accessibility, Convenience, Changing Surface Cleanliness conditional has_changing_table only]
    SelectEmoji[/Select emoji for each dimension/]
    TapSubmit[/Tap Submit Rating/]
    RPC[Rating RPC]
    Result{Result}
    Toast[Toast: Rating saved. Thanks!]
    SheetReturn([Bottom sheet returns])
    InlineErr[Inline: Could not save rating. Try again]

    TapRate --> Authd
    Authd -->|No| Modal
    Modal --> SignIn
    SignIn --> RatingScreen
    Authd -->|Yes| RatingScreen
    RatingScreen --> SelectEmoji
    SelectEmoji --> TapSubmit
    TapSubmit --> RPC
    RPC --> Result
    Result -->|Success| Toast
    Toast --> SheetReturn
    Result -->|Error| InlineErr
    InlineErr --> RatingScreen

    style SheetReturn fill:#E6F4EA,stroke:#34A853
    style InlineErr fill:#FCE8E6,stroke:#EA4335
```

> `has_changing_table` is derived from the `tags` table, not a `locations` column. The Changing Surface Cleanliness dimension only renders when `tags.find(t => t.key === 'has_changing_table')?.value === 'true'`.

---

## Offline State Flow

```mermaid
flowchart TD
    Map[Map Screen]
    NetCheck{Network available?}
    Banner[Top banner: No connection amber background]
    CachedPins[Cached pins remain visible]
    TapPin{User taps pin?}
    Sheet[Bottom Sheet: cached content or Unable to load details]
    Restored{Network restored?}
    Resume([Banner dismisses, normal operation resumes])

    Map --> NetCheck
    NetCheck -->|No| Banner
    Banner --> CachedPins
    CachedPins --> TapPin
    TapPin -->|Yes| Sheet
    Sheet --> Restored
    TapPin -->|No| Restored
    Restored -->|Yes| Resume

    style Banner fill:#FCE8E6,stroke:#EA4335
    style Resume fill:#E6F4EA,stroke:#34A853
```

---

## No-Location (GPS Denied) State Flow

```mermaid
flowchart TD
    MapCity[Map Screen City View]
    SearchActive[Search bar active by default]
    TypeCity[/User types city or address/]
    Autocomplete[Google Places autocomplete, debounced 300ms]
    SelectResult[/Select result/]
    Recenter[Map re-centers, search_locations_bbox RPC for new viewport]
    MapPins([Map Screen: pins shown for searched area])

    MapCity --> SearchActive
    SearchActive --> TypeCity
    TypeCity --> Autocomplete
    Autocomplete --> SelectResult
    SelectResult --> Recenter
    Recenter --> MapPins

    style MapPins fill:#E6F4EA,stroke:#34A853
```

---

## No-Results State Flow

```mermaid
flowchart TD
    Map[Map Screen]
    ZeroResults[search_locations_bbox returns 0 results]
    Empty[Empty state: No bathrooms found nearby]
    SearchBtn[Search this area button visible]
    TapSearch[/Tap Search this area/]
    Refetch[New bbox RPC fetch]
    Results{Results?}
    MapPins([Map Screen with pins])
    EmptyRemains([Empty state remains])

    Map --> ZeroResults
    ZeroResults --> Empty
    Empty --> SearchBtn
    SearchBtn --> TapSearch
    TapSearch --> Refetch
    Refetch --> Results
    Results -->|Yes| MapPins
    Results -->|No| EmptyRemains

    style ZeroResults fill:#FCE8E6,stroke:#EA4335
    style MapPins fill:#E6F4EA,stroke:#34A853
    style EmptyRemains fill:#E6F4EA,stroke:#34A853
```

---
## Notes for Implementors
- Screen node names in these diagrams are the canonical names. Wireframes in `docs/design/wireframes.md` use the same names.
- All Mermaid blocks require a Mermaid-compatible viewer (GitHub.com renders these natively).
- "Auth Required Modal" in flows maps to the inline slide-up sheet (not full navigation).
- Suppressed locations appear absent from results — no flow node for suppression (transparent to user per security rules).
