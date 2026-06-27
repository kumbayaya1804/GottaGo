# Feature Landscape: Crowdsourced Location Finder Apps

**Domain:** Crowdsourced bathroom finder (mobile)
**Project:** Gotta Go
**Researched:** 2026-05-18
**Confidence:** HIGH for table-stakes / anti-features (multi-source convergence); MEDIUM for parent-segment specifics (smaller competitive sample)

---

## Synthesis: What Users Actually Punish

App-store and Reddit reviews of every comparable app (Flush, SitOrSquat, Refuge Restrooms, Toilet Finder, GoHere, Diaper Changing Table Finder) converge on **two complaint clusters**:

1. **"Pins aren't real / data is stale"** — the location either doesn't exist, is permanently closed, is in the wrong spot, or the listed attributes are wrong. This is the dominant 1-star complaint. ([Flush reviews](https://justuseapp.com/en/app/955254528/flush-toilet-finder-map/reviews), [Toilet Finder reviews](https://justuseapp.com/en/app/311896604/toilet-finder/reviews))
2. **"I can't fix it / report it"** — users see something wrong and the app gives no clean path to flag it. Flush specifically is faulted for letting you rate but not update.

Translation for Gotta Go: **freshness + a frictionless "this is wrong" loop are the product**, not nice-to-haves. The Waze parallel is exact — Waze's "Not there / Still there" tap is the entire reason their crowdsourced data does not rot. ([Waze road closure verification](https://support.google.com/waze/answer/13753511))

---

## TABLE STAKES

Features users **expect**. Missing one of these makes the app feel broken on first use. These match the v1 scope already in PROJECT.md — no surprises here, but the complexity and dependency notes matter for sequencing.

