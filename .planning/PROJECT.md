# Gotta Go

## What This Is

Gotta Go is a crowdsourced mobile app that helps people find usable bathrooms when they urgently need one. Unlike static directories, it collects time-sensitive bathroom access codes (PINs), community-verified policy tags, quality ratings, and optimal timing windows — the kind of hyperlocal knowledge that exists only in people's heads. The parent segment is the primary acquisition wedge: parents with toddlers face bathroom urgency as a genuine crisis, and changing table data is a high-signal differentiator nobody else is collecting systematically.

## Core Value

When you urgently need a bathroom, Gotta Go finds you one with accurate, community-verified access info — including the current door code.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Map & Discovery**
- [ ] User can view a map of bathrooms near their current GPS location
- [ ] User can search for bathrooms in any city/area
- [ ] User can filter by: access type, changing table, cleanliness rating, currently open
- [ ] User can tap a listing to see full details (code, hours, ratings, policy tag, timing tips)
- [ ] "Emergency Mode" — one-tap nearest available bathroom with current GPS
- [ ] "Changing Table NOW" emergency mode — one-tap nearest confirmed changing station

**Submissions**
- [ ] User can submit a new bathroom location with: name, address, policy tag, access type, hours
- [ ] User can submit/update the bathroom access code (PIN) for a location
- [ ] User can add timing tips ("avoid 12–1pm lunch rush")
- [ ] Submitted locations enter a pending state until 2 independent GPS verifications

**GPS Verification**
- [ ] User can GPS-verify a location by being physically within range (records lat/lon + distance)
- [ ] Verification weight is scaled by user trust score + proximity
- [ ] Location publishes after 2 independent GPS verifications OR 1 verification + 48-hour no-flag window
- [ ] Location confidence degrades over time without fresh verifications (decay system)

**Ratings & Quality**
- [ ] User can rate a location: cleanliness, accessibility, convenience (1–5)
- [ ] Separate changing surface cleanliness dimension (parents segment)
- [ ] User can submit a specific report (code wrong, closed, inaccessible)
- [ ] Locations with multiple inaccuracy reports are suppressed pending re-verification

**Authentication**
- [ ] User can sign up with email/password
- [ ] User can sign up / log in with Google OAuth
- [ ] User session persists across app restarts

**Policy Tags**
- [ ] Each location has a policy tag: Free, Purchase Required, Code Required, Community-Reported Accessible
- [ ] "Chill Spot" is community-reported language (not declarative, avoids liability) — users report perceived accessibility, not guaranteed policy
- [ ] Family Restroom tag (single-occupancy, lockable)

**Trust System (backend, v1)**
- [ ] Trust score tracked per user (affects verification weight)
- [ ] Trust events logged for all actions
- [ ] Shadowban support for bad actors (locations and users)
- [ ] Gamification points tracked in DB but NOT surfaced in v1 UI

### Out of Scope (v1)

- Leaderboard / gamification UI — tracked in DB, surfaced in v2 when volume justifies rewards
- Business partnership / verified badge program — needs user volume for leverage first
- Las Vegas market seeding — Eugene, OR first to validate model, then expand
- Web / PWA version — mobile-first, native GPS UX justified React Native
- Anonymous (no-auth) submissions — reduces abuse surface area for v1
- Monetization UI — validate the product first
- Post-use donation flow — trust formation + proven retention must come first; donor prompt before habit is established breaks urgency UX. Circle back after consistent usage + repeat behavior proven. (Partners identified: Lava Mae, Shower Power, The Laundry Truck LA — direct deep-link model, no fund custody.)
- In-app hygiene service scheduling (showers, laundry) — partnership layer, not v1; needs usage data to justify
- "Hygiene Access Gaps" data reports for cities/nonprofits — v2+ once usage data exists

## Context

**Origin:** App was conceived because of the real frustration of finding bathroom codes (PINs) in fast food restaurants and retail — information that exists only locally and degrades over time. The code expiration mechanic is the Waze parallel: data degrades without community contribution, which creates organic contribution pressure.

