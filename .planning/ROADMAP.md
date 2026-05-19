# Roadmap: Gotta Go

## Overview

Gotta Go is built in strict architectural dependency order: database foundation first, then the read path that renders the map, then mutations (GPS submission and verification), then the trust engine that publishes locations, then decay/aggregates, then reports/moderation inputs, then client UX polish, and finally operations hardening before launch. Each phase delivers a vertically testable slice that builds on the last. Client UX is intentionally last — a pretty map screen with no real data or trust engine is worthless.

## Milestone

**v1.0 MVP — Eugene, OR seed launch**

Goal: 50+ locations in Eugene with GPS-verified data, parent/accessibility filters, emergency mode, and a trust engine that prevents abuse. iOS + Android via EAS Build.

## Phases

**Phase Numbering:**
- Integer phases (1–9): Milestone v1.0 work in dependency order
- Decimal phases: Urgent insertions if needed

- [x] **Phase 1: Foundation & Scaffold** — DB config + extensions verified, Expo app runs, Supabase connection established, TypeScript types generated
- [ ] **Phase 2: Auth & Profiles** — Email/password + Google OAuth, SessionProvider, profile auto-creation, protected routes
- [ ] **Phase 3: Read Path & Map** — search_locations_bbox + search_locations_nearby RPCs, MapScreen renders real locations, emergency mode reads
- [ ] **Phase 4: GPS Service & Submission** — GpsService hook, submit_location SECURITY DEFINER RPC, SubmitFlow screen, pending-state lifecycle
- [ ] **Phase 5: Trust Engine & Verification** — verify_location RPC, trigger chain, confidence recalc, publish-on-N-verifications gate, VerifyFlow screen
- [ ] **Phase 6: Decay, Aggregates & Flags** — confidence decay scheduled job (floor enforced), respect_signal_log triggers, respect_signal_90d concurrent refresh, availability_flags RPC
- [ ] **Phase 7: Reports & Moderation Inputs** — report_location RPC, auto-suppress trigger, admin SECURITY DEFINER functions for shadowban/suppress
- [ ] **Phase 8: Client UX & Emergency Modes** — Emergency Mode one-tap, "Changing Table NOW" mode, rating UI, LocationDetail polish, all error/empty/offline states
- [ ] **Phase 9: Operations & Hardening** — Sentry with PII scrubbing, RLS pgTAP tests, migration test suite, EAS production build config, App Store / Play Store submission prep

## Phase Details

### Phase 1: Foundation & Scaffold
**Goal**: Supabase schema applied and verified, app_config table seeded, PostGIS spatial index confirmed, Expo dev client builds and connects to Supabase, TypeScript types generated from live schema
**Depends on**: Nothing (bootstrap)
**Requirements**: Tech Stack constraint, Data Integrity constraint, Security constraint
**Success Criteria** (what must be TRUE):
  1. `supabase db reset` applies all 8 migrations cleanly with no errors
  2. PostGIS GIST index exists on `bathroom_locations.location`
  3. `app_config` table exists and is seeded with tunable thresholds
  4. RLS is enabled on all 6 core tables (confirmed via `supabase db lint`)
  5. Expo dev client builds with Mapbox + Supabase composing (no crash on launch)
  6. `src/lib/database.types.ts` generated from live schema and committed
**Plans**: TBD

Note: Supabase migrations (phases 000001–000008) and Expo scaffold with full dependency stack were bootstrapped outside GSD. Remaining work: app_config table, spatial index verification, RLS lint, TypeScript type generation, and EAS dev client build smoke test.

Plans:
- [ ] 01-01: app_config table, spatial index verification, RLS lint
- [ ] 01-02: Supabase client setup (src/lib/supabase.ts), TypeScript types, EAS dev client build verification

---

### Phase 2: Auth & Profiles
**Goal**: Users can sign up, sign in, and have a profile created automatically. Auth session persists across app restarts. Protected routes redirect unauthenticated users to sign-in.
**Depends on**: Phase 1
**Requirements**: User can sign up with email/password; User can sign up/log in with Google OAuth; User can sign up/log in with Apple Sign-In (stub until Apple Developer enrolled); User session persists across app restarts
**Success Criteria** (what must be TRUE):
  1. User can create an account with email/password and sees a profile screen
  2. User can sign in with Google OAuth via deep link (Android + iOS simulator)
  3. Profile row is auto-created in `profiles` table on signup (trigger confirmed)
  4. Unauthenticated users are redirected to sign-in from any protected tab
  5. Session persists after app restart (AsyncStorage-backed Supabase auth)
  6. Apple Sign-In route exists but shows "coming soon" until Apple Developer enrolled
**Plans**: TBD

Plans:
- [ ] 02-01: Supabase auth wiring (SessionProvider, onAuthStateChange), sign-in/sign-up screens, protected route layout
- [ ] 02-02: Google OAuth deep link flow, profile auto-create trigger verification, Apple Sign-In stub

---