### Discovery & Map

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Map view of nearby locations with pins | Universal pattern across every finder app | Low | Mapbox + PostGIS proximity query | Locate-me button bottom-right is the convention ([Map UI Patterns](https://mapuipatterns.com/locate-me/)) |
| List view toggle (map ↔ list, sorted by distance) | SitOrSquat, Flush, GoHere all have this; list view wins in low-vision / glare conditions | Low | Same proximity query | "Map UI" pattern: list and map share state |
| "Locate me / Near me" button | Convention — target icon, bottom thumb zone | Low | Geolocation permission | Must handle denied-permission state with city-search fallback |
| Distance + walk-time on each result | Every comparable app does this; users decide on "can I make it?" not address | Low | Mapbox directions or haversine | Walk-time, not just meters — meters mean nothing under urgency |
| Detail screen with: address, hours, access type, code, ratings | All bathroom apps have a detail card; Flush is criticized for missing data, not for having the card | Low | `locations` + `location_attributes` | The code (PIN) is Gotta Go's unique data point — must be prominent, not buried |
| Tap-to-navigate (hand-off to Maps/Apple Maps) | Every finder app does this — Flush opens Google Maps, GoHere similar | Low | Deep link / URL scheme | Do **not** build in-app turn-by-turn — that's an anti-feature (see below) |
| Search by city/address (not just GPS) | Required by spec; also needed for "tomorrow I'm in Portland" use case | Low | Mapbox Geocoding API | Spec already calls this out |

### Submission & Verification

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Add a new location while physically present | Core contribution loop | Medium | GPS accuracy + freshness checks, server validation | SPEC.md already mandates server-side validation, PostGIS storage, dup detection |
| GPS-verify an existing location | The integrity primitive of the whole product | Medium | `verification_events`, trust score, distance check | Spec already mandates 2 independent verifications OR 1 + 48hr no-flag |
| Report a problem on a location ("code wrong", "closed", "inaccessible") | The single most-requested missing feature in competitor reviews. Flush is repeatedly faulted for missing this | Low-Med | `reports` table + moderation backend | This **is** the moat. Without it, the app degrades into Flush. |
| Pending state for new submissions until verified | Spec already mandates this; matches Waze new-place workflow | Medium | Verification threshold logic | UI must make pending state visible to submitter ("waiting for 1 more verification") for retention |
| GPS accuracy + freshness threshold rejection | Stops trivially-spoofed contributions; spec mandates | Medium | Sensor data + server validation | Surface as "your GPS isn't accurate enough — move closer / step outside" not generic error |

### Trust & Quality Signals

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Star or numeric ratings per location | SitOrSquat (sit/squat), Flush, Refuge, GoHere all rate | Low | `ratings` table | Spec calls for cleanliness / accessibility / convenience; separate changing-surface dimension is the parent differentiator |
| Last-verified timestamp visible to user | Direct counter to "is this still there?" anxiety | Low | `verification_events` last-event aggregation | Display as "Verified 3 days ago" — human-relative, not raw timestamp. Critical freshness signal. |
| Confidence indicator (visible) | Implicit in spec's confidence decay; users need to see decay to trust the system | Low | `confidence_scores` | Color-coded pin or badge: green=fresh, yellow=aging, gray=stale. Mirrors Waze fading reports. |
| Photo on listing (optional) | SitOrSquat allows photos; users use them to identify the right door | Medium | Image upload + storage + moderation | Photos are abuse surface — moderate before publish or use community-flagging. Could defer to v1.5 if scope-tight. |

### Account & Session

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Sign up + log in (email/password) | Required to attribute trust to a user; spec excludes anonymous in v1 | Low | Supabase Auth | |
| Google OAuth | Friction-cutter; users abandon at email/password gates | Low | Supabase Auth provider config | Apple Sign-In is a **required** addition for iOS App Store submission if Google is offered ([Apple HIG](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple)). Add to spec — this is a known iOS reviewer-rejection trap. |
| Session persistence across launches | Universally expected | Low | Supabase refresh tokens | |
| Permission priming (location, notifications) | iOS/Android best practice — explain *before* the system prompt | Low | Native permission APIs | Bathroom apps suffer if users deny location once; priming dramatically increases grant rate |

### Resilience

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Graceful offline / denied-location state | Spec calls it out; 65%+ of apps now incorporate offline by default ([offline app trends 2025](https://lost-on-arrival.com/en/offline-functionality-en/)) | Medium | Cached last-known map tiles + recent results | True offline-first is harder than it looks. v1: "you're offline — here's the last 20 results" is enough. Full offline map is v2. |
| Clear empty / no-results state | Bathroom finders get zero-result regions constantly | Low | UI states | "No bathrooms within X miles — submit one?" is a contribution prompt opportunity |
| GPS-denied fallback (city/address search) | Required by spec | Low | Geocoding | |

---

## DIFFERENTIATORS

Features that set Gotta Go apart from Flush / SitOrSquat / Refuge / GoHere. **Pick few, do them well.** Each one is a marketing-able line.

### Tier 1: Core Differentiators (do these in v1 or near-v1)

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---|---|---|---|---|
| **Bathroom access codes (PINs)** | No competitor surfaces this. Codes are the highest-value, fastest-decaying datum. This is the product's reason to exist. | Medium | `locations`, `submissions`, decay timer on code freshness, abuse controls | Treat code as a **separate field with its own freshness clock** from the location itself. A location can be "verified" while its code is "stale." Show "code reported 4 days ago" alongside the code. |
| **Emergency Mode — one-tap nearest** | Standard pattern for emergency UX research ([UX for urgency](https://blessingokpala.substack.com/p/designing-for-urgency-what-911-emergency)); rare in bathroom apps | Medium | GPS, proximity query, deep-link to nav | Must skip the map. Big button → here's the closest one, tap-to-navigate. One screen, two taps max. |
| **"Changing Table NOW" emergency mode** | Single-feature wedge for the parent segment. No competitor has a dedicated emergency for this. | Medium | Same as Emergency Mode + filter on `has_changing_table=true AND verified_recent=true` | This is the acquisition story. The button label itself is the marketing copy. |
| **Confidence decay / freshness signal visible on pin** | Direct response to the #1 complaint cluster in competitor reviews; the Waze trust-builder | Medium | `confidence_scores`, decay function (must be deterministic, per spec) | Decay is what separates "crowdsourced" from "crowdsourced and rotting." Make decay legible to users via pin color or badge. |
| **Frictionless flag/report on every listing** | Competitors lose stars exactly here; Flush has rating-but-no-update | Low | `reports`, moderation queue | "Code wrong" / "Doesn't exist" / "Closed today" must be a one-tap action from the listing detail. ≤3 taps total. |
| **Separate changing-surface cleanliness rating** | Parents do not trust generic cleanliness; spec already calls this out | Low | `ratings` schema with dimensional fields | Specifically requested in BubbaMaps reviews. Differentiator within the differentiator. |
| **Timing tips** ("avoid 12–1pm lunch rush") | Hyperlocal lore no static directory captures | Low | `tags` or free-text field with moderation | One field, huge perceived value. Limit length, moderate for spam. |

### Tier 2: Strong Differentiators (post-v1)

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Family Restroom tag (single-occupancy, lockable) | Already in spec; parents + nonbinary users both benefit | Low | Just a tag; bundle with Refuge Restrooms-style data for free overlap |
| Men's-room-has-changing-table flag | RestMap and BubbaMaps highlight this; dad-segment trust win | Low | Schema field |
| Hours of operation with "Open now" filter | Table-stakes at maturity, differentiator at v1 because most bathroom apps get this wrong | Medium | Hours data + timezone math + user TZ |
| Stroller-accessible / wheelchair-accessible flag | Universal in family + accessibility apps | Low | Tag |
| Share-link / deep link to a specific listing | Standard mobile pattern ([deep linking](https://www.adjust.com/blog/dive-into-deeplinking/)); enables word-of-mouth in parenting groups | Medium | URL scheme + Universal Links / App Links + fallback web view |
| "Verified by [N] users in the last [period]" badge | Direct trust signal; Waze does the equivalent | Low | Aggregation of recent verifications |
| Save / favorite locations | Standard expectation that competitors miss; high retention lever for the parent segment ("my home base bathroom is at...") | Low | `user_favorites` table |
| Filter chips above map (Open Now / Changing Table / Free / Chill Spot) | Spec already includes this; chip pattern is the modern convention | Low | UI + query params |

### Tier 3: Speculative / Brand-Building (v2+)

| Feature | Value Proposition | Notes |
|---|---|---|
| "Just used this" freshness ping (no rating, no review) | One-tap freshness signal; cheaper than a full verification | Spec already flags this — and flags it as a gamification risk. Reward must be capped per location/user/window. |
| Push notification: "You're near a recently-flagged location. Can you re-verify?" | Convert proximity into contribution; the Waze "still there?" mechanic | High abuse-surface — only ping verified-trust users. |
| Code-share via image OCR ("snap the door code sign") | Acquisition wedge; reduces friction on the highest-value field | Privacy-fraught: must strip EXIF, never store the raw image |
| Public contributor profile (opt-in, no exact-location history) | Recognition without privacy leak — spec already calls out the privacy constraint | Hard to design without leaking visit patterns; defer until trust formula is fixed |
| Donation deep-links to partner orgs (Lava Mae, etc.) | Already in PROJECT.md as deferred | Spec correctly defers until habit + trust formed |

---

## ANTI-FEATURES

Features users may *ask* for that actively damage the product. Document these so they're explicitly out of scope.

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Public contributor leaderboard / point display in v1** | Premature gamification rewards spam; spec already defers this. Worse: surfacing a leaderboard before there is meaningful contributor density makes the app look empty. | Track points in DB (spec); surface in v2 when contributor volume justifies it. |
| **In-app turn-by-turn navigation** | Massive scope, redundant with Maps/Apple Maps, drains battery, distracts from the contribution loop | Deep-link out to the user's preferred nav app. Every comparable app does this. |
| **Open chat / DMs / social graph** | Spec explicitly excludes; harassment surface in a domain (bathrooms) where any social vector is suspect | Reports/flags are the only user-to-user signal. Period. |
| **"Suspicion" / "watch out" / safety-alert reports about people** | Citizen-app failure mode; produces racial profiling and false alarms ([EFF on crowd-sourced suspicion apps](https://www.eff.org/deeplinks/2021/10/crowd-sourced-suspicion-apps-are-out-control)) | Only report attributes of the *location* (closed, code wrong, inaccessible). Never about people who use it. |
| **Anonymous submissions (in v1)** | Spec already excludes; opens unbounded abuse surface | Require login. Revisit only after trust formula proven. |
| **Photos required on submission** | Raises submission friction massively; photos require moderation pipeline | Photos optional; defer photo upload to v1.5 if scope tight. |
| **Declarative policy tags ("This place allows free use")** | Liability transfer to platform; spec already mandates community-reported framing | "Users report as accessible" — phrasing matters and is in spec. |
| **Real-time location sharing with friends / "find my family"** | Conflates with stalker-app risk; not in our value prop | Out of scope. If users want this, they have Find My / Google. |
| **Star-rating-only with no review text** | Yelp's data shows ratings-only reviews are low-trust signal ([Yelp survey](https://blog.yelp.com/news/consumer-trust-survey-2024/)). Bathroom apps without text become "3.5 stars" noise. | Allow ratings, but encourage a short note. Don't *require* it (urgency UX) but prompt for one within 24 hours of a verification. |
| **Verified-business-badge / business onboarding flow in v1** | Spec already defers. Needs leverage you don't have at 0 users. | v2 after density. |
| **Push notification for new locations near user** | Notification fatigue + privacy concern; bathroom is a need-driven product, not a feed | If notifications at all, scope to: "your contribution was verified" and "your reported location was fixed." Both are reward loops, not interruption. |
| **In-app rewards/coins/badges UI in v1** | Spec defers this for a reason — gamification rewards spam if introduced before quality controls are battle-tested | Track in DB. Surface in v2 once `respect_signal_90d` proves out. |
| **AI-generated reviews / summaries** | Yelp filtered 500K AI reviews in 2024 — users explicitly distrust them ([Yelp 2025 T&S](https://blog.yelp.com/news/2025-trust-and-safety-report/)) | All text fields are human-only. If we summarize, label it clearly. |
| **One-click "verify without being there"** | Trivially abuseable; defeats the entire trust system | GPS-presence-required for verification, full stop. |
| **Comment threads on locations** | Becomes 4chan in 6 weeks for an urgency app. | Single review per user per location. No replies, no threading. |
| **Crowdsourced "is it safe" / neighborhood safety scores** | Distinct product (Safetipin), different ethical surface, distracts from bathroom focus | Out of scope. Use Family Restroom tag for the privacy-need signal instead. |

---

## FEATURE DEPENDENCY GRAPH

```
                            [Auth]
                              |
                              v
        +---------------------+---------------------+
        |                     |                     |
   [Add Location]      [Verify Location]     [View Map / List]
        |                     |                     |
        v                     v                     v
  [Pending state]   [Verification events]   [Proximity query]
        |                     |                     |
        +----------+----------+                     |
                   v                                |
            [Publish threshold]                     |
                   |                                |
                   v                                v
              [Live location] -----> [Confidence score / decay]
                                              |
                                              v
                                       [Pin color / freshness badge]
                                              |
        +-------------------------+-----------+
        |                         |
        v                         v
  [Detail screen]           [Emergency Mode]
        |                         |
        +-----------+-------------+
                    v
              [Report problem]   [Rate location]   [Tap-to-nav]
                    |                   |
                    v                   v
               [Moderation]       [Aggregate rating]
                    |
                    v
            [Suppress / re-verify]
```

**Critical path for v1:** Auth → Add → Verify → Publish threshold → View/Detail → Report. The freshness badge, decay, and Emergency Mode all depend on this spine being functional. The parent-segment wedge (Changing Table NOW) is an Emergency Mode variant — same machinery, different filter — so it costs ~1 extra screen, not a parallel feature stack.

---

## MVP RECOMMENDATION (v1 SCOPE)

**Ship these:**
1. Auth (email + Google + Apple Sign-In) and session persistence
2. Map + list view with locate-me, distance, walk-time
3. Detail screen with code, hours, access type, ratings, last-verified, confidence badge
4. Add location flow with GPS presence + accuracy + freshness checks
5. Verify-location action (one-tap from detail when within range)
6. 2-verification publish threshold (or 1 + 48hr no-flag) — spec rule
7. Report-problem flow (≤3 taps, predefined categories + free text)
8. Rate location (cleanliness + accessibility + convenience + changing surface)
9. **Emergency Mode** (nearest verified bathroom, one tap)
10. **Changing Table NOW** mode (nearest verified location with changing table)
11. Filter chips: Open Now / Changing Table / Free / Code Required / Chill Spot / Family Restroom
12. Search-by-city/address fallback for denied GPS
13. Tap-to-navigate hand-off (deep link to user's nav app)
14. Confidence decay (deterministic, surfaced as pin color + "Verified N days ago")
15. Shadowban + suppression enforcement at query layer (per SPEC.md)

**Defer to v1.5 / v2:**
- Photo upload (adds moderation pipeline)
- Save / favorites
- Share-link deep linking
- Gamification UI (DB tracking only in v1, per spec)
- Push notifications (any)
- Code-via-OCR
- "Just used this" lightweight verification
- Re-verification prompts via push

**Explicitly never:**
- See anti-features table above.

---

## PARENT-SEGMENT NOTES

The parent wedge is identified correctly in PROJECT.md. Additional evidence from research:

- BubbaMaps reviews specifically highlight "amenities, opening hours, and real parent reviews" as the trust trio — Gotta Go has 2 of 3 baked in, just needs the parent-review dimension explicit.
- RestMap and the Diaper Changing Table Finder both surface **"changing tables in men's rooms"** as a discrete data point. This is a small schema field with outsized social-sharing value (it's the kind of thing dads post about in r/daddit). Strongly recommend adding as a boolean attribute alongside `has_changing_table`.
- Parenting press has covered changing-table apps before — the press hook is "we surveyed where dads can change diapers." This is a viable PR angle once promoted regions have enough men's-room changing-table data points.
- The "Family Restroom" tag (single-occupancy, lockable) overlaps the LGBTQ+ safety need that Refuge Restrooms serves. Gotta Go doesn't have to position as an LGBTQ+ app to capture that benefit — the tag itself does double duty.

**Acquisition implication:** "Changing Table NOW" is the headline. Build it visibly. Put it on the home screen, not buried in a filter.

---

## CONFIDENCE ASSESSMENT

| Area | Confidence | Reason |
|---|---|---|
| Table-stakes feature list | HIGH | Multiple competitor apps + multiple review sources converge |
| Anti-features (review manipulation, suspicion-app risk, AI review distrust) | HIGH | EFF, Yelp T&S reports, academic SIGIR paper all align |
| Emergency Mode UX pattern | MEDIUM-HIGH | UX literature is clear on one-tap urgency design; bathroom-specific application is novel but the pattern is borrowed correctly |
| Freshness / decay legibility | HIGH | Waze pattern is well-documented and directly maps to Gotta Go's code-decay use case |
| Parent-segment feature priorities | MEDIUM | Sample of competitor apps is small (3–4); review data is thinner but consistent |
| Apple Sign-In requirement | HIGH | Apple HIG explicitly requires it when third-party social login is offered |
| Deep-link / share patterns | HIGH | Universal mobile pattern |

---

## SOURCES

### Competitor Apps Surveyed
- [Flush Toilet Finder & Map (App Store)](https://apps.apple.com/us/app/flush-toilet-finder-map/id955254528)
- [Flush — Google Play](https://play.google.com/store/apps/details?id=toilet.samruston.com.toilet)
- [SitOrSquat](https://appadvice.com/app/sitorsquat-restroom-finder/511855507) (Charmin / P&G)
- [Refuge Restrooms](https://www.refugerestrooms.org/about) and [Refuge Restrooms GitHub](https://github.com/RefugeRestrooms/refugerestrooms)
- [GoHere Washroom Locator](https://apps.apple.com/ca/app/gohere-washroom-locator/id1011069090) (Crohn's and Colitis Canada)
- [Diaper Changing Table Finder](https://apps.apple.com/us/app/diaper-changing-table-finder/id1482513361)
- [BubbaMaps](https://play.google.com/store/apps/details?id=com.bubbamaps.bubbamaps)
- [RestMap](https://restmap.io/family-restroom-finder)
- [Where2Go: Bathroom Ratings](https://apps.apple.com/us/app/where2go-bathroom-ratings/id1580780893)
- [Lulu: Bathroom & Toilet Finder](https://apps.apple.com/us/app/lulu-bathroom-toilet-finder/id1457238944)
- [Squat or Not - Toilet Finder](https://apps.apple.com/us/app/squat-or-not-toilet-finder/id1556153094)

### Review Aggregators (Failure Modes)
- [Flush Toilet Finder reviews (justuseapp)](https://justuseapp.com/en/app/955254528/flush-toilet-finder-map/reviews)
- [Toilet Finder reviews (justuseapp)](https://justuseapp.com/en/app/311896604/toilet-finder/reviews)
- [Public Restroom Finder Apps comparison (Whizz)](https://thewhizzapp.com/)
- [NAFC Best Bathroom Locator Apps](https://nafc.org/bhealth-blog/the-best-bathroom-locator-apps/)

### Crowdsourcing Patterns / Trust
- [Yelp 2025 Trust & Safety Report](https://blog.yelp.com/news/2025-trust-and-safety-report/)
- [Yelp Consumer Trust Survey 2024](https://blog.yelp.com/news/consumer-trust-survey-2024/)
- [Crowdsourced App Review Manipulation (SIGIR)](https://people.engr.tamu.edu/caverlee/pubs/li17sigir.pdf)
- [Establishing Trust in Crowdsourced Data (arXiv)](https://arxiv.org/pdf/2511.03016)
- [EFF — Crowd-Sourced Suspicion Apps Are Out of Control](https://www.eff.org/deeplinks/2021/10/crowd-sourced-suspicion-apps-are-out-control)

### Waze / Freshness Mechanics
- [Waze: Report road closures](https://support.google.com/waze/answer/13753511)
- [Waze: How to contribute to the map](https://support.google.com/waze/answer/6270175)
- [The magic of the Waze Community (Medium / Waze)](https://medium.com/waze/the-magic-of-the-waze-community-21c3ed2fd086)
- [A Review of Crowdsourcing Update Methods for HD Maps (MDPI)](https://www.mdpi.com/2220-9964/13/3/104)

### UX Patterns
- [Map UI Patterns — Location finder](https://mapuipatterns.com/location-finder/)
- [Map UI Patterns — Locate me](https://mapuipatterns.com/locate-me/)
- [Map UI Patterns — Spatial filter](https://mapuipatterns.com/spatial-filter/)
- [Sebastian Meier — Location Search UI Patterns on Mobile](https://www.sebastianmeier.eu/publications/a-comparison-of-location-search-ui-patterns-on-mobile-devices/)
- [Designing for Urgency — 911 emergency UX](https://blessingokpala.substack.com/p/designing-for-urgency-what-911-emergency)
- [UX Design for Crisis Situations (UXmatters)](https://www.uxmatters.com/mt/archives/2025/03/ux-design-for-crisis-situations-lessons-from-the-los-angeles-wildfires.php)

### GPS / Anti-Spoofing
- [Stop Geo-Spoofing — Approov](https://approov.io/blog/stop-geo-spoofing-with-secure-api-integration-for-mobile-application)
- [Guardsquare — Protect Against Geo-Spoofing](https://www.guardsquare.com/blog/securing-location-trust-to-prevent-geo-spoofing)
- [Spoofing, Proof of Location (New America)](https://www.newamerica.org/insights/accuracy-all/spoofing-proof-of-location-and-trusted-data/)
- [All in one: Improving GPS accuracy via crowdsourcing (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S1389128624006078)

### Offline & Mobile Standards
- [Offline Functionality in 2025 (Lost on Arrival)](https://lost-on-arrival.com/en/offline-functionality-en/)
- [Offline Mobile App Design (LeanCode)](https://leancode.co/blog/offline-mobile-app-design)
- [Mobile Deep Linking (Adjust)](https://www.adjust.com/blog/dive-into-deeplinking/)