**Schema:** Full Supabase schema recovered after a computer theft. The database is live and intact — no schema design work needed, only implementation. Tables: `locations`, `users`, `verification_events`, `trust_events`, `respect_signal_log`, `respect_signal_90d` (materialized view), `confidence_scores`, `availability_flags`, `failure_events`, `reports`, `ratings`, `submissions`, `tags`, `app_config`.

**Existing scaffolding:** The project already has: `SPEC.md` (product spec), `docs/schema-contract.md`, `docs/review-severity.md`, `docs/verification.md`, `docs/SYSTEM_MAP.md`, `AGENTS.md` (full multi-agent review workflow), `GEMINI.md`, `CODEX.md`. One git commit exists with this scaffolding.

**Launch strategy:** Eugene, OR as the seed market. Target 50 high-quality verified locations before public launch — prioritize: 5–8 Chill Spots (hotel lobbies, university buildings), 3–4 with changing stations, full downtown/food corridor coverage. Quality over density. Las Vegas is phase 2: tourist density, international visitors, severe lack of public bathroom infrastructure outside casinos.

**Parent segment:** Changing table data is the feature that drives word-of-mouth in parenting communities (Facebook groups, Reddit parenting subs, Buy Nothing networks). "Changing Table NOW" emergency mode is the single-feature driver for this segment.

**Multi-agent workflow:** Claude (primary coder via GSD + TDD), Gemini CLI (correctness/logic/architecture/PostGIS), Codex app (quality/security/style/test coverage). Review workflow: Claude implements → logs files to `.claude/review-queue.txt` → Gemini + Codex review → address all BLOCK/REQUEST CHANGES → commit with reviewer verdicts. Claude does not self-approve.

**TDD:** `tdd-guard` is installed (package.json). Red → Green → Refactor enforced for all non-trivial behavior. Tests must cover security-sensitive and data-integrity behavior, not only rendering or happy paths.

## Constraints

- **Tech Stack**: Expo (React Native) — iOS + Android, GPS-first UX. Supabase + PostGIS for DB/auth. Mapbox for mapping. Already committed to from prior design work.
- **Data Integrity**: Minimum 2 independent GPS verifications (or 1 + 48hr no-flag window) before location publishes. Single-verification threshold is an unacceptable abuse surface.
- **Liability**: Policy tags use community-reported framing, not declarative. "Users report this as accessible" not "this place allows free use." Moves liability to crowd, not platform.
- **Gamification ordering**: If reward tiers are implemented, "Just used this" freshness confirmation must be lowest-reward or capped per location/user/window — not 3rd highest as in original design.
- **Eugene density requirement**: 50 locations is the floor, but coverage type matters more than count.
- **Security**: No raw SQL strings unless migrations or safely parameterized server-only code. GPS coordinates in PostGIS geometry/geography columns only. No PII in logs.
- **Review gate**: No commit without APPROVE from both Gemini and Codex (or all BLOCK/REQUEST CHANGES resolved).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native (Expo) over PWA | GPS verification and emergency mode require native performance; mobile is the use-case trigger | — Pending |
| Supabase + PostGIS | Schema already live, proximity queries built in, auth included | — Pending |
| Mapbox over Google Maps | Better offline tiles, better React Native SDK | — Pending |
| Eugene → Las Vegas launch sequence | Validate dense urban model before tourist-corridor model | — Pending |
| Gamification in DB from day one, UI in v2 | Track data now; don't surface rewards until volume justifies them | — Pending |
| 2-verification publish threshold | 1 verification is too easy to abuse with GPS spoofing | — Pending |
| Parent segment as primary acquisition wedge | Higher emotional stakes, stronger community sharing, changing table data is unique | — Pending |
| Multi-agent review (Claude + Gemini + Codex) | No self-approval; PostGIS correctness audited by Gemini; security/privacy audited by Codex | — Pending |
| TDD enforced via tdd-guard | Red → Green → Refactor for all non-trivial behavior; tests must cover integrity/security paths | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-18 after initialization*