### Phase 3: Read Path & Map
**Goal**: The map renders real bathroom locations fetched from Supabase via PostGIS RPCs. Public search excludes deleted/shadowbanned/suppressed records. Emergency mode reads nearest location.
**Depends on**: Phase 2 (auth required for location details and future mutations)
**Requirements**: User can view a map of bathrooms near their current GPS location; User can search for bathrooms in any city/area; User can filter by Chill Spot/wheelchair accessible/changing table/cleanliness/currently open; "Emergency Mode" one-tap nearest available bathroom; User can tap a listing to see full details
**Success Criteria** (what must be TRUE):
  1. MapScreen renders Mapbox map with bathroom location pins from `search_locations_bbox` RPC
  2. RPC returns only published, non-deleted, non-shadowbanned, non-suppressed locations
  3. `search_locations_nearby` returns nearest location ordered by distance (meters, not degrees)
  4. LocationDetail modal shows name, policy tag, confidence score, last verified
  5. Denied-location and no-results states handled gracefully in the UI
  6. Shadowbanned/deleted test fixtures confirmed absent from search results
**Plans**: TBD

Plans:
- [ ] 03-01: search_locations_bbox + search_locations_nearby + get_location_detail RPCs (SECURITY DEFINER, shadowban/delete/suppress filters baked in)
- [ ] 03-02: MapScreen with Mapbox MapView, bbox viewport hook, supercluster clustering, pin tap → LocationDetail modal
- [ ] 03-03: Filter state (Zustand), denied-location and empty-state UI

---

### Phase 4: GPS Service & Submission
**Goal**: Users physically present at a bathroom can submit it. GPS sample is validated server-side. Submitted locations enter pending state awaiting verification.
**Depends on**: Phase 3
**Requirements**: User can submit a new bathroom location with name, address, policy tag, access type, hours; Submitted locations enter a pending state until 2 independent GPS verifications; GPS accuracy, freshness, and mock detection enforced
**Success Criteria** (what must be TRUE):
  1. GpsService hook returns `{coord, accuracy, mocked, timestamp}` with high-accuracy mode
  2. Mocked locations are rejected at the RPC layer (not just client-side)
  3. `submit_location` RPC inserts a pending row and fires creator-initial verification event
  4. GPS accuracy > 50m and stale fixes (>60s) are rejected server-side with a generic error
  5. SubmitFlow form validates with Zod, handles all error states (denied permission, low accuracy, failed write)
  6. Newly submitted location appears on map in pending state visible only to submitter
**Plans**: TBD

Plans:
- [ ] 04-01: GpsService hook, GPS validation PL/pgSQL function (reusable across submit + verify), submit_location SECURITY DEFINER RPC
- [ ] 04-02: SubmitFlow screen (RHF + Zod), all error/loading states, pending-location feedback

---

### Phase 5: Trust Engine & Verification
**Goal**: A second independent user can GPS-verify a location, triggering the trust engine. Two non-shadowbanned verifications publish the location. Trust score and confidence score update incrementally.
**Depends on**: Phase 4
**Requirements**: User can GPS-verify a location by being physically within range; Verification weight scaled by user trust score + proximity; Location publishes after 2 independent GPS verifications OR 1 + 48-hour no-flag window; Location confidence degrades over time (decay system set up here, job in Phase 6)
**Success Criteria** (what must be TRUE):
  1. `verify_location` RPC validates GPS triple server-side and inserts a verification event
  2. `weighted_value` computed correctly as `trust_multiplier × proximity_decay × accuracy_decay`
  3. Location status transitions pending → published after 2 distinct non-shadowbanned verifiers
  4. Shadowbanned user's verification is accepted (no hint given) but produces `weighted_value = 0` and does NOT trigger publish
  5. `profiles.trust_score` increments correctly via `trust_events` append pattern
  6. VerifyFlow screen handles accepted/rejected/denied-permission states without leaking rejection reason
  7. 48-hour auto-promote job logic exists (Edge Function or pg_cron stub) even if not yet scheduled
**Plans**: TBD

Plans:
- [ ] 05-01: verify_location RPC + AFTER INSERT trigger chain (recalc_confidence, trust_events, publish gate), compute_weighted_value function
- [ ] 05-02: VerifyFlow screen, "I'm here" button, accepted/rejected/loading states

---

### Phase 6: Decay, Aggregates & Availability Flags
**Goal**: Published locations decay in confidence over time (with a floor). The 90-day respect signal is refreshed on schedule. Users can post expiring availability flags.
**Depends on**: Phase 5
**Requirements**: Location confidence degrades over time without fresh verifications; respect_signal_90d materialized view maintained; User can submit a specific report (code wrong, closed); Locations with multiple inaccuracy reports suppressed pending re-verification
**Success Criteria** (what must be TRUE):
  1. Confidence decay function applies `score × exp(-ln(2) × days / half_life)` with floor at `app_config.confidence_floor`
  2. No location reaches confidence 0 — floor is enforced, hiding requires `suppressed_at`
  3. `respect_signal_90d` refreshes CONCURRENTLY without blocking reads (unique index present)
  4. `flag_location` RPC inserts availability_flags with `expires_at` enforced in public reads
  5. Expired flags do not appear in search results or location detail
  6. Decay job is scheduled (pg_cron or Edge Function) and documented in app_config
