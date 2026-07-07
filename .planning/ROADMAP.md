# Roadmap: Gotta Go

## Overview

Gotta Go is built in strict architectural dependency order: database foundation first, then the read path that renders the map, then mutations (GPS submission and verification), then the trust engine that publishes locations, then decay/aggregates, then reports/moderation inputs, then client UX polish, and finally operations hardening before launch. Each phase delivers a vertically testable slice that builds on the last. Client UX is intentionally last — a pretty map screen with no real data or trust engine is worthless.

## Milestone

**v1.0 MVP — Global proof of concept**

Goal: globally available crowdsourced bathroom discovery with GPS-verified data, parent/accessibility filters, emergency mode, and a trust engine that prevents abuse. Adoption and local density come from marketing, promotion, owned social media handles, partnerships, and targeted community seeding rather than a hardcoded launch city. iOS + Android via EAS Build.

## Phases

**Phase Numbering:**

- Integer phases (1–9): Milestone v1.0 work in dependency order
- Decimal phases: Urgent insertions if needed

- [x] **Phase 1: Foundation & Scaffold** — DB config + extensions verified, Expo app runs, Supabase connection established, TypeScript types generated
- [x] **Phase 1.5: UX Foundation & Design System** — Design contract (flow maps, wireframes, design system, nav model, emergency UX rules, error-state matrix, component checklist) that all client-facing phases implement against
- [x] **Phase 2: Auth & Profiles** — Email/password + Google OAuth (Android-only until Apple Developer enrolled), SessionProvider, profile auto-creation, protected routes, account deletion, privacy/TOS links, GPS consent UX
- [x] **Phase 3: Read Path & Map** — search_locations_bbox + search_locations_nearby RPCs, MapScreen renders real locations, emergency mode reads (completed 2026-07-07)
- [ ] **Phase 4: GPS Service & Submission** — GpsService hook, submit_location SECURITY DEFINER RPC, SubmitFlow screen, pending-state lifecycle
- [ ] **Phase 5: Trust Engine & Verification** — verify_location RPC, trigger chain, confidence recalc, publish-on-N-verifications gate, VerifyFlow screen
- [ ] **Phase 6: Decay, Aggregates & Flags** — confidence decay scheduled job (floor enforced), respect_signal_log triggers, respect_signal_90d concurrent refresh, availability_flags RPC
- [ ] **Phase 7: Reports & Moderation Inputs** — report_location RPC (all 5 report types), auto-suppress trigger (sets locations.suppressed_at), admin SECURITY DEFINER functions for shadowban/suppress
- [ ] **Phase 7.5: Growth & Seed Operations** — Candidate sourcing, admin import tooling, field verification checklist, marketing/social launch support, and promoted-region coverage targets
- [ ] **Phase 8: Client UX & Emergency Modes** — Emergency Mode one-tap, "Changing Table NOW" mode, rating UI, LocationDetail polish, all error/empty/offline states
- [ ] **Phase 9: Operations & Hardening** — Sentry with PII scrubbing, RLS pgTAP tests, migration test suite, EAS production build config, App Store / Play Store submission prep

## Phase Details

### Phase 1: Foundation & Scaffold

**Goal**: Supabase schema applied and verified, app_config table seeded, PostGIS spatial index confirmed, Expo dev client builds and connects to Supabase, TypeScript types generated from live schema
**Depends on**: Nothing (bootstrap)
**Requirements**: Tech Stack constraint, Data Integrity constraint, Security constraint
**Success Criteria** (what must be TRUE):

  1. `supabase db reset` applies all 9 migrations cleanly with no errors
  2. PostGIS GIST index exists on `locations.coordinates`
  3. `app_config` table exists and is seeded with tunable thresholds
  4. RLS is enabled on all 6 core tables (confirmed via `supabase db lint`)
  5. Expo dev client builds with Mapbox + Supabase composing (no crash on launch)
  6. `src/lib/database.types.ts` generated from live schema and committed

**Plans**: 2 plans

Note: Supabase migrations (phases 000001–000008) and Expo scaffold with full dependency stack were bootstrapped outside GSD. Remaining work: app_config table, spatial index verification, RLS lint, TypeScript type generation, and EAS dev client build smoke test.

