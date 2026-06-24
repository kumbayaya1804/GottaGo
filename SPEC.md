# Gotta Go Product Spec

Status: provisional project contract. This document captures the intended product and safety rules before implementation exists. Update it when actual product decisions change.

## Product Summary

Gotta Go is a crowdsourced bathroom finder built under the [Watch the Gap](docs/watch-the-gap.md) human-infrastructure studio. The product focuses on providing **certainty under urgency** while protecting contributor privacy and resisting abuse.

Public restroom access is treated like a minor inconvenience until urgency turns it into humiliation. Gotta Go treats that gap as missing human infrastructure: a basic access problem that can be made visible, verified, and navigable.

The product must balance:
- Fast discovery for users who urgently need a bathroom
- Accurate location data
- Privacy around exact user movement and identity
- Abuse resistance against fake locations, spam, harassment, and manipulation
- Respectful handling of businesses, public facilities, and community-maintained information

## Primary Users

- Person searching for a nearby bathroom
- Contributor adding or verifying bathroom information while physically present
- Trusted contributor whose history increases influence on confidence signals
- Moderator or admin handling abuse, reports, and suppression

## Core User Flows

### Find A Bathroom

Users should be able to:
- Grant or deny location permission
- Search near their current location or a selected area
- View nearby bathrooms ranked by distance, confidence, availability, and respect signal
- See enough information to decide quickly without exposing private contributor data
- Handle offline, denied-location, and no-results states

Search results must exclude:
- Deleted locations
- Shadowbanned locations
- Locations suppressed by moderation
- Expired temporary availability claims
- Records blocked by RLS or visibility rules

### Add A Bathroom

Contributors should be able to add a bathroom only when required validation passes.

Required concepts:
- Physical presence check when GPS verification is required
- Server-side validation of submitted location data
- PostGIS-backed location storage
- Abuse and spam controls
- Clear error states for denied location permission, low GPS accuracy, stale GPS reading, duplicate location, and failed write

### Verify A Bathroom

Verification should capture whether a location still exists and whether relevant attributes are current.

Verification must consider:
- GPS freshness
- GPS accuracy
- Distance from claimed location
- Contributor trust
- Shadowban status
- Duplicate or suspicious patterns

### Report A Problem

Users should be able to report:
- Bathroom no longer exists
- Access denied or restricted
- Incorrect hours or availability
- Unsafe, inappropriate, or spam content
- Duplicate location

Reports should feed moderation and confidence calculations without revealing reporter identity publicly.

### Moderation

Moderators or automated systems may:
- Shadowban users
- Shadowban or suppress locations
- Soft delete records
- Resolve reports
- Review suspicious contribution patterns

Moderation decisions must be enforced below the UI layer.

## Core Data Concepts

Expected entities:
- `users`: public-safe user profile metadata and trust state (live table name — not `profiles`)
- `locations`: canonical bathroom records with PostGIS coordinates column (live table name — not `bathroom_locations`)
- `location_attributes`: amenities, access type, hours, cleanliness/accessibility facts, or equivalent normalized structure
- `verification_events`: GPS-verified checks by users
- `availability_flags`: temporary or expiring availability/access signals
- `reports`: abuse, duplicate, closure, and correction reports
- `trust_events`: audit trail for trust changes
- `respect_signal_90d`: materialized view or derived aggregate for recent quality/respect signal

Actual table names may change, but the responsibilities must remain explicit and reviewable.

## Privacy Requirements

The system must not expose or log:
- Email addresses in client-visible contexts
- Precise contributor coordinates outside approved storage and minimal map behavior
- Raw user IDs in client logs, analytics, or public UI
- Auth tokens, refresh tokens, or service-role credentials
- Hidden moderation status to unauthorized users

Contributor identity should not be publicly linked to sensitive location behavior unless the product explicitly decides otherwise and updates this spec.

## GPS Verification Requirements

GPS verification should use:
- Fresh readings
- Accuracy thresholds
- Radius checks against the location
- Server-side validation or database-backed verification rules where practical
- Rejection or downgrade of stale, inaccurate, mocked, or implausible submissions

The client may collect GPS data, but the client must not be the final authority for trust, proximity, shadowban eligibility, or moderation-sensitive decisions.

## Trust And Confidence

Trust/reputation should affect influence, not direct access to bypass rules.

Trust logic must handle:
- New users
- Zero trust scores
- Negative or penalized users
- Shadowbanned users
- Stale contributors
- Deleted users or profiles
- Conflicting verification events

Confidence should decay when a location has not been freshly verified. Decay math must be deterministic, testable, and documented before production use.

## Shadowban Requirements

Shadowbanning is an abuse-control mechanism for users and locations.

Rules:
- Shadowbanned users must not influence public trust, confidence, leaderboards, or visible contribution counts
- Shadowbanned locations must not appear in public search results
- Shadowban filtering must happen at query/database/service boundaries (e.g., via Antigravity-audited RLS), not only in UI rendering
- Hidden status must not leak to shadowbanned users through obvious error differences unless intentionally designed

## Gamification Requirements

Gamification may include:
- Points
- Leaderboards
- GPS-verified contribution count
- Badges or streaks

Gamification must not reward spam, unsafe behavior, fake verification, precise-location leakage, or bypassing moderation. Leaderboards must exclude shadowbanned users and deleted/suppressed contributions.

## Non-Goals For Early Implementation

Until explicitly added, do not assume:
- Real-time chat
- Public contributor profiles tied to exact bathroom visits
- Payment processing
- Social graph features
- Admin actions exposed to normal clients
- Permanent storage of every raw GPS sample

## Open Product Decisions

These must be resolved before production:
- Exact GPS radius and accuracy thresholds
- Whether anonymous contribution is allowed
- What bathroom attributes are MVP versus later
- Moderator tooling surface
- Confidence decay formula
- Trust score formula and caps
- Respect signal formula
- Retention policy for sensitive location-related data
