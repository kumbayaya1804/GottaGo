# Gotta Go

Gotta Go is a venture under the [Watch the Gap](../docs/watch-the-gap.md) human-infrastructure studio.

## What This Is

Gotta Go is a crowdsourced mobile app that helps people find usable bathrooms when they urgently need one — specifically people for whom urgency is not an inconvenience but a real need: people with IBS, Crohn's, colitis, or other bowel conditions; people who need wheelchair-accessible stalls; parents with infants who need changing tables. Unlike static directories, it maps community-reported "chill spots" (bars, hotel lobbies, university buildings, businesses that welcome walk-ins), accessibility ratings, and optimal timing windows. Access codes (PINs) for code-locked bathrooms are an optional layer — gated to logged-in users and only applied to locations where community consensus suggests the business is tolerant of the listing.

## Core Value

The real product is not just restroom locations, but **certainty under urgency**. When you urgently need a bathroom, Gotta Go finds you one with accurate, community-verified access info — including the current door code.


## Watch the Gap Fit

- **Gap:** Public restroom access is unreliable, hidden, stigmatized, or uncertain.
- **Population:** Parents, road-trippers, delivery drivers, people with medical conditions, disabled people, menstruating people, people with urgency needs, and anyone navigating public space under bodily pressure.
- **Proof of concept:** Make the app available globally, then use marketing, promotion, owned social media, partnerships, and community campaigns to drive local density and validate urgent discovery, changing-table, and accessibility flows.
- **One-sentence explanation:** Gotta Go turns unreliable public restroom access into community-verified infrastructure for certainty under urgency.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Map & Discovery**
- [ ] User can view a map of bathrooms near their current GPS location
- [ ] User can search for bathrooms in any city/area (manual city/address search available when GPS permission is denied — no dead-end state)
- [ ] User can filter by: Chill Spot, wheelchair accessible, changing table, cleanliness rating, currently open
- [ ] User can tap a listing to see full details (hours, ratings, policy tag, accessibility features, timing tips)
- [ ] "Emergency Mode" — one-tap nearest available bathroom with current GPS
- [ ] "Changing Table NOW" emergency mode — one-tap nearest confirmed changing station
- [ ] "Accessible NOW" emergency mode — one-tap nearest wheelchair-accessible confirmed bathroom
- [ ] Access codes (PINs) visible only to signed-in users; only shown for listings where community policy tag allows it
- [ ] User with `family_mode` enabled does not see locations flagged `access_sensitivity` = sensitive, enforced at the RPC layer (Phase 3)
- [ ] User can save/favorite a location and view a "My Favorites" list (Phase 8)

**Submissions**
- [ ] User can submit a new bathroom location with: name, address, policy tag, access type, hours
- [ ] User can submit/update the bathroom access code (PIN) for a location
- [ ] User can add timing tips ("avoid 12–1pm lunch rush")
- [ ] User sets an `access_sensitivity` value at submission, community-correctable the same way `policy_tag` is (Phase 4)
- [ ] Submitted locations enter a pending state until 2 independent GPS verifications

**GPS Verification**
- [ ] User can GPS-verify a location by being physically within range (records lat/lon + distance)
- [ ] Verification weight is scaled by user trust score + proximity
- [ ] Location publishes after 2 independent GPS verifications OR 1 verification + 48-hour no-flag window
- [ ] Location confidence degrades over time without fresh verifications (decay system)
- [ ] Push notification when a user's own submission is published ("your contribution was verified") — reward-loop only, no proximity/marketing notifications (Phase 5)

**Ratings & Quality**
- [ ] User can rate a location: cleanliness, accessibility, convenience (1–5)
- [ ] Separate changing surface cleanliness dimension (parents segment)
- [ ] User can submit a specific report (code wrong, closed, inaccessible)
- [ ] User can report another user's content as abusive/objectionable (`report_user`), independent of reporting a location — feeds the existing shadowban_user admin function; no self-service block UI, no new author attribution (Phase 7; closes Apple 1.2 / Play UGC requirement)
- [ ] Push notification when a user's own report leads to a location fix ("your reported location was fixed") — reward-loop only (Phase 7)
- [ ] Locations with multiple inaccuracy reports are suppressed pending re-verification

**Authentication**
- [ ] User can sign up with email/password
- [ ] User can sign up / log in with Google OAuth (Android-only until Apple Developer enrolled; iOS shows Apple Sign-In stub)
- [ ] User can sign up / log in with Apple Sign-In (required by App Store guideline 4.8 when Google OAuth is offered on iOS)
- [ ] User session persists across app restarts
- [ ] User can delete their account and revoke any linked social credentials from within the app (required by Apple guideline 5.1.1)

**Settings**
- [ ] Privacy policy link (Termly URL)
- [ ] Terms of Service link (Termly URL)
- [ ] Account deletion flow
- [ ] Sign out
- [ ] Location permission explanation with OS settings deep link