Plans:

- [x] 01-01-PLAN.md — seed.sql stub + app_config migration (D-01 thresholds) + supabase link + db push + RLS lint + GIST index verification + TypeScript type generation
- [x] 01-02-PLAN.md — jest.config fix + tsconfig paths + app.config.ts conversion + src/app/ scaffold + src/lib/supabase.ts + EAS dev client build smoke test

---

### Phase 1.5: UX Foundation & Design System

**Goal**: Produce a design contract (markdown spec + annotated wireframes) that all client-facing phases implement against. No Phase 2+ screen ships without matching this contract. Figma is not required — markdown spec + annotated wireframes is the source of truth.
**Depends on**: Phase 1
**Requirements**: Design contract covers all 13 critical flows; all v1 screens have wireframes; emergency mode reachable in ≤2 taps; all 11 named error states have defined copy and UI treatment; component acceptance checklist cited by Phase 2+ PLAN.md files
**Success Criteria** (what must be TRUE):

  1. Flow maps cover all 13 named flows (first launch, GPS consent, sign-in/sign-up, map discovery, emergency mode ×3, submit, verify, report, rating, offline, no-location, no-results) — no critical path ends without a defined next state
  2. All v1 screens have a named wireframe or annotated sketch (portrait-first)
  3. Design system doc exists: colors, typography, spacing, button hierarchy, icon rules, status states, form controls, map marker states, confidence/status badges, accessibility minimums
  4. Navigation model documented: unauthenticated routes, protected tabs, emergency access from every screen, modal back/escape behavior
  5. Emergency-use UX rules documented: one-handed reach targets, large primary actions, no dead-end states, denied-location fallback, ≤2 taps to nearest usable bathroom from any top-level route
  6. All 11 error states have defined copy and UI treatment (denied GPS, low accuracy, stale GPS, offline, slow network, no results, suppressed location, failed submit, failed verification, auth required, code-gated content)
  7. Accessibility rules documented: dynamic type tolerance, screen-reader labels for map/list controls, non-color-only status, touch target minimums, reduced-motion behavior
  8. Component acceptance checklist exists and is cited in Phase 2+ PLAN.md files before review

**Plans**: 2 plans

Plans:

- [x] 1.5-01: Critical flow maps + low-fi wireframes for all v1 screens and modal states
- [x] 1.5-02: Design system + navigation model + emergency-use UX rules + accessibility rules + error-state copy matrix + component acceptance checklist

---

### Phase 2: Auth & Profiles

**Goal**: Users can sign up, sign in, and have a profile created automatically. Auth session persists across app restarts. Protected routes redirect unauthenticated users to sign-in. Compliance requirements (account deletion, privacy/TOS links, GPS consent UX) land in this phase, not Phase 9.
**Depends on**: Phase 1.5
**Requirements**: User can sign up with email/password; User can sign up/log in with Google OAuth (Android-only until Apple Developer enrolled); Apple Sign-In stub shown on iOS in place of Google OAuth; User session persists across app restarts; User can delete their account; Privacy policy and ToS linked in onboarding; GPS consent captured before first GPS read
**Success Criteria** (what must be TRUE):

  1. User can create an account with email/password and sees a profile screen
  2. User can sign in with Google OAuth via deep link on Android — Google OAuth is limited to Android builds; iOS shows "Sign in with Apple — coming soon" placeholder that does NOT offer Google (Apple App Review guideline 4.8 compliance)
  3. User row is auto-created in `users` table on signup (trigger confirmed)
  4. Unauthenticated users are redirected to sign-in from any protected tab
  5. Session persists after app restart (AsyncStorage-backed Supabase auth)
  6. Apple Sign-In route exists but shows "coming soon" until Apple Developer enrolled
  7. User can delete their account from within the app — triggers profile removal and session revocation (required by Apple guideline 5.1.1)
  8. Onboarding screen links to Termly privacy policy URL and Terms of Service URL
  9. GPS consent prompt captures `users.gps_consent = true` and `users.gps_consent_at = now()` before any GPS read
  10. Settings screen stub exists with: sign out, privacy policy link, ToS link, account deletion entry point, location permission explanation with OS settings deep link
  11. All screens pass Phase 1.5 component acceptance checklist before Codex review