**Plans**: TBD

Plans:
- [ ] 06-01: Confidence decay PL/pgSQL function + scheduled job, confidence floor, respect_signal_log triggers, respect_signal_90d concurrent refresh job
- [ ] 06-02: flag_location + availability_flags RPC, expiry enforcement in read RPCs

---

### Phase 7: Reports & Moderation Inputs
**Goal**: Users can report problems. High-volume reports auto-suppress locations. Admins (via Supabase Studio in v1) can shadowban users/locations and resolve reports.
**Depends on**: Phase 6
**Requirements**: User can report bathroom no longer exists/access denied/incorrect hours/unsafe content/duplicate; Locations with multiple inaccuracy reports suppressed; Moderation decisions enforced below UI layer
**Success Criteria** (what must be TRUE):
  1. `report_location` RPC inserts a report with reporter identity never returned in public reads
  2. Auto-suppress trigger fires when same-type reports exceed `app_config.report_suppress_threshold`
  3. Admin SECURITY DEFINER functions exist for shadowban_user, shadowban_location, unsuppress_location
  4. Shadowbanned user's existing contributions are excluded from public aggregates immediately
  5. Report UI in app handles all report types with confirmation and error states
**Plans**: TBD

Plans:
- [ ] 07-01: report_location RPC, auto-suppress trigger, admin SECURITY DEFINER moderation functions
- [ ] 07-02: Report UI in LocationDetail, all report type flows, confirmation states

---

### Phase 8: Client UX & Emergency Modes
**Goal**: The app feels fast, intuitive, and purpose-built for urgency. Emergency modes work with one tap. Ratings are collectable. All error, empty, and offline states are handled.
**Depends on**: Phase 5 (trust engine live), Phase 6 (flags/decay live)
**Requirements**: "Emergency Mode" one-tap; "Changing Table NOW" emergency mode; "Accessible NOW" emergency mode; User can rate cleanliness/accessibility/convenience; Separate changing surface cleanliness dimension; Access codes (PINs) visible only to signed-in users; Filter by policy tag/wheelchair/changing table/cleanliness/currently open
**Success Criteria** (what must be TRUE):
  1. Emergency Mode routes user to nearest published location within 2 taps from any screen
  2. "Changing Table NOW" filter returns nearest confirmed changing-table location
  3. Rating submission persists to DB and updates location detail without full reload
  4. Access codes only visible in LocationDetail when user is signed in AND location has code policy tag
  5. All filter combinations return correct results (spot-tested for empty states)
  6. Denied-location, offline, slow-network, and no-results states all show appropriate non-generic UI
**Plans**: TBD

Plans:
- [ ] 08-01: Emergency Mode + "Changing Table NOW" + "Accessible NOW" one-tap flows
- [ ] 08-02: Rating UI (cleanliness, accessibility, convenience + changing surface dimension), access code display gate
- [ ] 08-03: Filter system polish, all error/empty/offline states, UX pass

---

### Phase 9: Operations & Hardening
**Goal**: The app is production-safe: Sentry captures crashes without PII, RLS policies are pgTAP-tested, EAS production builds are configured for both platforms, and App Store / Play Store submission is prepared.
**Depends on**: Phase 8
**Requirements**: No PII in logs; Apple Developer enrollment (blocking for iOS release); Security and data integrity verified end-to-end
**Success Criteria** (what must be TRUE):
  1. Sentry `beforeSend` strips lat, lng, email, user_id before any event is sent
  2. pgTAP test suite covers: RLS select/insert/update policies for all 6 tables, shadowban exclusion, soft-delete exclusion, expired flag exclusion
  3. EAS `production` build profile configured for iOS + Android
  4. App Store metadata, screenshots, privacy policy URL (Termly), and age rating complete
  5. Play Store metadata and content rating complete
  6. Apple Sign-In fully implemented (requires Apple Developer enrollment — BLOCKER for iOS release)
**Plans**: TBD

Plans:
- [ ] 09-01: Sentry integration with PII scrubbing middleware, telemetry events (no raw coords or user IDs)
- [ ] 09-02: pgTAP RLS test suite, migration smoke tests
- [ ] 09-03: EAS production build config, App Store + Play Store submission prep

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Scaffold | 0/2 | In progress | - |
| 2. Auth & Profiles | 0/2 | Not started | - |
| 3. Read Path & Map | 0/3 | Not started | - |
| 4. GPS Service & Submission | 0/2 | Not started | - |
| 5. Trust Engine & Verification | 0/2 | Not started | - |
| 6. Decay, Aggregates & Flags | 0/2 | Not started | - |
| 7. Reports & Moderation Inputs | 0/2 | Not started | - |
| 8. Client UX & Emergency Modes | 0/3 | Not started | - |
| 9. Operations & Hardening | 0/3 | Not started | - |
