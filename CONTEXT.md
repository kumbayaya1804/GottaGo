# Gotta Go — Domain Language & Glossary

This file defines the vocabulary used throughout this project. It exists so that:
- **Yaël** can look up any term that comes up during development
- **AI agents** start every session with shared, precise language

When a new concept is introduced during development, add it here.

---

## What We're Building

**Gotta Go** is a crowdsourced bathroom finder for people with real urgency — IBS, Crohn's, colitis, wheelchair users needing accessible stalls, parents with infants. It is not a restaurant review app with a bathroom section. It is infrastructure for human dignity.

The app helps users find a bathroom *right now*, contributes their experience back to the community, and earns trust over time for doing so accurately.

---

## App Concepts

### Location
A single bathroom or "chill spot" in the database. Locations are not just addresses — they carry confidence, respect signals, decay state, and access metadata. The database table is called `locations`.

### Chill Spot
A location that welcomes walk-ins: hotel lobbies, bars, university buildings, libraries, coffee shops. These are the backbone of the app — places that technically have a bathroom policy but in practice don't enforce it for respectful visitors.

### Policy Tag
A label on a location that describes its access type. Examples: `public`, `purchase_required`, `ask_staff`, `chill_spot`. Tells the user what to expect before they walk in.

### Access Sensitivity
How sensitive or risky it is to use a location's bathroom. A location with an access code that the community shares is more sensitive than a public park restroom.

### Access Instructions
Optional step-by-step notes on how to actually get to the bathroom. Examples: "Take the elevator to floor 2, turn left," or "Ask the barista for the code — they always give it."

### Emergency Mode
A filter state the user activates when they need a bathroom *right now*. Three variants:
- **General** — any nearby bathroom
- **Changing Table** — must have a changing table
- **Wheelchair Accessible** — must meet accessibility requirements

### Family Mode
A user setting that filters results to locations appropriate for children. Removes locations where adult or sensitive context might apply.

---

## Trust & Verification

### GPS Verification
When a user confirms a bathroom is open/accessible *while physically present at that location*. The app checks their GPS coordinates against the location coordinates. If they're within a defined radius (e.g., 50 meters), their verification counts. This is the most valuable action a user can take.

A verification logged in the database is called a **verification event** (table: `verification_events`).

### Trust Score
A number that represents how reliable a user's contributions are. Every user starts with a baseline trust score. It goes up when the community validates their contributions, and goes down when they submit bad data. The score is stored in the `users` table.

### Trust Multiplier
A scaling factor on top of the trust score. Used to amplify or dampen the weight of a user's actions. A trusted power contributor might have a multiplier > 1.0; a user flagged for bad behavior might have < 1.0.

### Trust Weight
When a user submits a report or verification, that action is not treated equally to everyone else's. It is multiplied by their trust score × trust multiplier. A highly trusted user's "closed" report matters more than a brand-new user's same report.

### Trust Event
A record of every time a user's trust score changed, and why. Stored in `trust_events`. Useful for auditing and debugging trust calculations. Think of it as a transaction log for trust.

---

## Confidence

### Confidence Score
A number (0–100) representing how reliable a location's current information is. A location verified yesterday by five trusted users has high confidence. A location no one has checked in six months has low confidence.

### Confidence Tier
A categorical label derived from the confidence score: `high`, `medium`, `low`, `unknown`. Shown to users as a signal of how much to trust the information.

### Confidence Decay
Over time, a location's confidence score automatically decreases if no one verifies it. A bathroom that was perfect a year ago might have changed hours, closed permanently, or added a lock. Decay reflects that information expires.

### Verification Count
How many GPS-verified check-ins a location has received. More verifications → higher confidence, slower decay.

### Last Verified At
The timestamp of the most recent GPS verification. Used to calculate how much the confidence has decayed since then.

---

## Respect & Reporting

### Respect Signal
An event that indicates the community is using a location respectfully (or not). Examples: a user confirms "no issues," a user notes "staff was friendly," a user flags "staff asked us to leave." Each signal has a weight.

### Respect Signal Score
A rolling aggregate of all weighted respect signals for a location. High score = community treats this place well. Low score = incidents happening, location may stop tolerating walk-ins.

### Respect Signal (90-day window)
Only the last 90 days of signals count toward the score. This prevents a good reputation from masking recent problems. This calculation is stored as a **materialized view** called `respect_signal_90d` (see Technical Terms).

### Report
A user submission flagging something about a location: it's closed, the bathroom is out of order, the code has changed, the staff became hostile. Reports are weighted by the reporter's trust score and how close they were when they reported. Stored in `reports`.

### Failure Event
A system-level record of something going wrong with a location — e.g., repeated reports of "closed" from trusted users, or a pattern that triggers automatic confidence downgrade. Stored in `failure_events`.