**Plans**: 3 plans

Plans:

- [x] 02-01a-PLAN.md — Wave 0 infrastructure: react-native-gesture-handler + babel config, Supabase config alignment, jest harness mocks, design token files (Colors/typography/spacing/radius/legal), and Wave 0 migrations (handle_new_user trigger, display_name unique index, check_display_name_available + set_gps_consent RPCs) + supabase db push
- [x] 02-01b-PLAN.md — Auth-logic modules (validation, redirect, SessionProvider, displayName, gpsConsent) at 100% coverage + root layout (SessionProvider + guard) + Welcome screen + navigation shell + auth forms (Sign-In/Sign-Up/Forgot-Password/Reset-Password/GPS-Consent) — depends_on: 02-01a
- [x] 02-02-PLAN.md — Nullable-FK migration + update_profile/delete_account RPCs, Google OAuth (Android-only) + Apple stub (iOS) + deep-link callback, Profile/Settings stub, Delete + Auth-Required modals, profile-trigger verification, onboarding privacy/ToS links — depends_on: 02-01b

---

### Phase 3: Read Path & Map

**Goal**: The map renders real bathroom locations fetched from Supabase via PostGIS RPCs. Public search excludes deleted/shadowbanned/suppressed records. Emergency mode reads nearest location.
**Depends on**: Phase 2 (auth required for location details and future mutations)
**Requirements**: User can view a map of bathrooms near their current GPS location; User can search for bathrooms in any city/area (manual search fallback for denied GPS); User can filter by Chill Spot/wheelchair accessible/changing table/cleanliness/currently open; "Emergency Mode" one-tap nearest available bathroom; User can tap a listing to see full details; User with `family_mode` enabled does not see locations flagged `access_sensitivity` = sensitive in any search result (RPC-layer enforcement per Phase 1.5 UI spec 02-UI-SPEC.md:903, not client-side); User can view bathrooms in a sorted list (Nearby tab) as an accessible alternative to the map (Phase 1.5 nav model, closes a 2026-07-04 discussion-discovered scheduling gap); User can enable `family_mode` from Settings (closes a 2026-07-04 discussion-discovered gap — the filter above had no UI to ever activate it)
**Success Criteria** (what must be TRUE):

  1. MapScreen renders Mapbox map with bathroom location pins from `search_locations_bbox` RPC
  2. RPC returns only published, non-deleted, non-shadowbanned, non-suppressed locations — filters: `shadowban_status = false AND deleted_at IS NULL AND suppressed_at IS NULL`
  3. RPC additionally excludes `access_sensitivity`-flagged-sensitive locations when the requesting user's `users.family_mode = true` — enforced in the RPC, not filtered client-side
  4. `search_locations_nearby` returns nearest location ordered by distance (meters, not degrees)
  5. LocationDetail modal shows name, policy tag, confidence score, last verified
  6. Denied location permission: map recenters and shows a manual search entry + "Search this area" (bbox re-query) instead of a GPS-centered view — no dead-end state. **Narrowed 2026-07-05 (D-34, cross-AI review):** no external geocoding/Google Places dependency in Phase 3 — the user pans/searches the current viewport rather than typing a city/address. Full city/address geocoding search is deferred to a future phase/plan.
  7. No-results state: named "No bathrooms found nearby" UI with "Search this area" button
  8. Shadowbanned/deleted/suppressed/family_mode-excluded test fixtures confirmed absent from the relevant search results
  9. Plan 03-01 includes a migration adding `locations.suppressed_at TIMESTAMPTZ` if the column does not already exist in the live schema, before RPCs reference it
  10. All screens pass Phase 1.5 component acceptance checklist before Codex review
  11. Nearby tab renders the same location set as a sorted-by-distance list, reusing 03-01's RPCs — accessible via native screen-reader semantics (no Mapbox canvas dependency)
  12. Settings screen has a `family_mode` toggle wired to an extended `update_profile` RPC; enabling it is independently verified to activate SC3's filter

