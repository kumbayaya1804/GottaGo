# Domain Pitfalls: Crowdsourced Bathroom Finder (Gotta Go)

**Domain:** Crowdsourced GPS-verified location app with trust/reputation engine
**Researched:** 2026-05-18
**Confidence baseline:** HIGH for technical pitfalls (Supabase/PostGIS/RN), MEDIUM-HIGH for trust/cold-start (drawn from Waze/Foursquare/Yelp post-mortems and academic literature)

This document catalogs domain-specific failure modes — not generic "write tests" advice. Each pitfall is mapped to the phase that must address it, with concrete prevention strategies tied to the Gotta Go schema and constraints.

---

## CRITICAL PITFALLS

These cause rewrites, lawsuits, or app death. Address in foundation phases.

### CRITICAL-1: Geometry-vs-Geography SRID 4326 Trap

**What goes wrong:** Storing lat/lon in a `geometry(Point, 4326)` column and using `ST_DWithin(loc, point, 1000)` to search "within 1km." The query returns results 111 km away because SRID 4326 units are *degrees*, not meters. A 1-degree radius is roughly 111 km at the equator.

**Why it happens:** Most tutorials use `geometry` because it's the default in PostGIS examples. The bug is silent — queries return *something*, just the wrong thing. It only surfaces when a user reports "this bathroom is 60 miles away" and you discover the production data has been wrong since launch.

**Consequences:** Every proximity query (Emergency Mode, map filters, "Changing Table NOW") returns garbage. Verification radius checks fail open — a user "verifying" from another state passes the radius check. The entire trust engine is built on a broken foundation.