**Policy Tags & Accessibility**
- [ ] Each location has a policy tag: Chill Spot, Purchase Required, Code Required, Public Facility
- [ ] "Chill Spot" = community-reported walk-in welcome (bars, hotel lobbies, libraries, universities, businesses that don't mind). Not a guaranteed policy — community-reported framing, not declarative.
- [ ] Accessibility tags: Wheelchair Accessible, Baby Changing Table, Family Restroom (single-occupancy/lockable), Changing Surface Cleanliness rating
- [ ] Access codes (PINs) are an optional field, only visible to signed-in users, only relevant for Code Required locations where community indicates the listing is tolerated

**Trust System (backend, v1)**
- [ ] Trust score tracked per user (affects verification weight)
- [ ] Trust events logged for all actions
- [ ] Shadowban support for bad actors (locations and users)
- [ ] Gamification points tracked in DB but NOT surfaced in v1 UI
- [ ] Profile screen shows a private, non-comparative personal impact stat derived from the user's GPS-verified contribution count (e.g., "Your contributions have helped confirm N bathrooms are ready for someone who needs one") — no ranking, no leaderboard, no fabricated "people helped" figure (Phase 5)

### Out of Scope (v1)

- Comparative/competitive gamification UI — leaderboards, points display, badges, rankings against other users. Tracked in DB, surfaced in v2 when volume justifies rewards. (A private, non-comparative personal impact stat is in v1 scope — see Trust System above; the deferral is specifically about comparison/competition, not all reflection of a user's own contributions.)
- Business partnership / verified badge program — needs user volume for leverage first
- Single-city launch gating — v1 should not hardcode availability to one city; targeted campaigns can build density in priority regions without blocking global use
- Web / PWA version — mobile-first, native GPS UX justified React Native
- Anonymous (no-auth) submissions — reduces abuse surface area for v1
- Monetization UI — validate the product first
- Post-use donation flow — trust formation + proven retention must come first; donor prompt before habit is established breaks urgency UX. Circle back after consistent usage + repeat behavior proven. (Partners identified: Lava Mae, Shower Power, The Laundry Truck LA — direct deep-link model, no fund custody.)
- In-app hygiene service scheduling (showers, laundry) — partnership layer, not v1; needs usage data to justify
- "Hygiene Access Gaps" data reports for cities/nonprofits — v2+ once usage data exists

## Context

**Origin:** App was conceived because of the real frustration of finding bathroom codes (PINs) in fast food restaurants and retail — information that exists only locally and degrades over time. The code expiration mechanic is the Waze parallel: data degrades without community contribution, which creates organic contribution pressure.

**Legal:** Termly privacy policy and terms of service already created. The app must link to these in onboarding and settings. GPS consent is already a first-class field in the `users` table (`gps_consent`, `gps_consent_at`) — GDPR-ready from the schema.

**Schema:** Full Supabase schema recovered after a computer theft. The database is live and intact — no schema design work needed, only implementation. Tables: `locations`, `users`, `verification_events`, `trust_events`, `respect_signal_log`, `respect_signal_90d` (materialized view), `confidence_scores`, `availability_flags`, `failure_events`, `reports`, `ratings`, `submissions`, `tags`, `app_config`.

**Existing scaffolding:** The project already has: `SPEC.md` (product spec), `docs/schema-contract.md`, `docs/review-severity.md`, `docs/verification.md`, `docs/SYSTEM_MAP.md`, `docs/watch-the-gap.md`, `AGENTS.md` (full multi-agent review workflow), `ANTIGRAVITY.md`, `CODEX.md`. One git commit exists with this scaffolding.

**Target users (refined):** People for whom urgency is a real need, not just inconvenience: (1) people with IBS, Crohn's, colitis, or other bowel/GI conditions, (2) wheelchair users and mobility-impaired people needing accessible stalls, (3) parents with infants needing changing tables. General urgency users are also served, but the accessibility-focused users are the ones who will contribute data most reliably and share most organically.

**Launch strategy:** Global proof-of-concept availability. Usage and local density should come from marketing, promotion, owned social media handles, partnerships, creator/community outreach, and targeted seeding campaigns. Priority regions can receive extra sourcing and verification effort, but the app should not hardcode a launch city or refuse users outside a chosen market. Quality still matters more than raw count: promoted regions should prioritize Chill Spots, confirmed changing stations, and accessible bathroom coverage.

**Parent segment:** Changing table data is the feature that drives word-of-mouth in parenting communities (Facebook groups, Reddit parenting subs, Buy Nothing networks). "Changing Table NOW" emergency mode is the single-feature driver for this segment.

**Multi-agent workflow:** Claude (primary coder via GSD + TDD), Antigravity CLI (correctness/logic/architecture/PostGIS), Codex app (quality/security/style/test coverage). Review workflow: Claude implements → logs files to `.claude/review-queue.txt` → Antigravity + Codex review → address all BLOCK/REQUEST CHANGES → commit with reviewer verdicts. Claude does not self-approve.

**TDD:** `tdd-guard` is installed (package.json). Red → Green → Refactor enforced for all non-trivial behavior. Tests must cover security-sensitive and data-integrity behavior, not only rendering or happy paths.

## Blockers

- [ ] **Apple Developer Program enrollment** — $99/year, required before: Apple Sign-In can be configured, TestFlight beta testing, App Store submission. Enroll at developer.apple.com/programs. Everything can be built and tested on Android/simulator without it, but iOS release is blocked until enrolled.

## Constraints

- **Tech Stack**: Expo SDK 55 (React Native 0.83 + React 19.2, New Architecture mandatory). Supabase JS v2.58+ for DB/auth. `@rnmapbox/maps` ^10.1.x for map rendering (react-native-maps Google provider broken on SDK 55 iOS). Google Maps API key retained for geocoding/Places REST calls. TanStack Query v5 + Zustand 5 for state. MSW v2 for TDD-compatible API mocking.
- **Data Integrity**: Minimum 2 independent GPS verifications (or 1 + 48hr no-flag window) before location publishes. Single-verification threshold is an unacceptable abuse surface.
- **Liability**: Policy tags use community-reported framing, not declarative. "Users report this as accessible" not "this place allows free use." Moves liability to crowd, not platform.
- **Gamification ordering**: If reward tiers are implemented, "Just used this" freshness confirmation must be lowest-reward or capped per location/user/window — not 3rd highest as in original design.
- **Coverage density requirement**: local usefulness matters more than raw global count. Marketing and community seeding should build useful clusters in promoted regions, but no city is hardcoded as the launch gate.
- **Security**: No raw SQL strings unless migrations or safely parameterized server-only code. GPS coordinates in PostGIS geometry/geography columns only. No PII in logs.
- **Review gate**: No commit without APPROVE from both Antigravity and Codex (or all BLOCK/REQUEST CHANGES resolved).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native (Expo) over PWA | GPS verification and emergency mode require native performance; mobile is the use-case trigger | — Pending |
| Supabase + PostGIS | Schema already live, proximity queries built in, auth included | — Pending |
| Mapbox for map rendering (not react-native-maps) | react-native-maps Google provider is broken on Expo SDK 55 iOS (expo/expo#43288). Google Maps API key still usable for geocoding/Places REST calls. | — Pending |
| Global proof-of-concept availability | Crowdsourced apps should be usable wherever contributors appear; marketing, promotion, and owned social channels drive adoption and local density instead of a hardcoded city rollout | — Pending |
| Gamification in DB from day one, UI in v2 | Track data now; don't surface rewards until volume justifies them | — Pending |
| 2-verification publish threshold | 1 verification is too easy to abuse with GPS spoofing | — Pending |
| Accessibility-focused users as primary segment | IBS/Crohn's, wheelchair users, and parents have the highest urgency and will contribute + share most organically | — Pending |
| Access codes (PINs) gated to signed-in users only | Businesses may not want codes publicly indexed; community-reported tolerance is the signal, not blanket exposure | — Pending |
| Chill Spots as the primary map category | Walk-in welcoming places (bars, hotel lobbies, libraries) are the most valuable, safest to list, and most community-shareable | — Pending |
| Multi-agent review (Claude + Antigravity + Codex) | No self-approval; PostGIS correctness audited by Antigravity; security/privacy audited by Codex | — Pending |
| `family_mode`/`access_sensitivity` filtering added to Phase 3/4 | 2026-07-01 App Store audit found both columns already live in schema and already promised as RPC-layer-enforced by Phase 1.5's UI spec, but no phase implemented the filter — closing an existing, unimplemented requirement rather than adding new scope | — Pending |
| Report/block-user via anonymous `report_user` RPC + existing `shadowban_user`, no self-service block UI | Timing tips currently carry no visible author attribution; adding a "block" button would require adding new identity exposure. Satisfies Apple Guideline 1.2 / Play UGC through report + moderator action instead | — Pending |
| Save/favorite locations added to Phase 8 | Own research (FEATURES.md) flagged this as a high-value, low-cost retention lever for the parent segment that had never been triaged into a phase | — Pending |
| Two reward-loop push notifications added ("contribution verified" in Phase 5, "report fixed" in Phase 7) | Narrow, non-spammy scope from FEATURES.md research; explicitly excludes proximity/marketing notifications, which remain out of scope | — Pending |
| Personal impact stat added to Phase 5, narrowing the gamification-UI deferral | Users should feel their contributions genuinely helped someone. A fabricated "people helped" number would be dishonest (no analytics track downstream reach) — real GPS-verified contribution count, framed around urgency-under-stakes, is honest and resonant without it. This is a private, non-comparative reflection, not the comparative/competitive gamification (leaderboards, points, rankings) that stays deferred to v2 | — Pending |
| TDD enforced via tdd-guard | Red → Green → Refactor for all non-trivial behavior; tests must cover integrity/security paths | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
0. Run `/stale-info-scan`; resolve or explicitly defer findings that affect the next phase
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Run `/stale-info-scan`; resolve or explicitly defer findings before closing
2. Full review of all sections
3. Core Value check — still the right priority?
4. Audit Out of Scope — reasons still valid?
5. Update Context with current state

**Monthly while active:**
1. Run `/stale-info-scan`
2. Refresh `.planning/stale-info-scan-latest.md`
3. Fix or explicitly defer BLOCKING STALE INFO and UPDATE REQUIRED findings

---
*Last updated: 2026-05-18 after initialization*