**Plans**: 5

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — DB read path: search_locations_bbox/_nearby/get_location_detail SECURITY DEFINER RPCs (four-clause moderation + family_mode via auth.uid() + tag filters), suppressed_at column + index, max_pins_per_viewport config, update_profile family_mode extension, dev-only seed, db push + regenerated types + pgTAP [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Client data layer + test infra: features/locations hooks (bbox/detail/nearby/familyMode/formatDistance), Zustand filters store, MSW/fixtures, @gorhom/bottom-sheet + expo-localization installs (100% coverage, TDD) [wave 2, depends 03-01]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — MapScreen (Mapbox native-clustered pins, user dot, 400ms viewport refetch, zoom-out cutoff, RPC-failure banner) + LocationDetail bottom sheet (peek/half/full, Get Directions) [wave 3, depends 03-01/02]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-04-PLAN.md — Nearby list-view tab (accessible alt to map) + family_mode Settings toggle [wave 4, depends 03-02/03]
- [x] 03-05-PLAN.md — Filter chip row (AND logic, null-include), denied-GPS manual-search fallback, distinct empty/filtered-empty states on MapScreen [wave 4, depends 03-02/03]

---

### Phase 4: GPS Service & Submission

**Goal**: Users physically present at a bathroom can submit it. GPS sample is validated server-side. Submitted locations enter pending state awaiting verification. Access codes and timing tips are writable in this phase — before Phase 8 attempts to display them.
**Depends on**: Phase 3
**Requirements**: User can submit a new bathroom location with name, address, policy tag, access type, hours; User can submit/update the access code (PIN) for a location; User can add timing tips; User sets an `access_sensitivity` value at submission, correctable by the community the same way `policy_tag` is (not admin-only, not auto-derived); Submitted locations enter a pending state until 2 independent GPS verifications; GPS accuracy, freshness, and mock detection enforced
**Success Criteria** (what must be TRUE):

  1. GpsService hook returns `{coord, accuracy, mocked, timestamp}` with high-accuracy mode
  2. Mocked locations are rejected at the RPC layer (not just client-side)
  3. `submit_location` RPC inserts a pending row and fires creator-initial verification event
  4. `submit_location` RPC accepts optional `access_code` and `timing_tips` fields and stores them correctly
  5. `submit_location` RPC accepts an `access_sensitivity` value using the same community-set/correctable trust model as `policy_tag` (feeds Phase 3's `family_mode` filter)
  6. Access code write path requires auth; stored value is NOT returned in public search results (only in authenticated LocationDetail reads)
  7. GPS accuracy > 50m and stale fixes (>60s) are rejected server-side with a generic error
  8. SubmitFlow form validates with Zod, handles all error states (denied permission, low accuracy, failed write)
  9. Newly submitted location appears on map in pending state visible only to submitter
  10. All screens pass Phase 1.5 component acceptance checklist before Codex review

**Plans**: TBD

Plans:

- [ ] 04-01: GpsService hook, GPS validation PL/pgSQL function (reusable across submit + verify), submit_location SECURITY DEFINER RPC
- [ ] 04-02: SubmitFlow screen (RHF + Zod), all error/loading states, pending-location feedback

---

### Phase 5: Trust Engine & Verification

**Goal**: A second independent user can GPS-verify a location, triggering the trust engine. Two non-shadowbanned verifications publish the location. Trust score and confidence score update incrementally.
**Depends on**: Phase 4
**Requirements**: User can GPS-verify a location by being physically within range; Verification weight (`verification_events.weight`) scaled by user trust score + proximity; Location publishes after 2 independent GPS verifications OR 1 + 48-hour no-flag window; Location confidence degrades over time (decay system set up here, job in Phase 6); User is notified when their contribution is verified/published; User sees a private, non-comparative personal impact stat on their Profile reflecting their real GPS-verified contribution count

**Trust scale (from live schema — Phase 5 must align to these):**

- `users.trust_score`: integer, default 9 (document intended range and what constitutes high/low trust before implementing weight formulas)
- `users.trust_multiplier`: numeric, default 0.5 (document intended range before Phase 5 weight calculations)
- `verification_events.weight`: numeric (NOT `weighted_value` — that field does not exist in live schema)

**Success Criteria** (what must be TRUE):

  1. `verify_location` RPC validates GPS triple server-side and inserts a verification event
  2. `verification_events.weight` computed correctly as `trust_multiplier × proximity_decay × accuracy_decay` — field name is `weight`, not `weighted_value`
  3. Location status transitions pending → published after 2 distinct non-shadowbanned verifiers
  4. Shadowbanned user's verification is accepted (no hint given) but produces `weight = 0` and does NOT trigger publish
  5. Tests assert that a shadowbanned user's verification produces `weight = 0` and does NOT trigger the publish gate
  6. `users.trust_score` increments correctly via `trust_events` append pattern (`delta` sign must match `action_type`)
  7. VerifyFlow screen handles accepted/rejected/denied-permission states without leaking rejection reason
  8. 48-hour auto-promote job logic exists (Edge Function or pg_cron stub) even if not yet scheduled
  9. Push notification sent to a submitter when their own submitted/verified location transitions to `published` ("your contribution was verified") — reward-loop notification only, scoped per research/FEATURES.md:132; no proximity or marketing notifications
  10. Profile screen shows a private, non-comparative personal impact stat computed from the user's GPS-verified contribution count (e.g., "Your contributions have helped confirm N bathrooms are ready for someone who needs one") — no ranking against other users, no fabricated reach number; this narrows but does not violate the gamification-UI deferral (see PROJECT.md Out of Scope)
  11. All screens pass Phase 1.5 component acceptance checklist before Codex review

**Plans**: TBD

Plans:

- [ ] 05-01: verify_location RPC + AFTER INSERT trigger chain (recalc_confidence, trust_events, publish gate), compute_verification_weight function (produces `verification_events.weight`)
- [ ] 05-02: VerifyFlow screen, "I'm here" button, accepted/rejected/loading states, "contribution verified" push notification on publish transition, personal impact stat on Profile screen

---

### Phase 6: Decay, Aggregates & Availability Flags

**Goal**: Published locations decay in confidence over time (with a floor). The 90-day respect signal is refreshed on schedule. Users can post expiring temporary availability flags ("currently closed", "inaccessible"). Durable correctness reports (code wrong, permanently closed, etc.) are in Phase 7 — not here.
**Depends on**: Phase 5
**Requirements**: Location confidence degrades over time without fresh verifications; respect_signal_90d materialized view maintained; User can post a temporary expiring availability flag (currently_closed, inaccessible) — these expire automatically and do NOT trigger suppression; Durable problem reports (code wrong, closed permanently, unsafe) are Phase 7 scope
**Success Criteria** (what must be TRUE):

  1. Confidence decay function applies `score × exp(-ln(2) × days / half_life)` with floor at `app_config.confidence_floor`
  2. No location reaches confidence 0 — floor is enforced; permanent hiding requires `suppressed_at` (set in Phase 7)
  3. `respect_signal_90d` refreshes CONCURRENTLY without blocking reads (unique index present)
  4. `flag_location` RPC inserts `availability_flags` rows with `type` in ('currently_closed', 'inaccessible') and `expires_at` enforced in public reads
  5. Expired flags do not appear in search results or location detail
  6. Decay job is scheduled (pg_cron or Edge Function) and documented in app_config
  7. All screens pass Phase 1.5 component acceptance checklist before Codex review

**Plans**: TBD

Plans:

- [ ] 06-01: Confidence decay PL/pgSQL function + scheduled job, confidence floor, respect_signal_log triggers, respect_signal_90d concurrent refresh job
- [ ] 06-02: flag_location RPC (types: currently_closed, inaccessible only), expiry enforcement in read RPCs, availability flags UI in LocationDetail

---

### Phase 7: Reports & Moderation Inputs

**Goal**: Users can report durable problems (wrong code, permanently closed, inaccessible, unsafe, duplicate). High-volume same-type reports auto-suppress locations (sets `locations.suppressed_at`). Admins (via Supabase Studio in v1) can shadowban users/locations and unsuppress locations.

**Boundary with Phase 6:** Phase 6 owns temporary expiring availability flags (`availability_flags`). Phase 7 owns all durable reports (`reports` table). These are separate concepts with separate tables — do not mix.

**Depends on**: Phase 6
**Requirements**: User can file a durable report for any of the 5 named types: code wrong, permanently closed, currently locked/inaccessible, unsafe/dirty, duplicate; User can report another user's content as abusive/objectionable (`report_user`), independent of reporting a location — closes the Apple Guideline 1.2 / Play UGC requirement to report/block abusive users; Locations with multiple same-type reports are suppressed (sets `locations.suppressed_at IS NOT NULL`); Moderation decisions enforced below UI layer
**Success Criteria** (what must be TRUE):

  1. `report_location` RPC accepts all 5 `report_type` values: 'permanently_closed', 'currently_locked', 'inaccurate_information' (covers code wrong/hours), 'dirty_unsafe', 'moved_relocated' — and inserts with reporter identity never returned in public reads
  2. `report_user` RPC exists — lets a user flag another user's content as abusive/objectionable, reporter identity never returned in public reads (same privacy pattern as `report_location`). No new client-facing "block" UI and no new author attribution added anywhere in the app — this feeds the existing `shadowban_user` admin function below, satisfying Apple 1.2 / Play UGC through report + moderator action rather than self-service blocking
  3. Auto-suppress trigger fires when same-type reports exceed `app_config.report_suppress_threshold` and sets `locations.suppressed_at = now()`
  4. Once `locations.suppressed_at IS NOT NULL`, location is excluded from all public search RPCs (consistent with Phase 3 filters)
  5. Admin SECURITY DEFINER functions exist for shadowban_user, shadowban_location, unsuppress_location (clears suppressed_at) — `shadowban_user` is the enforcement point for `report_user` findings
  6. Shadowbanned user's existing contributions are excluded from public aggregates immediately
  7. Report UI in LocationDetail handles all 5 report types with confirmation and error states
  8. Push notification sent to the original reporter when their report leads to a location fix (unsuppress or correction) — "your reported location was fixed," the second reward-loop notification type from research/FEATURES.md:132
  9. All screens pass Phase 1.5 component acceptance checklist before Codex review

**Plans**: TBD

Plans:

- [ ] 07-01: report_location RPC (all 5 types), report_user RPC, auto-suppress trigger (sets locations.suppressed_at), admin SECURITY DEFINER moderation functions (shadowban_user, shadowban_location, unsuppress_location)
- [ ] 07-02: Report UI in LocationDetail, all 5 report type flows, confirmation states, "report user" entry point, "reported location was fixed" push notification on unsuppress/correction

---

### Phase 7.5: Growth & Seed Operations

**Goal**: Support global proof-of-concept launch with repeatable sourcing, verification, import, and promotion workflows. This phase produces admin tooling, field verification guidance, and marketing/social launch support so promoted regions can reach useful local density without hardcoding app availability to one city.
**Depends on**: Phase 7 (suppression and moderation in place before seeding)
**Requirements**: Candidate location sourcing workflow created; admin import tooling tested; field verification checklist created; promoted-region coverage targets defined; marketing/social launch checklist created; import is idempotent; launch-readiness acceptance query passes
**Success Criteria** (what must be TRUE):

  1. App availability is not hardcoded to a single launch city; users can search and contribute globally
  2. At least one promoted region has a verified starter cluster of published locations visible on the map
  3. Promoted-region coverage targets include confirmed changing-table locations, wheelchair-accessible locations, and Chill Spot policy-tagged locations
  4. Marketing, promotion, owned social handles, and community outreach are ready to drive contributor/user activity in priority regions
  5. Admin import script is idempotent — re-run does not create duplicates (duplicate detection via coordinates proximity query)
  6. Seeded/promoted locations have `verification_count ≥ 2` OR are within the 48-hour auto-promote window at launch time
  7. Launch-readiness acceptance query can be parameterized by region and returns published, non-suppressed, non-deleted, verified rows for any promoted area

**Plans**: TBD

Plans:

- [ ] 7.5-01: Candidate sourcing workflow, field verification checklist, duplicate detection query, parameterized launch-readiness acceptance query
- [ ] 7.5-02: Admin import tooling (CSV/JSON → locations, sets data_source='seed'), seed data QA run, marketing/social launch checklist

---

### Phase 8: Client UX & Emergency Modes

**Goal**: The app feels fast, intuitive, and purpose-built for urgency. Emergency modes work with one tap. Ratings are collectable. All error, empty, and offline states are handled — against the Phase 1.5 component acceptance checklist.
**Depends on**: Phase 5 (trust engine live), Phase 6 (flags/decay live), Phase 7.5 (seed data live)
**Requirements**: "Emergency Mode" one-tap; "Changing Table NOW" emergency mode; "Accessible NOW" emergency mode; User can rate cleanliness/accessibility/convenience; Separate changing surface cleanliness dimension; Access codes (PINs) visible only to signed-in users; Filter by policy tag/wheelchair/changing table/cleanliness/currently open; User can save/favorite a location and view a "My Favorites" list
**Success Criteria** (what must be TRUE):

  1. Emergency Mode routes user to nearest published location in ≤2 taps from any top-level route (verified against Phase 1.5 nav model)
  2. "Changing Table NOW" filter returns nearest confirmed changing-table location
  3. "Accessible NOW" filter returns nearest confirmed wheelchair-accessible location
  4. Rating submission persists to DB and updates location detail without full reload
  5. Access codes only visible in LocationDetail when user is signed in AND location has code policy tag
  6. All filter combinations return correct results (spot-tested for empty states)
  7. Denied location permission: map shows manual city/address search input instead of GPS-centered view (no dead-end state)
  8. Offline: cached pins remain visible; new fetch shows "No connection" banner with retry button
  9. No results: named "No bathrooms found nearby" state with "Search this area" button
  10. User can tap a heart/save icon on LocationDetail to favorite a location; favorites persist to a `user_favorites` table and appear in a "My Favorites" list
  11. All screens pass Phase 1.5 component acceptance checklist before Codex review

**Plans**: TBD

Plans:

- [ ] 08-01: Emergency Mode + "Changing Table NOW" + "Accessible NOW" one-tap flows
- [ ] 08-02: Rating UI (cleanliness, accessibility, convenience + changing surface dimension), access code display gate
- [ ] 08-03: Filter system polish, all error/empty/offline states, UX pass
- [ ] 08-04: Save/favorite location (user_favorites table, heart icon, My Favorites list)

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

## Backlog

### Phase 999.1: Travel Language Phrases (BACKLOG)

**Goal:** When a user is traveling in a foreign country, surface the locally-appropriate phrase(s) for "Where is the bathroom?" and "I need to use the bathroom urgently" in the destination language — so they can communicate their need even without speaking the local language.

**Why this matters:** Travelers face the same urgency the app is built for, but with an added barrier: they can't read signs or ask for help in the local language. This is a lightweight feature (no AI needed — curated phrase database per locale) that meaningfully extends the app's value to an underserved moment.

**Open design question:** Auto-detect from GPS country code vs. manual language select. GPS auto-detect is the lower-friction path; manual select handles cases where GPS country doesn't match the user's needed language (e.g., tourist in a border region).

**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)

---

## Progress

**Execution Order:** 1 → 1.5 → 2 → 3 → 4 → 5 → 6 → 7 → 7.5 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Scaffold | 2/2 | Complete | 2026-06-24 |
| 1.5. UX Foundation & Design System | 2/2 | Complete | 2026-06-25 |
| 2. Auth & Profiles | 3/3 | Executed — verification pending | - |
| 3. Read Path & Map | 5/5 | Complete   | 2026-07-07 |
| 4. GPS Service & Submission | 0/2 | Not started | - |
| 5. Trust Engine & Verification | 0/2 | Not started | - |
| 6. Decay, Aggregates & Flags | 0/2 | Not started | - |
| 7. Reports & Moderation Inputs | 0/2 | Not started | - |
| 7.5. Growth & Seed Operations | 0/2 | Not started | - |
| 8. Client UX & Emergency Modes | 0/3 | Not started | - |
| 9. Operations & Hardening | 0/3 | Not started | - |