### Availability Flag
A short-lived flag that marks a temporary state: "out of order," "line too long," "closed early." These expire automatically (stored with an `expires_at` timestamp) so they don't permanently affect a location's record. Stored in `availability_flags`.

### Shadowban (User)
A user who has been shadowbanned still appears to be using the app normally, but their contributions are silently ignored — they don't affect confidence scores, trust events, or reports. Used to neutralize bad actors without triggering confrontation.

### Shadowban (Location)
A location that has been shadowbanned is hidden from search results for regular users. Used when a business has asked to be removed, or a location has been flagged as unsafe.

---

## Gamification

### Gamification Points
Points awarded to users for verified, high-quality contributions: GPS verifications, accepted submissions, helpful reports. Stored in `users.gamification_points`.

### Leaderboard Position
A user's rank in the community based on their gamification points. Stored in `users.leaderboard_position`.

### GPS Verified Contribution Count
The number of contributions a user made while physically present (GPS-verified). A separate count from total contributions because these are the most trusted actions.

---

## Technical Terms (Plain Language)

### Supabase
The backend platform the app uses. Think of it as the app's brain and memory — it stores all the data (locations, users, verifications, etc.) and handles user login. It runs in the cloud; we connect to it from the mobile app.

### Database
Where all the app's data lives. Organized into **tables** (like spreadsheets), each with **rows** (individual records) and **columns** (specific fields like `name`, `address`, `trust_score`).

### Schema
The complete blueprint of the database — all the tables, their columns, and the rules about what data goes in each column. Think of it as the architectural drawings for the data.

### Migration
A versioned, scripted change to the database schema. Instead of clicking around in a database editor, we write a migration file that describes the change (e.g., "add a `family_mode` column to the `users` table"). Migrations are applied in order and tracked so the database can always be reproduced exactly.

### PostGIS
An extension added to our database that lets it understand geographic coordinates (latitude/longitude). Without it, the database just stores numbers. With it, the database can answer questions like "find all locations within 200 meters of this GPS coordinate." Our `locations` table stores coordinates using PostGIS.

### Geometry
The PostGIS data type used to store a location's GPS coordinates. Stored as a single column called `coordinates` in the `locations` table. More flexible than storing raw lat/lon numbers separately.

### RLS (Row Level Security)
A database feature that controls who can read or write each row of data. Example: a user should be able to read any location, but only write their own trust events. RLS enforces these rules at the database level — even if the app has a bug, the database won't leak the wrong data.

### Materialized View
A pre-computed result that the database saves like a table. Instead of re-calculating the 90-day respect signal total every time someone asks for it, the database does the heavy math once and stores the answer. It gets refreshed periodically. Our `respect_signal_90d` is a materialized view.

### Expo / React Native
The framework used to build the mobile app. React Native lets us write one codebase in JavaScript/TypeScript that runs on both iOS and Android. Expo is a toolset built on top of React Native that handles a lot of the complex setup.

### EAS (Expo Application Services)
Expo's cloud build and deployment system. When it's time to create an actual app file (`.ipa` for iPhone, `.apk` for Android) and submit it to the App Store or Google Play, EAS does the heavy lifting.

### TypeScript
The programming language used to write the app. It's JavaScript (the most common web/app language) with types added — meaning the code can catch errors before the app even runs, by checking that data is the right shape.

### API (Application Programming Interface)
How two pieces of software talk to each other. When the app needs data (e.g., "give me all locations near this GPS coordinate"), it sends a request to Supabase's API. Supabase processes it and sends back the answer. Every network call the app makes goes through an API.

### Environment Variables / Secrets
Configuration values that should never be hardcoded into the app's source code — things like API keys, passwords, and database URLs. They're stored separately (in `.env.local` files locally, in EAS Secrets for production) and injected at build time.

### JSONB
A column type in the database that stores flexible, nested data in JSON format. Our `hours` column on locations is JSONB — because hours can vary by day, holiday, or season in ways that don't fit neatly into fixed columns.

### GPS Consent
Before the app uses a user's GPS location, it must ask permission and record that the user agreed. Our `users` table stores `gps_consent` (true/false) and `gps_consent_at` (when they agreed). This is required by privacy law (GDPR in Europe, similar laws elsewhere).

### GDPR
General Data Protection Regulation — European privacy law that governs how apps collect and store personal data, especially location data. Our GPS consent fields exist specifically to comply with this.

### Row Level Security → see RLS

### App Config
A database table (`app_config`) that stores runtime configuration as key-value pairs. Example: the radius (in meters) within which a GPS verification counts. Storing this in the database means we can change it without redeploying the app.

---

## Agent Roles

| Agent | Role |
|-------|------|
| Claude (primary) | Writing and implementing code via GSD workflow |
| Gemini CLI | Code review — correctness, logic, architecture |
| Codex App | Code review — quality, security, style |

---

*Last updated: 2026-06-21*