**Prevention:**
- Use `geography(Point, 4326)` for the canonical location column. Geography uses geodesic math (Karney's algorithm), returns meters, millimeter-accurate worldwide.
- If you keep `geometry` for legacy compatibility, cast in every query: `ST_DWithin(loc::geography, $1::geography, 1000)`.
- Write a contract test: insert NYC and London, assert `ST_Distance` returns ~5,570 km, not ~50.
- Audit the recovered Supabase schema for the location column type before writing a single query.

**Detection:** Distance returned has unit "degrees" in any logs. ST_Distance between known cities returns a value < 1000. Verification radius checks rejecting nobody (or rejecting everyone).

**Phase:** Foundation / Schema (Phase 1). Audit before any read query is written.

---

### CRITICAL-2: ST_Distance in WHERE Clause (No Index)

**What goes wrong:** Writing `WHERE ST_Distance(loc, user_point) < 1000 ORDER BY ST_Distance(loc, user_point)` instead of `WHERE ST_DWithin(loc, user_point, 1000) ORDER BY loc <-> user_point`. PostgreSQL cannot use the GiST spatial index when geometry is wrapped in `ST_Distance` inside WHERE — it does a sequential scan computing exact distance for every row.

**Why it happens:** Developers think "distance < X" is the natural query. It is, logically. But `ST_DWithin` does a cheap bounding-box index lookup first, eliminating 99.9% of candidates before computing exact distances.

**Consequences:** At 50 locations in Eugene, you won't notice. At 5,000 locations across multiple cities, the Emergency Mode "nearest bathroom" query becomes a 2-second sequential scan. Battery drain on mobile becomes a complaint. Supabase compute spikes.

**Prevention:**
- Standard pattern: `WHERE ST_DWithin(loc, $1, $radius_m) ORDER BY loc <-> $1 LIMIT 10`
- The `<->` operator uses the KNN GiST index for ordered nearest-neighbor lookups
- Create `CREATE INDEX locations_loc_idx ON locations USING GIST (loc);` on the geography column
- Never wrap the geometry/geography column in *any* function inside WHERE (`ST_Transform`, `ST_Buffer`, etc. all break index usage)
- EXPLAIN ANALYZE every proximity query during development. Look for "Index Scan using locations_loc_idx" — anything else is a bug.

**Detection:** Map queries take >100ms with <10k rows. EXPLAIN shows "Seq Scan" on locations. Supabase dashboard shows query plan stats with high cost on proximity reads.

**Phase:** Foundation / Map & Discovery (Phase 1-2). Establish proximity query patterns before features depend on them.

---

### CRITICAL-3: RLS Disabled on a Table (Or Enabled with No Policies)

**What goes wrong:** Two failure modes, both silent:
1. Table created via SQL editor or migration without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Every row is publicly readable through the Supabase API using the anon key (which ships in your mobile app binary).
2. RLS enabled but no policies created. Every query returns empty results. Your app looks broken with no error.

**Why it happens:** RLS is not enabled by default on new tables. The Supabase dashboard warns you, but migrations don't. The recovered schema may or may not have RLS enabled consistently across all 14 tables.

**Consequences (mode 1):** Anyone with your anon key (extractable from any mobile binary in seconds) can `SELECT *` from `trust_events`, `users`, `submissions`. Privacy spec violation. Reportable security incident. The 83% statistic from one analysis — "83% of exposed Supabase databases involve RLS misconfigurations" — is the population you're trying not to join.

**Prevention:**
- Audit every recovered table: `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace;`
- Write a CI check that fails the build if any public table has `relrowsecurity = false`.
- For every table, write four policies: SELECT, INSERT, UPDATE, DELETE. Most devs only test SELECT.
- `WITH CHECK` on UPDATE policies: prevents users from updating `user_id` to another user's ID. `USING` controls which rows they can see/modify; `WITH CHECK` controls what the row looks like *after* the modification.
- Service-role key is server-only. Never bundle it with the mobile app.
- Anon role policies must not reference `auth.uid()` (anonymous users have no uid — policy fails closed).

**Detection:** Manual test with `curl` using only the anon key — try to read `trust_events`, `users.email`, `verification_events.lat/lon`. If any of these return rows, you have a critical leak.

**Phase:** Foundation / Schema audit (Phase 1). Cannot ship without this.

---

### CRITICAL-4: GPS Spoofing Defeats Single-Source Verification

**What goes wrong:** Mobile GPS coordinates are *unauthenticated user input*. Android has "Allow mock locations" as a developer setting. iOS jailbreaks and Magisk modules on Android can fake GPS at system level — undetectable from app-level APIs. Foursquare lost the mayor wars exactly this way: 40 lines of script faked check-ins to any venue.

**Why it happens:** The phone tells the app "I am at 44.0521, -123.0868." The app has no way to verify this *from the GPS chip alone*. Cryptographic proof-of-location does not exist in commodity smartphones.

**Consequences for Gotta Go specifically:** The 2-verification publish threshold is the safety net, but a determined attacker with two phones (or one phone + emulator) bypasses it trivially. PIN code spam, fake locations on competitor businesses, harassment via geo-tagging — all become possible. The "1 verification + 48hr no-flag window" alternative is even weaker.

**Prevention (defense in depth, no single solution works):**
- **Server-side validation:** All verification math runs in Postgres functions (RPC), not client. The client submits `(claimed_loc, gps_accuracy, gps_timestamp)`; server checks plausibility.
- **Mock location flag:** `expo-location` exposes `mocked: boolean` on Android (iOS does not have an equivalent — assume jailbreak). Reject mocked submissions OR weight them to zero trust.
- **GPS freshness window:** Reject readings older than ~30s. A spoofer can fake coords but generating a fresh fake reading repeatedly is more work.
- **Accuracy threshold:** Reject readings with `accuracy > 50m`. Most spoofers report unrealistically perfect accuracy (≤5m) — flag *too good* as suspicious too.
- **Velocity sanity check:** Server tracks last verified location per user. If they were in Eugene 5 minutes ago and now claim Las Vegas, reject (or flag for review).
- **WiFi BSSID / cell tower cross-check:** If you collect nearby WiFi SSIDs/BSSIDs (with user consent), compare against a known map. Spoofers rarely fake all signal sources consistently. Note: significant privacy implications, opt-in only.
- **Multi-constellation check:** Raw GNSS data on modern Android can expose which satellite constellations (GPS, GLONASS, Galileo, Beidou) are visible. Cheap spoofers fake L1 GPS only.
- **Trust-weighted verification:** A new account's verification counts much less than a trusted user's. Sybil farming requires building trust across N accounts — much higher cost.
- **2-verification minimum is a floor, not a ceiling:** For high-stakes attributes (PIN codes, accessibility tags), require more verifications or trusted users.

**Detection:** Verification events with implausible velocity between users. Same device fingerprint verifying many locations. Accuracy < 1m on consumer devices. New-account verification clusters in time.

**Phase:** Trust Engine (Phase 2 or 3, before any user submissions). The verification function is the load-bearing wall of the entire app.

---

### CRITICAL-5: Trust Engine Calculated Client-Side or Mutable by Client

**What goes wrong:** Computing trust_score in client code, or having an RLS policy that lets users UPDATE their own `users.trust_score` directly. A user reads "trust_score" from the response, increments it, sends it back. RLS sees `auth.uid() = row.user_id` → allowed.

**Why it happens:** Naive RLS policy patterns. "Users can update their own row" sounds correct. It isn't, when the row contains scoring/reputation fields.

**Consequences:** Trust scores become meaningless within hours of public launch. All verification weighting collapses. Sybils become indistinguishable from real users. The 2-verification rule's safety depends on trust — if trust is gamed, the floor collapses.

**Prevention:**
- Trust score is **never** in an UPDATE-able column from the client. Either:
  - Store trust state in a separate table only modified by service-role/server functions (`trust_events` ledger + computed view)
  - Or use a column-level grant: `REVOKE UPDATE (trust_score) ON users FROM authenticated;`
- All trust mutations happen via `SECURITY DEFINER` Postgres functions. Client calls `rpc('record_verification', ...)`; the function decides whether/how to update trust.
- Add a check constraint: `CHECK (trust_score >= 0 AND trust_score <= MAX_TRUST)` to catch bugs even with bad policies.
- Audit `WITH CHECK` clauses: ensure `users` UPDATE policy includes `WITH CHECK (trust_score = OLD.trust_score)` or equivalent if you can't separate the column.

**Detection:** Penetration test — authenticate as a real user, attempt direct UPDATE on `users.trust_score` via the REST API. Must fail.

**Phase:** Trust Engine (Phase 2-3). Bake into the schema before any verification feature ships.

---

### CRITICAL-6: Gamification Rewards Cheap Actions Highest

**What goes wrong:** Award the same points (or more) for "Just used this!" freshness pings as for actual GPS-verified submissions or quality ratings. This is explicitly flagged in PROJECT.md as a known risk.

**Why it happens:** It's tempting to gamify the easy-engagement actions to drive DAU. But this is the *exact* mistake that turned Foursquare check-ins into a spam war and degraded Waze report quality in some regions.

**Consequences:**
- Bots/farmers spam "just used this" pings to climb leaderboards
- Real submissions (which require physical presence + effort) are economically irrational
- Confidence decay system gets defeated by cheap freshness pings — locations appear "current" but the underlying data is years old
- Word-of-mouth in parent communities collapses if quality is visibly low

**Prevention:**
- Reward ordering (highest to lowest): first-to-verify new location > correction with evidence (new code) > GPS verification of existing > rating with detail > freshness ping
- Cap freshness pings: max 1 per user per location per 72 hours; max N freshness pings per user per day
- Caps per *city* not just per user — prevents a small group from coordinating to flood one market
- Per-location diminishing returns: 1st verification of a location = full points; 5th verification of the same location = 5% points
- Quality multiplier: pings/verifications from users with low trust get multiplied by ~0 in the reward calc, but logged for trust history
- v1 ships with DB tracking only (per PROJECT.md), v2 surfaces UI — this is the right call. Don't surface leaderboards until enough volume to detect manipulation patterns.
- Watch the Waze playbook: reports that are not confirmed expire; excessive reports from one account get shadow-shown only to that account.

**Detection:** Daily report of points-per-user distribution. Top 1% of users should have a believable activity profile (no single user generating 100 freshness pings/day).

**Phase:** Trust Engine + Gamification (Phase 2-3). Implement gamification math before surfacing it.

---

### CRITICAL-7: Cold Start — Launching Too Wide Kills the App

**What goes wrong:** Launching nationally (or even statewide) with 50 locations. Users open the app, see an empty map, uninstall. Network effects are local — a parent in Eugene needs locations *in Eugene*, not 200 in San Francisco.

**Why it happens:** Pressure to "open the market." Founders want their friends in other cities to use it. The crowdsourcing fallacy: "users will fill it in once we launch." They won't, because they uninstall before contributing.

**Consequences:** Permanent reputation damage in launch markets. Word-of-mouth dies. The parent segment is especially unforgiving — they tell each other "I tried Gotta Go, it was empty" once, and the network is poisoned for that region.

**Prevention (Eugene-first strategy, already correct in PROJECT.md):**
- 50 high-quality verified locations in Eugene *before* public launch — per existing constraint, this is right
- Coverage type > count: 5-8 Chill Spots, 3-4 changing stations, downtown corridor saturation
- Founder/team manually verifies all 50 (don't rely on community to bootstrap)
- App refuses to show "results" outside seeded cities — show "Coming soon to [city]" instead of empty map (preserves trust)
- Reverse-geocode user location → if outside Eugene, prompt "Help us launch here" CTA with waitlist
- Las Vegas as Phase 2 (per PROJECT.md): different model — tourist density, international visitors, casino-dominated. Validate the dense-urban model in Eugene first.

**Detection:** Sessions per user per week in launch market < 1.5 = cold start failing. Empty-result-rate > 20% = density insufficient.

**Phase:** Pre-launch / Launch strategy. Phase that ships v1 to public.

---

## HIGH PITFALLS

Serious problems, not always fatal. Address in dedicated phases.

### HIGH-1: Confidence Decay Without Decay Math Specification

**What goes wrong:** Per SPEC.md "Confidence decay formula" is listed as an open product decision. Ship without one → confidence either never decays (stale data treated as fresh) or decays too fast (everything looks unreliable, app feels broken).

**Why it happens:** Decay formulas seem like a small detail until they affect every search result ranking. Half-life-based decay (e.g., score *= 0.5^(days/30)) is industry standard but the constants matter — 30 days vs 90 days completely changes UX.

**Consequences:** If too slow: Waze-grade staleness, code that hasn't worked in 6 months still shown. If too fast: every location decays to "unverified" before next user can verify it, app feels dead. The Waze model is instructive — they made reports expire if unconfirmed, but verified geometry persists much longer.

**Prevention:**
- Decay formula must be deterministic, documented, and unit-tested (per SPEC.md). Suggested: exponential decay with attribute-specific half-lives. PIN codes: 7-day half-life. Hours: 30-day. Physical presence (does location exist): 180-day.
- Decay is *not* deletion. Confidence is a ranking signal, not a visibility gate. Below threshold X, suppress from "Emergency Mode" but show in "All Bathrooms" with "needs verification" badge.
- Re-verification resets decay; corrections reset only the contested attribute, not all attributes.
- Document the half-life values in `app_config` table — tunable without redeploy.

**Phase:** Trust Engine / Confidence (Phase 2-3). Document formula *before* it has production data depending on it.

---

### HIGH-2: PIN Code Liability and Business Backlash

**What goes wrong:** Publishing the bathroom PIN for [Business X]. Business X's manager finds the app, threatens cease-and-desist or lawsuit (typically meritless, Section 230 protects platforms for user-generated content — but the threat alone is expensive). Worse: business changes PIN aggressively, app data goes stale fast, users get frustrated.

**Why it happens:** PINs are explicitly the wedge of the product. Businesses see this differently than users do — to them, the PIN is loss prevention, not public info.

**Consequences (graduated):**
- Cease-and-desist letters from chains (Starbucks-scale legal teams routinely send these). Usually no merit but $5-20k in attorney response.
- Coordinated PIN rotation by chains → permanent staleness in your data → product dies
- Press cycle ("App helps freeloaders evade business bathroom policies") → user backlash from both sides
- Local DA inquiries in jurisdictions with restroom access laws (CA, varies by state)

**Prevention:**
- **Legal framing first:** Section 230 protects platform from user posts. Make sure all PIN data is user-submitted, not editorial. Terms of Service shifts content liability to contributor.
- **Community-reported language** (already in PROJECT.md): "Users report this code as [1234]" not "The code is 1234." Disclaimer on every PIN: "Code may have changed. Buy something to support businesses that welcome you."
- **Business opt-out endpoint:** Business owners can claim a listing and request PIN suppression. Don't fight this — auto-comply for verified business owners. The PR cost of fighting one viral cease-and-desist is higher than losing PIN data on one location.
- **Tip jar UX (already considered for v2):** "This bathroom is free? Tip a buck back to the business" — turns Gotta Go from parasitic to symbiotic relative to small businesses.
- **No PIN scraping:** Submissions must come from authenticated, GPS-verified users (already required). Reject bulk imports.
- **Geofence sensitive locations:** Hospital, school, government PINs auto-suppressed pending moderator review.

**Detection:** Monitor for chain-level PIN-rotation patterns. Press mentions. Outbound cease-and-desist via support@.

**Phase:** Submissions / Moderation (Phase 2-3). Liability framing must be in place before public PIN submissions are accepted.

---

### HIGH-3: Anon Key Exposure Treated as Secret

**What goes wrong:** Treating the Supabase `anon` key as a secret. It's not — it's bundled into every mobile app binary and extractable in seconds. Devs sometimes try to "protect" it via obfuscation, then become complacent.

**Why it happens:** Confusion between `anon` (public) and `service_role` (secret). Both look like JWTs.

**Consequences:** False sense of security. The only protection is RLS. If RLS is wrong (see CRITICAL-3), exposing the anon key is exposing the database.

**Prevention:**
- Anon key in mobile binary is fine — *as long as RLS is correct*.
- Service role key never in mobile. Never in client-bundled environment variables. Only in server functions / Edge Functions / migrations.
- Document this distinction in onboarding for new engineers.
- Add a CI check: grep for `service_role` or the actual key prefix in the mobile bundle output. Fail build if found.

**Phase:** Foundation / DevEx (Phase 1).

---

### HIGH-4: React Native Location Permission Denial Black Hole

**What goes wrong:** User denies location permission. App shows empty screen, or worse, crashes. iOS makes the denied state sticky — `requestForegroundPermissionsAsync()` returns "denied" without showing the OS prompt again. Users don't know how to recover.

**Why it happens:** Permission states have three values (granted/denied/undetermined) and iOS additionally has "Allow Once" which behaves like "undetermined" next session. Naive code branches `if (granted) { ... } else { error }` and never handles the recovery flow.

**Consequences:** User churns immediately. If they're a parent in an emergency, never returns.

**Prevention:**
- Detect denied state on launch. Show explanation screen with deep link: `Linking.openSettings()` opens the app's settings page where the user can re-enable.
- **Always provide a manual search fallback:** city/area text input. Per SPEC.md: "Search near their current location or a selected area." This is the answer to denial — don't gate the whole app on GPS.
- Defer permission request until first feature use (Emergency Mode tap), not app launch. Apple's review guideline 5.1.5 explicitly requires purpose-driven requests.
- Show *why* before the OS prompt — pre-prompt with a non-blocking modal: "Gotta Go needs your location to find bathrooms near you. We never store your location after you close the app." Then trigger the OS prompt.
- Handle "Allow Once" by checking permission on every relevant interaction, not just at launch.
- Test on physical iPhone where permission was previously denied — emulators don't reproduce this state well.

**Phase:** Map & Discovery (Phase 2). Permission UX is the first-touch experience.

---

### HIGH-5: App Store Rejection — Background Location

**What goes wrong:** Requesting background location for the Emergency Mode feature without justification, or declaring "no background location" on Play Console but actually using it. Either gets the app rejected.

**Why it happens:** "Emergency Mode" sounds like it might need background — devs over-request to be safe. Apple specifically rejects apps that request persistent location for anything other than navigation/mapping with active use.

**Consequences:** 1-2 week rejection cycle per attempt. The reviewer's feedback is often vague. Multiple rejections damage credibility on subsequent reviews.

**Prevention:**
- Foreground only for v1. There is zero v1 feature that requires background location.
- Permission justification strings in `Info.plist` (iOS) and Play Console (Android) must be specific: "Gotta Go uses your location while you're using the app to find bathrooms near you." Not "for app functionality."
- Apple 5.1.5: explanation must be in the prompt itself, not just docs.
- Play Console Location Policy form: declare NO background location. If you ever add it (geofence reminders for parents?), this becomes a separate review submission with a justification video demo — plan accordingly.
- Document permission flow with screenshots in the App Review notes — preempts reviewer confusion.
- Test on TestFlight before submission; rejection feedback there is private.

**Phase:** Pre-launch / App Store submission. Block one of the last phases before public release.

---

### HIGH-6: Supavisor / Connection Pooling Misconfiguration

**What goes wrong:** Using direct database connections (port 5432) from serverless Edge Functions, exhausting Postgres connection limits. Or using transaction-mode pooler with prepared statements that don't survive transaction boundaries.

**Why it happens:** Supabase deprecated pgBouncer in favor of Supavisor. New project default is Supavisor session-mode (port 5432 IPv6 / 6543 pooled). Tutorials and Stack Overflow answers are mixed.

**Consequences:** "remaining connection slots are reserved" errors at peak traffic. Mobile app login waves (morning commute) overload before you have real users.

**Prevention:**
- Mobile app → uses Supabase JS client → goes through PostgREST → already pooled. Don't roll your own.
- Server functions (Edge Functions, cron jobs) use Supavisor pooled connection string (port 6543, transaction mode).
- Migrations / DDL use session mode (port 5432) — transaction mode breaks DDL.
- Watch Supavisor named prepared statement support (Sep 2024+): if your ORM uses prepared statements, ensure pooler supports them.
- Set client-side timeout shorter than Supavisor's — fail fast, retry, don't hold connections.

**Phase:** Foundation / DevEx (Phase 1). Wire connection patterns correctly before scaling.

---

### HIGH-7: Realtime Subscriptions Cost Explosion

**What goes wrong:** Subscribing to `postgres_changes` on the entire `locations` table to "live update the map." Every insert/update anywhere in the system fans out to every connected client. At $10/1k peak connections and $2.50/1M messages, this can scale faster than user growth.

**Why it happens:** Realtime is one of Supabase's selling features. It looks free until it isn't. One production case study: $3,600/month → $972/month after fixing exactly this pattern.

**Consequences:** Surprise bills. Phantom "performance issues" that are actually quota throttling. Eventually you redesign on a deadline.

**Prevention:**
- Don't realtime-subscribe to the locations table from the map. Polling on map-pan / pull-to-refresh is fine for v1 — bathroom data doesn't change second-to-second.
- If you want realtime for something specific (e.g., a specific location's PIN updates while the user is viewing it), use a *Broadcast channel* scoped to that location, not Postgres Changes on the table.
- Use server-side broadcast: server-mediated fan-out, not client-table subscription.
- Set RLS filters on realtime channels — clients can't subscribe to data they can't see.

**Phase:** Map & Discovery (Phase 2). Make the polling-vs-realtime decision before features depend on either.

---

## MODERATE PITFALLS

Address in normal course of development. Each one is a 1-2 day fix if caught early, 1-2 weeks if caught after launch.

### MODERATE-1: Email Leakage in Public User Metadata

**What goes wrong:** Joining `auth.users.email` into client-visible queries. SPEC.md explicitly forbids this. Easy mistake — `auth.users` is a system table, you write a public.users join, email leaks.

**Prevention:** Public `users` table mirrors only public-safe fields (display name, trust tier). Never `auth.users.email` in API responses to anon/authenticated roles. Add CI test: query public schema for any column named `email` — should be none except in admin-restricted views.

**Phase:** Authentication (Phase 1-2).

---

### MODERATE-2: Raw Coordinates Logged or Returned in API

**What goes wrong:** API returns user's exact submission coordinates as part of the verification event response, or logs `INFO: User 1234 verified at 44.0521, -123.0868`. Per SPEC.md privacy requirements, neither is allowed.

**Prevention:** Verification responses return only success/fail + distance bucket, not raw coords. Logs strip lat/lon (whitelist log fields, don't blacklist). PostGIS coordinates only stored on `verification_events` table accessible to service-role; never to client.

**Phase:** Verification (Phase 2-3).

---

### MODERATE-3: AsyncStorage for Session = Plaintext Token Exposure

**What goes wrong:** Default Supabase RN auth uses `AsyncStorage` for session persistence. AsyncStorage is unencrypted. On a rooted/jailbroken device, refresh tokens are extractable.

**Prevention:** Use Expo SecureStore (iOS Keychain / Android Keystore). Session token exceeds SecureStore's 2KB limit on some platforms → store encrypted with MMKV, encryption key in SecureStore (per Supabase RN recipe). Alternative: `react-native-keychain`.

**Phase:** Authentication (Phase 1-2).

---

### MODERATE-4: Offline-First Session Auto-Refresh Logs User Out

**What goes wrong:** User opens app offline. Supabase's `startAutoRefresh()` attempts token refresh, fails (no network), and clears the session. User is logged out for no apparent reason. Documented issue in Supabase RN discussions.

**Prevention:** Check `NetInfo` before triggering auto-refresh. Wrap refresh in retry-with-backoff. Treat network errors differently from auth errors — only clear session on actual 401, not on connection failure.

**Phase:** Authentication (Phase 1-2).

---

### MODERATE-5: Shadowban Leakage via Error Responses

**What goes wrong:** Shadowbanned user submits a verification. Server returns 403 "you are shadowbanned" → user knows, opens a new account. Per SPEC.md, hidden status must not leak.

**Prevention:** Shadowbanned users' submissions succeed with 200, but are filtered downstream (do not influence trust, confidence, leaderboards). Public queries hide shadowbanned content. Difference is silent. Implement filtering at SQL view layer (e.g., `public_locations` view that excludes shadowbanned).

**Phase:** Moderation (Phase 3-4).

---

### MODERATE-6: Materialized View Refresh Strategy Missing

**What goes wrong:** `respect_signal_90d` is a materialized view per recovered schema. Without a refresh strategy, it goes stale instantly. Refresh on every write = expensive. Refresh never = wrong data.

**Prevention:** `REFRESH MATERIALIZED VIEW CONCURRENTLY respect_signal_90d` on a cron schedule (Supabase pg_cron extension). 5-minute cadence for an MVP. Concurrently requires a unique index on the view. Document staleness window — 5 minutes is fine for a respect signal, not fine for an availability flag.

**Phase:** Trust Engine / Confidence (Phase 2-3).

---

### MODERATE-7: Verification Event Replay Attacks

**What goes wrong:** Client captures a successful verification request payload (lat/lon, timestamp, accuracy) and replays it later. Server has no way to detect the replay if it only validates payload fields.

**Prevention:** Server includes `recorded_at = now()` (not client-supplied). Reject if client `gps_timestamp` is older than 30s vs `recorded_at`. Use unique constraint on `(user_id, location_id, recorded_at_bucket)` to prevent multiple verifications in same N-minute window. Sign requests with nonce if paranoid.

**Phase:** Verification (Phase 2-3).

---

### MODERATE-8: Mapbox Token in Mobile Binary

**What goes wrong:** Public Mapbox token in app binary, gets scraped, attacker uses it to drain your tile quota.

**Prevention:** Use a *URL-restricted* public token (Mapbox supports allow-listing app bundle IDs / URL referrers). Monitor Mapbox dashboard for anomalous usage. Rotate token if abuse detected. Don't put a secret token in the binary; the URL-restricted public token is the right primitive.

**Phase:** Map & Discovery (Phase 2).

---

## MINOR PITFALLS

### MINOR-1: Missing Index on `confidence_score` for Sort

Map results sort by composite confidence + distance. Without an index on confidence, the sort is O(n log n) per query. Add a btree index on `confidence_score DESC`. **Phase:** Map & Discovery.

### MINOR-2: Date/Time in User's Local Timezone Stored as TIMESTAMP

Hours-of-operation across multiple cities → store as `TIMESTAMPTZ` always. Eugene and Las Vegas timezone difference will bite "is bathroom open now?" queries. **Phase:** Submissions.

### MINOR-3: Expo SDK Major Version Drift

Expo SDK releases ~3x/year. Holding on an old SDK past 2 cycles loses store-submission compatibility. Plan SDK upgrades into the roadmap, not as emergency work. **Phase:** Ongoing.

### MINOR-4: Mapbox Style URL Hardcoded

Style versions change. Use a versioned style URL (`mapbox://styles/your/style-id/draft` vs published). Lock to a published style version in production. **Phase:** Map & Discovery.

### MINOR-5: No Analytics Identification Strategy

Mixing anonymous + authenticated events with no `user_id` alias produces unreadable funnels. Decide identification strategy day 1, even if analytics is deferred. **Phase:** Pre-launch.

---

## Phase-Specific Warning Summary

| Phase Topic | Critical/High Pitfalls to Address | Why This Phase |
|---|---|---|
| **Foundation / Schema audit** | CRITICAL-1 (SRID 4326), CRITICAL-3 (RLS), HIGH-3 (anon key) | Recovered schema must be audited before any feature code |
| **Authentication** | MODERATE-1 (email leak), MODERATE-3 (SecureStore), MODERATE-4 (offline refresh) | Identity is the trust root |
| **Map & Discovery** | CRITICAL-2 (ST_DWithin), HIGH-4 (permission UX), HIGH-7 (Realtime cost), MODERATE-8 (Mapbox token) | First user-facing surface |
| **Submissions** | HIGH-2 (PIN liability framing), MODERATE-2 (raw coords leak) | First write surface — content liability begins |
| **Verification / GPS** | CRITICAL-4 (spoofing defense in depth), MODERATE-7 (replay), MODERATE-2 (coord privacy) | Load-bearing wall |
| **Trust Engine** | CRITICAL-5 (server-only mutation), CRITICAL-6 (gamification ordering), HIGH-1 (decay formula), MODERATE-6 (matview refresh) | All downstream signals depend on this |
| **Moderation** | MODERATE-5 (shadowban leak), HIGH-2 (business opt-out) | Abuse defense |
| **Pre-launch / Submission** | HIGH-5 (App Store rejection), CRITICAL-7 (cold start density) | Last gates before public exposure |

---

## Cross-Cutting Principles (Distilled from Pitfalls)

1. **The client is never the authority.** Trust, proximity, shadowban, moderation — all server-decided.
2. **RLS is the perimeter, not a layer of defense.** Anon key is public; RLS is the only thing standing between attackers and the DB.
3. **Defense in depth on GPS.** No single mock-location check works against a determined attacker. Stack 4-5 weak checks; require multiple verifications; weight by trust.
4. **Confidence decays; deletion never.** Stale data is suppressed from emergency surfaces but not erased — re-verification must be cheap.
5. **Cold start is local.** Eugene saturation before Eugene → Las Vegas. Don't pretend to be in markets you haven't seeded.
6. **PIN data is the wedge AND the legal risk.** Community-reported framing, business opt-out, no PIN gating without a path for businesses to engage constructively.
7. **Reward quality, cap quantity.** Freshness pings are the lowest-reward action and capped. Verifications outweigh ratings outweigh pings.

---

## Sources

### High-Confidence (Official Docs)

- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Docs | Troubleshooting | RLS Simplified](https://supabase.com/docs/guides/troubleshooting/rls-simplified-BJTcS8)
- [Securing your API | Supabase Docs](https://supabase.com/docs/guides/api/securing-your-api)
- [Supavisor: Scaling Postgres to 1 Million Connections](https://supabase.com/blog/supavisor-1-million)
- [Supavisor 1.0: a scalable connection pooler for Postgres](https://supabase.com/blog/supavisor-postgres-connection-pooler)
- [Connect to your database | Supabase Docs](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Realtime Pricing | Supabase Docs](https://supabase.com/docs/guides/realtime/pricing)
- [Realtime Concepts | Supabase Docs](https://supabase.com/docs/guides/realtime/concepts)
- [Use ST_DWithin for radius queries | PostGIS](https://postgis.net/documentation/tips/st-dwithin/)
- [ST_DWithin | PostGIS Reference](https://postgis.net/docs/ST_DWithin.html)
- [Geography — Introduction to PostGIS](http://postgis.net/workshops/postgis-intro/geography.html)
- [Location - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
- [Maps User Generated Content Policy](https://support.google.com/contributionpolicy/answer/7400114)

### Medium-High Confidence (Established Practitioner Sources)

- [Why Your PostGIS Queries Are Slow (Philip McClarence)](https://medium.com/@philmcc/why-your-postgis-queries-are-slow-common-anti-patterns-and-fixes-a199e3db9a68)
- [Spatial Indexes and Bad Queries — Paul Ramsey](http://blog.cleverelephant.ca/2021/05/indexes-and-queries.html)
- [PostGIS Geometry vs Geography: A Practical Decision Guide](https://medium.com/@philmcc/postgis-geometry-vs-geography-a-practical-decision-guide-9d8d2cf1ea40)
- [It's a Trap! PostGIS Geometry with SRID 4326 is not a Geography](https://blog.frank-mich.com/its-a-trap-postgis-geometry-with-srid-4326-is-not-a-geography/)
- [Supabase Security: Exposed Anon Keys, RLS, and Misconfigurations](https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster)
- [Supabase RLS Guide: Policies That Actually Work](https://designrevision.com/blog/supabase-row-level-security)
- [Reducing Supabase Real-time Costs by 73%](https://techsynth.tech/blog/reducing-supabase-realtime-costs-by-73-percent/)
- [Expo Location in React Native: Permissions, Coordinates, and Geofencing](https://coffey.codes/articles/building-location-based-features-using-expo-location)
- [Authentication with Supabase | Ignite Cookbook](https://ignitecookbook.com/docs/recipes/Authentication/)
- [Stop Geo-Spoofing with Secure API Integration (Approov)](https://approov.io/blog/stop-geo-spoofing-with-secure-api-integration-for-mobile-application)
- [How to Protect Android & iOS Apps Against Fake GPS Apps (Appdome)](https://www.appdome.com/how-to/mobile-fraud-prevention-detection/geo-compliance/detect-fake-gps-app-on-android/)

### Medium Confidence (Academic / Industry Analysis)

- [Tests of Crowdsourced Smartphones Measurements to Detect GNSS Spoofing (Stanford)](https://web.stanford.edu/group/scpnt/gpslab/pubs/papers/Lo_Crowdsourced_Spoof_ION_ITM_2019%20.pdf)
- [GPS spoofing detection via crowd-sourced information (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S1389128622003103)
- [Location Cheating: A Security Challenge to LBSN Services (arXiv)](https://arxiv.org/pdf/1102.4135)
- [Waze – Crowdsourcing Maps and Traffic Information (Harvard D3)](https://d3.harvard.edu/platform-digit/submission/waze-crowdsourcing-maps-and-traffic-information/)
- [Foursquare Now Lets Businesses 'Oust' Fake Mayors (TechCrunch)](https://techcrunch.com/2010/11/02/foursquare-oust-mayor/)
- [Crowdsourced geospatial data quality: challenges and future directions](https://www.tandfonline.com/doi/full/10.1080/13658816.2019.1593422)
- [Designing for Information Quality in the Era of Repurposable Crowdsourced UGC](https://link.springer.com/chapter/10.1007/978-3-319-92898-2_15)

### Liability / Legal

- [User-Generated Content | Traverse Legal](https://www.traverselegal.com/blog/user-generated-content/)
- [Legal Issues with User Generated Content (TermsFeed)](https://www.termsfeed.com/blog/legal-issues-user-generated-content/)
- [Starbucks Adopts "Restrooms for Paying Customers Only" Policy (FindLaw)](https://www.findlaw.com/legalblogs/law-and-life/starbucks-adopts-restrooms-for-paying-customers-only-policy-what-does-the-law-say/)
- [iOS App Store Rejection — Background Geolocation](https://github.com/christocracy/cordova-plugin-background-geolocation/issues/132)
- [7 Common App Store Rejection Reasons](https://www.adalo.com/posts/common-app-store-rejection-reasons/)
