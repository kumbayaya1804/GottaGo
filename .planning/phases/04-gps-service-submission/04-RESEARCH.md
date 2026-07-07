# Phase 4: GPS Service & Submission - Research

**Researched:** 2026-07-07
**Domain:** Server-side GPS validation (Supabase SECURITY DEFINER RPC) + pending-submission staging model + Expo mock/accuracy detection + RHF/Zod multi-step wizard + pending-pin map layer
**Confidence:** HIGH on schema/stack/patterns (live migrations, seed, and package.json inspected directly); MEDIUM on the pre-publication storage recommendation (a design decision this research *resolves* with strong evidence — planner/discuss should ratify) and on the `update_access_code` confirmation mechanism (D-24 is underspecified).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Non-building locations**
- **D-01:** No street address → free-text location description replaces the address field entirely.
- **D-02:** No new `location_type` field — existing "Public Facility" policy tag covers parks/trailheads/port-a-potties.
- **D-03:** No distinct pin/icon styling for non-building locations — same marker.
- **D-04:** Explicit "No address? Describe the location instead" skip-autocomplete affordance — toggles the address field from Google Places autocomplete mode to plain free-text.
- **D-05:** GPS is always canonical for coordinates. Address/description is a human-readable label only, never geocoded — the real lat/lng always comes from the submitter's live GPS fix at Step 3.

**access_sensitivity submission UX**
- **D-06:** Binary flag, matching the `'sensitive'` sentinel Phase 3's `family_mode` filter checks (`access_sensitivity IS DISTINCT FROM 'sensitive'`).
- **D-07:** Intended meaning: adult/nightlife venues.
- **D-08:** Required question in SubmitFlow Step 1 (grouped with policy tag + accessibility tags), defaults unselected.
- **D-09:** When left off (default), `submit_location` writes **NULL** to `access_sensitivity` (null never treated as sensitive).
- **D-10:** Toggle copy: **"Not suitable for kids"** (user's explicit choice; may add a supporting explainer line — see D-12).
- **D-11:** Set once at submission only. Corrections/disputes go through the Report flow (`report_location`), not a self-edit UI.
- **D-12:** Short explainer microcopy under the toggle stating the concrete effect (hides from Family mode users).
- **D-13:** UI component: a switch/toggle (distinct from `policy_tag`'s segmented picker).
- **D-14:** Toggle available regardless of `policy_tag`.
- **D-15:** Submitting with the toggle ON requires a confirmation dialog ("This location will be hidden from Family mode users").
- **D-16 (schema gap, Phase 7):** `reports.report_type` CHECK has no sensitivity-dispute value. Do NOT reuse `'inaccurate_information'`; a new value (e.g. `'wrong_sensitivity_tag'`) lands in a future Phase 7 migration. Phase 4's D-11 depends on it eventually.

**Access code (PIN) field framing**
- **D-17:** PIN field only appears when `policy_tag = 'Code Required'` — conditional.
- **D-18:** The entire SubmitFlow wizard requires sign-in from the start.
- **D-19:** PIN field copy: **"Door code (optional) — only shown to signed-in users"**.
- **D-20:** Freeform text input, generous max length (~100 chars). No numeric-only/fixed-length validation.
- **D-21 (scope expansion):** Phase 4 also builds an **update-code flow** for already-published locations — a distinct `update_access_code` RPC + UI.
- **D-22:** `submit_location` (and update path) records a **"code last confirmed at" timestamp**. Defaults to `created_at` on insert; resets to `now()` on update.
- **D-23:** "Update door code" action lives as a signed-in-only button on the existing LocationDetail sheet.
- **D-24:** Overwriting an existing code requires **1 confirming verification before it replaces** the old value (mirrors publish-confirmation pattern; abuse-resistance).
- **D-25:** On update, timestamp resets and old value is overwritten — no history/audit log.

**Pending-pin tap behavior**
- **D-26:** Tapping the submitter's own pending pin opens a **pending-status sheet** (reuses LocationDetailSheet pattern, pending-specific content).
- **D-27:** Sheet shows **verification progress + what's needed**, sourced from the `submissions` row's `confirmation_count`/`expires_at`.
- **D-28 (scope expansion):** Add a **"withdraw submission"** action on the pending-status sheet.
- **D-29:** Withdrawing makes the pin **disappear from the map entirely** — no lingering "withdrawn" state.
- **D-30:** Withdrawing requires a confirmation dialog first ("Are you sure? This can't be undone").

### Claude's Discretion
None outstanding — every gray area reached an explicit decision. (D-10, D-21, D-28 diverged from the recommended option deliberately — do not re-litigate.)

### Deferred Ideas (OUT OF SCOPE)
None deferred. D-21/D-28 are in-phase scope clarifications; D-16 is a tracked Phase 7 schema gap.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-SUBMIT | Submit a new bathroom location with name, address/description, policy tag, access type, hours | `submit_location` SECURITY DEFINER RPC stages all fields on a `submissions` row (Option A, §Architecture). SubmitFlow 3-step RHF+Zod wizard in `submit.tsx`. |
| REQ-CODE-WRITE | Submit/update the access code (PIN) for a location | Submit stages `access_instructions`; `update_access_code` RPC handles the published-location update path (D-21/22/24/25). |
| REQ-TIMING | Add timing tips | Single submission-time tip staged on the submission; published storage = new `timing_tips` table (§Open Questions OQ-4). |
| REQ-SENSITIVITY | `access_sensitivity` set at submission, community-correctable like `policy_tag` | Staged on submission; copied to `locations.access_sensitivity` at publish; feeds Phase 3's shipped `family_mode` filter (`'sensitive'` sentinel). Corrections via Report flow (D-11). |
| REQ-PENDING | Submitted locations enter pending state until 2 independent GPS verifications | `submissions.status='pending'`, `confirmation_count=1` at submit (creator-initial), gate = `app_config.submission_publish_threshold` (=2). Publish transition is Phase 5. |
| REQ-GPS-VALIDATE | GPS accuracy, freshness, and mock detection enforced server-side | `submit_location` validates client-passed raw GPS sample against `app_config` thresholds (`max_accuracy_m`=50, `max_gps_age_s`=60) and rejects `mocked=true`. §Pitfall 1 covers the mock-detection trust boundary. |
</phase_requirements>

## Summary

Phase 4 is a **write-path phase layered on Phase 3's shipped read path**. The correctness-critical work is a small set of new SECURITY DEFINER RPCs (`submit_location`, `update_access_code`, `get_my_pending_submissions`, `withdraw_submission`) plus a React-Native SubmitFlow wizard (react-hook-form + Zod, both installed) and a submitter-only pending-pin map layer. The live schema, seed, migrations and stack were all inspected directly — this is an integration/extension phase, not greenfield.

**The central open question — how pre-publication bathroom data is stored — is resolved here as Option A: stage the bathroom data on the `submissions` row (adding typed staging columns incl. a `geography` coordinate), and do NOT create a `locations` row until Phase 5's publish gate.** Four pieces of hard schema evidence drive this: (1) `submissions.location_id` is **nullable** — meaningless unless a submission can exist before its location does; (2) the dev seed inserts `locations` rows with **no** submissions rows and Phase 3's read RPCs treat every non-deleted/non-suppressed/non-shadowbanned `locations` row as published — so a pending row placed in `locations` would be **publicly visible immediately**; (3) `schema-contract.md` line 96 mandates "client code must NOT insert directly to `locations` — go through `submissions` + verification gate"; (4) there are **five** functions reading `locations` directly (`search_locations_bbox`, `search_locations_nearby`, `get_location_detail`, `get_locations_in_radius`, `count_locations_within`) — putting pending rows in `locations` means every one of them (and every future reader) must remember to exclude them, a permanent leak surface. Option A keeps pending data entirely OUT of `locations`, so **no existing reader can leak it and Phase 3's shipped RPCs need zero changes.**

The questioner's hypothesis — a `submitter_id = auth.uid()` JOIN against `submissions` *inside* `search_locations_bbox`/`search_locations_nearby` — is **rejected**: it requires modifying and re-verifying Phase 3's reviewed RPCs, breaks the seed (no submissions rows), and spreads pending-visibility logic across five readers. Instead, the submitter's pending pins come from a **separate authed-only RPC** (`get_my_pending_submissions`) rendered as a **separate map layer**, so "visible only to submitter" is enforced by `auth.uid()` scoping in one place.

**Primary recommendation:** Add typed staging columns to `submissions` (Wave 0 migration) → build `submit_location` (validate GPS server-side against `app_config`, insert pending submission with `confirmation_count=1`) → `update_access_code` / `get_my_pending_submissions` / `withdraw_submission` → a high-accuracy `useGpsSample` hook → the RHF+Zod SubmitFlow wizard → the pending-pin layer + pending-status sheet. Do not touch Phase 3's search RPCs.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GPS accuracy / freshness validation | Database (`submit_location` RPC) | Client (UX pre-check) | SC2/SC7 require server-side rejection; client checks are advisory only (untrusted). Thresholds live in `app_config`. |
| Mock-location detection | Client (OS flag) → Database (rejection) | — | Detection signal (`LocationObject.mocked`) exists **only** on-device (Android); server enforces the *rejection* but cannot re-derive the signal (§Pitfall 1). |
| Pre-publication bathroom data storage | Database (`submissions` staging row) | — | Option A: staged on submission until Phase 5 publish; never in `locations` (leak-safe). |
| Pending-pin visibility ("submitter only") | Database (`get_my_pending_submissions`, `auth.uid()`-scoped) | Client (separate map layer) | Single-point `auth.uid()` scoping; Phase 3 search RPCs untouched. |
| Access-code write (submit + update) | Database (`submit_location` / `update_access_code`) | Client (conditional PIN field) | Authed-only SECURITY DEFINER; D-24 confirmation gate; never surfaced in public search. |
| access_sensitivity flag | Database (staged → `locations.access_sensitivity` at publish) | Client (toggle) | Feeds Phase 3's server-side `family_mode` filter; corrections via Report flow (D-11). |
| SubmitFlow form validation | Client (RHF + Zod) | — | Multi-step wizard, conditional PIN field; server re-validates on submit. |
| Withdraw submission | Database (`withdraw_submission` RPC) | Client (confirm dialog) | RLS self-update was dropped (block_fixes); must be an RPC. DELETE the pending row (D-29 "as if never submitted"). |

## Standard Stack

All platform choices are locked from Phase 1. This phase adds **at most one** dependency (Google Places autocomplete — see OQ-1, may be deferrable) and reuses everything else already installed.

### Core (already installed — versions read from `app/package.json`)
| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `expo-location` | `~55.1.10` [VERIFIED: package.json] | High-accuracy GPS sample (`coords`, `accuracy`, `mocked`, `timestamp`) for GpsService (SC1) | Locked GPS module; `LocationObject.mocked` is the Android mock flag [CITED: docs.expo.dev/versions/v55.0.0/sdk/location]. |
| `react-hook-form` | `^7.76.0` [VERIFIED: package.json] | SubmitFlow multi-step form state (SC8) | Installed but unused so far; standard RN form lib. |
| `@hookform/resolvers` | `^5.2.2` [VERIFIED: package.json] | Bridges Zod schema → RHF (`zodResolver`) | Installed; pairs with `zod`. |
| `zod` | `^4.4.3` [VERIFIED: package.json] | SubmitFlow validation incl. conditional PIN (D-17) | Established pattern (`features/auth/validation.ts`); v4 API. |
| `@supabase/supabase-js` | `^2.106.0` [VERIFIED: package.json] | `.rpc()` client for all four new RPCs | Locked backend client. |
| `@tanstack/react-query` | `^5.100.11` [VERIFIED: package.json] | `useMutation` for submit/update/withdraw; `useQuery` for pending pins | Established Phase 2/3 pattern; user-scoped keys. |
| `@rnmapbox/maps` | `^10.3.1` [VERIFIED: package.json] | Pending-pin `ShapeSource`/`CircleLayer` layer (SC9) | Already rendering published pins (`(tabs)/index.tsx`). |
| `@gorhom/bottom-sheet` | `^5.2.14` [VERIFIED: package.json] | Pending-status sheet (D-26) reuses the LocationDetailSheet mechanics | Shipped in Phase 3. |
| `react-native-mmkv` | `^4.3.1` [VERIFIED: package.json] | Optional: persist in-progress wizard draft across steps | Installed (Phase 3 filter store). Only if a draft-persist decision is made — otherwise RHF in-memory state is enough. |
| `expo-haptics` | `~55.0.14` [VERIFIED: package.json] | Confirmation-dialog / success feedback (optional, matches design system) | Installed. |

### Supporting (NET-NEW — install ONLY if OQ-1 confirms Places autocomplete is in Phase 4 scope)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Google Places Autocomplete | *TBD — see OQ-1* [ASSUMED] | D-04 building-address autocomplete mode (label text only — NOT geocoded, per D-05) | Only if Phase 4 must ship live autocomplete. A direct fetch to the Places Autocomplete API (session tokens) returning text predictions avoids a heavy RN wrapper dependency; **needs a Google API key + billing** (Environment Availability). Recommend confirming scope before adding — coords come from GPS, so autocomplete is pure UX sugar and is a candidate to defer like Phase 3 deferred geocoding (OQ-4 there). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **Option A** (stage on `submissions`, no `locations` row until publish) | **Option B** (create `locations` row immediately + JOIN `submissions` in search RPCs) | REJECTED — see §Architecture Pattern 1. Modifies 5 shipped readers, breaks the seed, contradicts nullable `location_id`, permanent leak surface. |
| Option A | **Option C** (create `locations` row + add `locations.published_at` gate column) | REJECTED — still touches all 5 readers and puts unpublished rows in the canonical table; only marginally cleaner than B. |
| Discrete typed staging columns on `submissions` | Single JSONB `payload` column | Prefer discrete typed columns: `coordinates` MUST be `geography(Point,4326)` for pending-pin `ST_X`/`ST_Y` rendering and CHECK constraints; makes Phase 5's publish a near 1:1 column copy. A JSONB blob can't be spatially rendered or constrained. |
| `react-native-google-places-autocomplete` wrapper | Direct Places Autocomplete API fetch | Wrapper is widely used but has maintenance/compat concerns on new RN arch; direct fetch is lighter and returns only text predictions (all D-05 needs). |

**Installation (only if OQ-1 confirms Places in scope):**
```bash
cd app
# Decision pending (OQ-1). If direct-fetch approach: no new package — use the Places API + a key.
# If a wrapper is chosen, slopcheck + npm view it first (see Package Legitimacy Audit).
```
If OQ-1 defers autocomplete, **no packages are installed this phase** — all deps are already present.

## Package Legitimacy Audit

> No net-new package is required unless OQ-1 confirms a Google Places autocomplete *wrapper* library. All four RPCs and the wizard use already-installed, previously-audited dependencies.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none required)* | — | — | — | — | — | No install — all deps present in `package.json` |
| Places autocomplete lib (if OQ-1 = in-scope) | npm | TBD | TBD | TBD | **run before install** | Gated on OQ-1 + a `checkpoint:human-verify` before install |

**slopcheck status:** Not run this pass — no net-new package to check. If OQ-1 adds a Places wrapper, the planner MUST gate it behind a `checkpoint:human-verify` (slopcheck + `npm view <pkg> version` + `npm view <pkg> scripts.postinstall`) before install. Treat any such package as `[ASSUMED]` until verified.

## Architecture Patterns

### System Architecture Diagram

```
                       Client (Expo / React Native)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  SubmitScreen (tabs/submit) — RHF + Zod, 3 steps, auth-gated (D-18)        │
 │   Step1 name/description(+Places toggle D-04)/policyTag/a11y tags/         │
 │         access_sensitivity toggle (D-08..D-15)                            │
 │   Step2 hours / access type / PIN (conditional policy_tag='code_required' │
 │         D-17) / timing tip                                                │
 │   Step3 GPS confirm  ──►  useGpsSample()  (Accuracy.BestForNavigation,    │
 │         returns {coord, accuracy, mocked, timestamp})  [SC1]              │
 │                              │ client pre-check (advisory)                │
 │   confirm dialog (D-15 sensitive / final submit)                          │
 │                              ▼ useMutation                                │
 │  MapScreen (tabs/index)      submit_location(...)                         │
 │   ├─ published pins  ◄── search_locations_bbox (Phase 3, UNCHANGED)       │
 │   └─ PENDING pins    ◄── get_my_pending_submissions()  [NEW layer]        │
 │        tap pending pin ─► Pending-status sheet (D-26/27)                  │
 │             ├─ confirmation_count / expires_at (D-27)                     │
 │             └─ Withdraw (D-28) ─► confirm (D-30) ─► withdraw_submission() │
 │  LocationDetailSheet (published) ─► "Update door code" btn (authed, D-23) │
 │        └─► update_access_code(...)                                        │
 └───────────────┼──────────────────────────────────────────────────────────┘
                 │ supabase.rpc(...) — authed JWT (HTTPS)
                 ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  Supabase PostgREST → SECURITY DEFINER SQL (search_path=public, authed)   │
 │                                                                          │
 │  submit_location(gps sample + bathroom fields)                            │
 │    ├─ if auth.uid() is null → raise 'not authenticated'                   │
 │    ├─ read app_config: max_accuracy_m, max_gps_age_s                      │
 │    ├─ reject: mocked=true | accuracy>max | age>max  → generic error       │
 │    └─ INSERT submissions(status='pending', confirmation_count=1,          │
 │         submitter_id=auth.uid(), coordinates=ST_Point(lng,lat)::geography,│
 │         name, address, policy_tag, access_sensitivity, hours,             │
 │         access_instructions, access_code_confirmed_at, timing_tip)        │
 │  get_my_pending_submissions() → own pending rows as pins                  │
 │  withdraw_submission(id) → DELETE where submitter_id=auth.uid() pending   │
 │  update_access_code(location_id, code, gps) → published locations path    │
 └──────────────────────────────────────────────────────────────────────────┘
        pending data lives ONLY here ─► submissions (NOT locations)
        Phase 5 publish gate later: submission → locations INSERT + status flip
```

### Pattern 1: Pre-publication storage = staging on `submissions` (RESOLVES the central open question)

**What:** `submit_location` writes the bathroom data to **new staging columns on the `submissions` row** and sets `status='pending'`. No `locations` row is created. Phase 5's publish gate later reads the staging columns, INSERTs the `locations` row, sets `submissions.location_id`, and flips `status='published'`.

**Why this over the JOIN-in-search-RPC hypothesis (the four hard facts):**
1. `submissions.location_id` is **nullable** (`20260519010000_remote_schema.sql:189`) — only meaningful if a submission exists before its location.
2. The dev seed (`supabase/seed.sql`) inserts `locations` rows with **no** submissions, and Phase 3's read RPCs (`20260704010002_phase3_search_rpcs.sql`) select from `locations` with only the four-clause moderation filter — **any** `locations` row that passes it is public. A pending row placed there leaks immediately.
3. `schema-contract.md:96`: "Client code must NOT insert directly to `locations` — go through `submissions` + verification gate." `locations` has **no** `status`/`submitter_id` column (verified in schema-contract + database.types.ts).
4. **Five** functions read `locations` directly: `search_locations_bbox`, `search_locations_nearby`, `get_location_detail` (Phase 3), plus the legacy `get_locations_in_radius` and `count_locations_within` (`20260624000000_block_fixes.sql`) — both still granted to `anon`. Option B/C require every one (and all future readers) to exclude pending rows. Option A makes that impossible-to-forget by construction.

**Staging columns to add to `submissions`** (Wave 0 migration, mirror the eventual `locations` types for a clean Phase 5 copy):
```sql
alter table public.submissions
  add column name                     text,
  add column coordinates              geography(Point, 4326),   -- canonical GPS fix (D-05)
  add column address                  text,                     -- free-text label / description (D-01/D-04/D-05)
  add column policy_tag               text,
  add column access_sensitivity       text,                     -- 'sensitive' or null (D-06/D-09)
  add column hours                    jsonb,
  add column access_instructions      text,                     -- the door code (D-17/D-19/D-20)
  add column access_code_confirmed_at timestamptz,              -- D-22 (defaults to created_at at publish)
  add column timing_tip               text;                     -- single submission-time tip (SC4)
-- Optional CHECK: policy_tag in the 4 known values; access_sensitivity in ('sensitive') or null.
-- Spatial index only needed on get_my_pending_submissions if pending volume grows; small per-user.
```

**When to use:** All pre-publication bathroom data. Never `INSERT INTO locations` from client-reachable code in this phase.

### Pattern 2: Server-authoritative GPS validation in `submit_location`

**What:** The client passes the **raw** GPS sample (`lat`, `lng`, `accuracy`, `mocked`, `captured_at`). The RPC re-validates against `app_config` thresholds and raises a **generic** error on failure (SC7 — do not echo the specific reason to the client beyond a generic message; the wizard maps it to friendly copy).

```sql
-- Source: mirrors update_profile auth-gate (20260627000004) + app_config reads (20260704010002)
create or replace function public.submit_location(
  p_name                 text,
  p_lat                  numeric,
  p_lng                  numeric,
  p_accuracy_m           numeric,
  p_mocked               boolean,
  p_captured_at          timestamptz,
  p_policy_tag           text,
  p_address              text        default null,
  p_access_sensitivity   text        default null,   -- 'sensitive' or null (D-09)
  p_hours                jsonb       default null,
  p_access_code          text        default null,   -- only when policy_tag='code_required'
  p_timing_tip           text        default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_accuracy numeric;
  v_max_age_s    numeric;
  v_id           uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';               -- D-18
  end if;

  select value::numeric into v_max_accuracy from public.app_config where key = 'max_accuracy_m';
  select value::numeric into v_max_age_s    from public.app_config where key = 'max_gps_age_s';
  v_max_accuracy := coalesce(v_max_accuracy, 50);
  v_max_age_s    := coalesce(v_max_age_s, 60);

  -- SC2/SC7 — server-side rejection (generic error; no PII/coords in the message).
  if p_mocked is true then
    raise exception 'gps rejected';                    -- mock (see Pitfall 1 on trust boundary)
  end if;
  if p_accuracy_m is null or p_accuracy_m > v_max_accuracy then
    raise exception 'gps rejected';                    -- accuracy
  end if;
  if p_captured_at is null or (now() - p_captured_at) > make_interval(secs => v_max_age_s) then
    raise exception 'gps rejected';                    -- freshness
  end if;

  insert into public.submissions
    (submitter_id, status, confirmation_count,
     name, coordinates, address, policy_tag, access_sensitivity, hours,
     access_instructions, access_code_confirmed_at, timing_tip)
  values
    (auth.uid(), 'pending', 1,                          -- confirmation_count=1 = creator-initial (SC3)
     p_name,
     st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
     p_address, p_policy_tag, p_access_sensitivity, p_hours,
     p_access_code, now(), p_timing_tip)               -- D-22 code_confirmed_at defaults to created_at
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text) from public;
revoke execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text) from anon;
grant  execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text) to authenticated;
```
> `expires_at` defaults to `now() + interval '14 days'` (existing column default) — no need to set it. Note `submit_location` is a **write** RPC → NOT `stable` (omit it; the Phase 3 read RPCs are `stable`, writes must not be).

### Pattern 3: "creator-initial verification event" = `confirmation_count = 1` (NOT a `verification_events` row)

**What:** SC3 says submit "fires creator-initial verification event." Under Option A this is realized as `submissions.confirmation_count = 1` at insert — **not** a `verification_events` row — because `verification_events.location_id` is `NOT NULL references locations(id)` (`schema-contract.md:105`) and no `locations` row exists yet. The two-verification gate is `confirmation_count >= app_config.submission_publish_threshold` (=2); Phase 5's second independent verification increments it and, on reaching threshold, creates the `locations` row.

**Why:** Pre-publish confirmation tracking lives on the submission; `verification_events` is for **published** locations' ongoing confidence (Phase 5/6). This keeps the counting coherent without a nullable-location_id schema change.

**Flag (OQ-2):** If the planner/Phase-5 design requires a literal `verification_events` row at submit time, that forces either making `verification_events.location_id` nullable + adding a `submission_id` FK, OR choosing Option B/C. Surfaced explicitly — do not silently pick.

### Pattern 4: Pending pins as a SEPARATE authed-only RPC + map layer (not a search-RPC change)

**What:** `get_my_pending_submissions()` returns the caller's own pending submissions as pins; the map renders them in a **second** `ShapeSource`/`CircleLayer` using the existing `colors.pinPending` token. Tap → pending-status sheet (D-26). Phase 3's `search_locations_bbox` is **untouched**.

```sql
create or replace function public.get_my_pending_submissions()
returns table (
  id uuid, name text, lat double precision, lng double precision,
  policy_tag text, confirmation_count integer, expires_at timestamptz
)
language plpgsql security definer stable set search_path = public as $$
begin
  if auth.uid() is null then return; end if;           -- anon → no pending pins
  return query
  select s.id, s.name,
         st_y(s.coordinates::geometry)::double precision,
         st_x(s.coordinates::geometry)::double precision,
         s.policy_tag, s.confirmation_count, s.expires_at
  from public.submissions s
  where s.submitter_id = auth.uid()
    and s.status = 'pending';
end; $$;
revoke execute on function public.get_my_pending_submissions() from public;
revoke execute on function public.get_my_pending_submissions() from anon;
grant  execute on function public.get_my_pending_submissions() to authenticated;
```
> `map index.tsx` currently uses `colors.pinPending` only as the **fallback** color in the published-pin `match` expression (lines 106–118) — there is no pending layer yet. Phase 4 adds a distinct pending `ShapeSource` (do NOT cluster it, or cluster separately) and a `handleShapePress` branch that routes pending features to the pending sheet vs. `LocationDetailSheet`.

### Pattern 5: `update_access_code` — published-location code update (D-21/22/24/25)

**What:** Authed-only RPC updating `locations.access_instructions` for an already-published location, resetting `access_code_confirmed_at = now()` (needs a new column on `locations` — see Pattern 6), overwriting without history (D-25). **D-24 requires 1 confirming verification before the overwrite takes effect** — this is the underspecified part (§OQ-3): the new code should be *staged* and confirmed by one other authed presence rather than overwriting immediately. Recommended minimal mechanism: a proposed-code staging pair on `locations` (`pending_access_code text`, `pending_code_proposed_by uuid`) that a second authed user confirms; only then copy into `access_instructions`. Flag for a planner/discuss decision — this mirrors the submission confirmation pattern and is abuse-resistance-critical.

### Pattern 6: `locations.access_code_confirmed_at` column (D-22)

Add `access_code_confirmed_at timestamptz` to `locations` so the update path (and Phase 5 publish) can record code freshness now, avoiding a future backfill migration (D-22's explicit intent). Nullable; set at publish (defaults to the submission's value) and reset to `now()` on confirmed update.

### Pattern 7: SubmitFlow — RHF + Zod multi-step with conditional PIN (D-17)

**What:** `react-hook-form` single form across 3 steps (or per-step schemas), `zodResolver` from `@hookform/resolvers/zod`. Conditional PIN via a Zod `superRefine`/discriminated shape on `policy_tag`.
```ts
// Source: mirrors features/auth/validation.ts (zod v4) + @hookform/resolvers/zod
import { z } from 'zod';
export const submitSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(120),
  address: z.string().max(200).optional(),            // label only (D-05); free-text or Places text
  policyTag: z.enum(['chill_spot', 'purchase_required', 'code_required', 'public_facility']),
  accessSensitivity: z.boolean().default(false),      // toggle → maps to 'sensitive' | null (D-09)
  hours: z.record(z.string(), z.string()).optional(),
  accessCode: z.string().max(100).optional(),         // D-20 generous max, freeform
  timingTip: z.string().max(280).optional(),
}).superRefine((val, ctx) => {
  // PIN field only meaningful when code_required (D-17); it is optional even then (D-19).
  if (val.policyTag !== 'code_required' && val.accessCode) {
    ctx.addIssue({ code: 'custom', path: ['accessCode'], message: 'Door code only applies to Code Required.' });
  }
});
```
Client maps `accessSensitivity === true ? 'sensitive' : null` (D-09) and `accessCode` only when `policy_tag='code_required'`. Server re-validates GPS; client Zod does NOT validate GPS (that's the RPC's job).

### Anti-Patterns to Avoid
- **Inserting a `locations` row at submit time** — violates schema-contract.md:96 and leaks via 5 readers (Pattern 1).
- **Modifying `search_locations_bbox`/`search_locations_nearby` to surface pending pins** — regresses reviewed/tested Phase 3 RPCs and breaks the seed. Use the separate RPC (Pattern 4).
- **Trusting client-reported `accuracy`/`mocked` without server enforcement** — the RPC must re-check accuracy/freshness and reject `mocked=true` (SC2/SC7), even though the mock *signal* originates on-device (Pitfall 1).
- **Returning the specific rejection reason** — SC7 mandates a *generic* error; map to friendly copy client-side (avoid leaking validation internals / aiding spoofing).
- **`stable` on the write RPCs** — `submit_location`/`update_access_code`/`withdraw_submission` mutate; only reads are `stable`.
- **Storing GPS coords as raw numerics** — coordinates must be `geography(Point,4326)` (schema-contract Coordinate Handling), including the submission staging column.
- **A `status='withdrawn'` value** — the `submissions.status` CHECK only allows `pending/published/expired/rejected`. D-29 ("as if never submitted") → **DELETE** the pending row; do not invent a new status value (would need a CHECK migration).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GPS acquisition + mock/accuracy flags | Custom native module | `expo-location` `getCurrentPositionAsync({accuracy: BestForNavigation})` → `LocationObject.mocked/coords.accuracy/timestamp` | First-party; `mocked` is the only mock signal available (Android). |
| Multi-step form state + validation | Custom `useState` step machine | `react-hook-form` + `zodResolver` | Installed; handles dirty/touched/errors/step retention. |
| Conditional field validation (PIN) | Manual if-branches in submit handler | Zod `superRefine` on `policy_tag` | Declarative, testable, one source of truth. |
| Server-state mutation + optimistic UI | Manual fetch + setState | `@tanstack/react-query` `useMutation` + invalidate `['pendingSubmissions', uid]` | Established pattern; retry/error surfaces. |
| Pending-pin visibility scoping | Client-side filter of "my" submissions | `auth.uid()`-scoped RPC (`get_my_pending_submissions`) | Client filtering is a leak; server scopes by identity. |
| GPS threshold constants | Hardcoded 50m/60s in client | `app_config` (`max_accuracy_m`, `max_gps_age_s`) read in the RPC | Admin-tunable; already seeded; single source of truth. |
| Distance/proximity math | JS haversine | PostGIS `ST_Distance`/`ST_DWithin` (Phase 5 proximity; not needed at submit) | Meters-safe; schema-contract forbids degree math. |

**Key insight:** The temptation is to "insert the location now and hide it in the client." Every hide-in-client shortcut is a privacy defect here. The database is the authority for both validation and pending-visibility; the client is a form + a renderer.

## Runtime State Inventory

> Phase 4 is additive (new RPCs, new staging columns, one new `locations` column, new screens). It is NOT a rename/refactor. Categories cleared explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `submissions` and `locations` have **zero** production rows (dev seed only, local). New nullable staging columns add cleanly with no backfill. `locations.access_code_confirmed_at` adds cleanly (nullable). | Add columns (code migrations). No data migration. |
| Live service config | `app_config` GPS thresholds (`max_accuracy_m`=50, `max_gps_age_s`=60, `submission_publish_threshold`=2, `verify_radius_m`=100) already seeded — **no new rows needed** unless a submit-specific threshold is desired. | None (reuse existing). |
| OS-registered state | None. | None. |
| Secrets/env vars | Google Places API key **only if** OQ-1 puts autocomplete in scope (new EAS/`.env` secret). Mapbox tokens already configured. | Conditional on OQ-1. |
| Build artifacts | `app/src/lib/database.types.ts` becomes STALE after the new columns + 4 new RPCs — must regenerate via `supabase gen types`. | Regenerate + commit as part of the migration wave. |

## Common Pitfalls

### Pitfall 1: Server cannot independently *detect* mocking — only *enforce rejection* of the client-reported flag
**What goes wrong:** A plan assumes the RPC can determine "was this GPS mocked" from lat/lng/accuracy. It cannot — the mock signal exists **only** as the OS-provided `LocationObject.mocked` boolean, which is **Android-only** (`undefined` on iOS) [CITED: docs.expo.dev/versions/v55.0.0/sdk/location].
**Why it happens:** SC2 phrasing ("rejected at the RPC layer, not just client-side") reads as if the server derives the signal.
**How to avoid:** The client sends `mocked`; the RPC **enforces the rejection** (`raise` if true) so a modified UI can't skip the check — that is the defensible meaning of "server-side rejection." Accuracy and freshness the server *can* and *must* validate independently (it has the accuracy value and the fix timestamp vs `now()`). On iOS, treat `mocked === undefined` as `false` (iOS does not permit mock locations without a jailbreak). Document this trust boundary in the plan so reviewers don't flag it as a gap.
**Warning signs:** A test asserting the RPC "detects" a mock from coordinates alone — impossible; assert it rejects when `p_mocked=true`.

### Pitfall 2: Freshness spoofing ceiling
**What goes wrong:** Over-promising that the server guarantees a *live* fix. A modified client can send a fresh `captured_at` with stale/fake coords.
**How to avoid:** Validate `now() - captured_at <= max_gps_age_s` (rejects honest-but-stale fixes and obvious replays). True presence is enforced later by Phase 5's second independent verification (`verify_radius_m` proximity to the *now-existing* location). Scope Phase 4's guarantee to "well-formed, fresh-claimed, non-mocked, accurate-enough sample," not "provably physically present."

### Pitfall 3: Placing pending rows where legacy readers can see them
**What goes wrong:** Option B/C put an unpublished row in `locations`; `get_locations_in_radius` and `count_locations_within` (still granted to `anon`, `block_fixes.sql`) have **no** submissions/status filter → the pending bathroom (and its count) leaks to everyone.
**How to avoid:** Option A (Pattern 1) — pending data never enters `locations`.

### Pitfall 4: Access code leaking into public reads
**What goes wrong:** Surfacing `access_instructions` in a public path. Phase 3's `get_location_detail` deliberately **omits** it entirely (OQ-3 resolved there).
**How to avoid:** Keep the door code in the submission staging column (pending) and `locations.access_instructions` (published, never selected by public search). For the D-23 "Update door code" UI to show the current code, use a **dedicated authed-only** RPC (e.g. `get_access_code(location_id)` granted to `authenticated` only) rather than widening the public `get_location_detail` return (§OQ-3). SC6's "only in authenticated LocationDetail reads" is a *privacy boundary*, already satisfied by public search never selecting the column.

### Pitfall 5: Signature-change grant/revoke drift
**What goes wrong:** Supabase auto-grants EXECUTE to `anon`/`authenticated` via ALTER DEFAULT PRIVILEGES, so `revoke ... from public` alone leaves an authed-only write callable by `anon`.
**How to avoid:** For every write RPC, explicitly `revoke ... from public` AND `revoke ... from anon`, then `grant ... to authenticated` (established convention, `20260627000004_profile_rpcs.sql:20-23` comment; Phase 3 PATTERNS.md).

### Pitfall 6: Withdraw via RLS instead of RPC
**What goes wrong:** Trying to let the client UPDATE/DELETE its own submission — but `submissions_update_own` was **dropped** in `block_fixes.sql` precisely to force state changes through RPCs.
**How to avoid:** `withdraw_submission(id)` SECURITY DEFINER RPC, `DELETE FROM submissions WHERE id=$1 AND submitter_id=auth.uid() AND status='pending'` (D-29 "as if never submitted"). Confirm dialog is client-side (D-30).

### Pitfall 7: TDD Guard + coverage on new `features/` code
**What goes wrong:** Writing the `useGpsSample`/submit/withdraw hooks before their tests trips TDD Guard; screens under `src/app/` are excluded but `features/**` requires 100% coverage.
**How to avoid:** Test-first for every `features/locations/` (or `features/submit/`) module; mock `expo-location` and `supabase.rpc` (MSW / jest mock per Phase 3 PATTERNS.md). Keep behavioral logic in `features/`, thin wrappers in `src/app/`.

## Code Examples

### High-accuracy GPS sample hook (SC1)
```ts
// Source: expo-location docs (v55) — Accuracy.BestForNavigation, LocationObject.mocked
import * as Location from 'expo-location';
export interface GpsSample {
  coord: { lat: number; lng: number };
  accuracy: number | null;   // meters (coords.accuracy)
  mocked: boolean;           // Android flag; undefined→false on iOS
  timestamp: number;         // ms since epoch (LocationObject.timestamp)
}
export async function getGpsSample(): Promise<GpsSample | { denied: true }> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return { denied: true };            // SC8 denied-permission state
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,                    // high-accuracy mode (SC1)
  });
  return {
    coord: { lat: pos.coords.latitude, lng: pos.coords.longitude },
    accuracy: pos.coords.accuracy,
    mocked: pos.mocked ?? false,                                      // iOS: undefined → false
    timestamp: pos.timestamp,
  };
}
```

### Submit mutation (client)
```ts
// Source: mirrors features/profile/updateProfile.ts + TanStack useMutation (Phase 3 pattern)
export async function submitLocation(input: SubmitInput): Promise<string> {
  const { data, error } = await supabase.rpc('submit_location', {
    p_name: input.name, p_lat: input.lat, p_lng: input.lng,
    p_accuracy_m: input.accuracy, p_mocked: input.mocked, p_captured_at: new Date(input.timestamp).toISOString(),
    p_policy_tag: input.policyTag, p_address: input.address ?? null,
    p_access_sensitivity: input.sensitive ? 'sensitive' : null,      // D-09
    p_hours: input.hours ?? null,
    p_access_code: input.policyTag === 'code_required' ? (input.accessCode ?? null) : null, // D-17
    p_timing_tip: input.timingTip ?? null,
  });
  if (error) throw error;                                            // map 'gps rejected'/'not authenticated' to friendly copy
  return data as string;                                            // submission id
}
```

## State of the Art

| Old Assumption (project docs) | Current Reality | Impact |
|-------------------------------|-----------------|--------|
| ARCHITECTURE.md `locations.status='pending'/'published'` | No `status` column on `locations`; pending lives on `submissions` (Option A) | Publish state = submission status; `locations` presence = published. |
| CONTEXT open-Q hypothesis: JOIN `submissions` inside search RPCs | Rejected — separate `get_my_pending_submissions` RPC + layer | Phase 3 search RPCs untouched; no seed breakage. |
| SC3 "fires verification event" ⇒ a `verification_events` row | `confirmation_count=1` on the submission (verification_events needs a location_id) | No nullable-FK schema change; Phase 5 owns post-publish verification_events. |
| Phase 3 `get_location_detail` omits access code "until Phase 8" | Phase 4 adds a **separate authed-only** `get_access_code` for the D-23 update UI, not a widening of the public detail RPC | Keeps public detail contract intact. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Option A (stage on `submissions`, no `locations` row until publish) is the intended pre-publication model | Pattern 1 | Medium — it's the best-evidenced design, but it's a design decision Phase 5 depends on; if the project intends Option B/C, staging columns are wasted. Ratify in discuss/plan. |
| A2 | "creator-initial verification event" (SC3) = `confirmation_count=1`, not a `verification_events` row | Pattern 3 / OQ-2 | Medium — if a literal event row is required, needs a `verification_events.location_id` nullable + `submission_id` change or Option B/C. |
| A3 | `LocationObject.mocked` is the only mock signal; Android-only, `undefined` on iOS | Pitfall 1 | Low — verified against Expo v55 docs. |
| A4 | D-04's Google Places autocomplete is required in Phase 4 (vs. deferrable like Phase 3's geocoding) | OQ-1 | Medium — if required, adds a Google API key + billing + possibly a package; if deferrable, zero new deps. |
| A5 | `update_access_code`'s D-24 "1 confirming verification" = stage-then-confirm (proposed-code columns), not immediate overwrite | Pattern 5 / OQ-3 | Medium-High — D-24 is underspecified; wrong mechanism either breaks abuse-resistance (immediate overwrite) or over-builds. Needs a decision. |
| A6 | Published timing-tips storage = a new `timing_tips` table (recent-first list per wireframes); submission-time tip staged on the submission | OQ-4 | Low-Medium — if Phase 5/8 wants a different shape, only the publish-time mapping changes; Phase 4's staging is unaffected. |
| A7 | GPS thresholds reused from existing `app_config` (50m/60s) apply to submission, not a submit-specific value | Runtime State Inventory | Low — thresholds are seeded and described as "for submission and verification." |

## Open Questions

1. **OQ-1 (HIGH — scope + cost): Is Google Places address autocomplete (D-04) in Phase 4 scope, or deferrable?**
   - Known: D-04 locks a Places-autocomplete ↔ free-text toggle on the address field; D-05 makes the address a **label only** (never geocoded — coords come from GPS). Phase 3 deferred all geocoding (its OQ-4).
   - Unclear: Whether Phase 4 ships live autocomplete (new Google API key + billing + possibly a package) or free-text-first (the "describe instead" mode already covers no-address cases; autocomplete is pure UX sugar since coords are GPS).
   - Recommendation: **Confirm before building.** Default to free-text + the D-04 toggle stub without live autocomplete unless the user wants the API cost now. If in scope, prefer a direct Places Autocomplete API fetch (session tokens, text predictions only) over a heavy RN wrapper, and gate any package behind `checkpoint:human-verify`.

2. **OQ-2 (MEDIUM): Does SC3 require a literal `verification_events` row at submit time?**
   - Recommendation: No — use `confirmation_count=1` (Pattern 3). If a literal event is required by Phase 5's design, decide now between (a) `verification_events.location_id` nullable + `submission_id` FK, or (b) Option B/C. Flag to discuss-phase.

3. **OQ-3 (MEDIUM-HIGH): Exact `update_access_code` confirmation mechanism (D-24).**
   - Known: D-24 requires "1 confirming verification before it replaces the old value"; D-25 = overwrite, no history; D-22 = reset `code_confirmed_at`.
   - Unclear: How the "1 confirming verification" is modeled — no code-verification infra exists. Immediate overwrite violates D-24; a full staging+confirm flow may be more than intended.
   - Recommendation: Minimal stage-then-confirm — `locations.pending_access_code` + `pending_code_proposed_by`, confirmed by one *other* authed user's presence, then copied to `access_instructions` and `access_code_confirmed_at=now()`. Ratify the exact gate in discuss/plan; it's abuse-resistance-critical.

4. **OQ-4 (LOW-MEDIUM): Published timing-tips storage shape + whether Phase 4 creates it.**
   - Recommendation: Create a `timing_tips(location_id fk, submitter_id fk null, tip text, created_at)` table (matches wireframes "recent first"); stage the submission-time tip on the submission; publish (Phase 5) writes the row. If the planner prefers, defer table creation to Phase 5 and keep only the staging column in Phase 4. Either way, Phase 4 "stores it correctly" via the staging column.

5. **OQ-5 (LOW): Should `submit_location` also enforce a duplicate/proximity guard** (e.g., reject a submission within N meters of an existing pending/published location)? Not in the D-list or success criteria. Recommendation: out of scope for Phase 4 unless the user asks; note for Phase 5/7 (dedupe is a `reports.report_type='duplicate_location'` concern, RC-02).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project `ebmzhjmmtmldhrojkdqw` | All RPCs | ✓ | live | — |
| PostGIS extension | `geography` staging column, pending-pin `ST_X`/`ST_Y` | ✓ | enabled | — |
| `submissions` table + RLS (`submissions_insert_auth`, `submissions_select_published`, `submissions_service_all`) | Staging + pending reads | ✓ | live | — |
| `app_config` thresholds (`max_accuracy_m`, `max_gps_age_s`, `submission_publish_threshold`) | Server GPS validation + publish gate | ✓ | seeded (50 / 60 / 2) | — |
| `expo-location` (`mocked`, `BestForNavigation`) | GpsService (SC1/SC2/SC7) | ✓ | `~55.1.10` | — |
| `react-hook-form` + `@hookform/resolvers` + `zod` | SubmitFlow (SC8) | ✓ | 7.76 / 5.2.2 / 4.4.3 | — |
| `@gorhom/bottom-sheet` | Pending-status sheet (D-26) | ✓ | `^5.2.14` | — |
| `supabase` CLI (type regen) | Regenerate `database.types.ts` after migrations | ? (unverified on this machine) | — | `npx supabase gen types` or Supabase MCP `generate_typescript_types` |
| Google Places API key | D-04 autocomplete (OQ-1) | ✗ (unverified) | — | Free-text-only mode (defer autocomplete) |
| EAS dev client build | `expo-location` native module | ✓ | Phase 1 established | — |

**Missing dependencies with no fallback (blocking):** none — all core work uses installed, live infrastructure.
**Missing dependencies with fallback:** Google Places API key (fallback: free-text address, defer autocomplete — OQ-1).

## Validation Architecture

`workflow.nyquist_validation` = `true` → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `jest@29.7.0` + `jest-expo@~55` (pinned; do not upgrade) |
| Component | `@testing-library/react-native@^13.3.3` + `@testing-library/jest-native@^5` |
| Network mocking | `msw@^2.14.6` (`msw/native`) — mock `/rest/v1/rpc/submit_location` etc. |
| RPC/RLS correctness | pgTAP against local Supabase (`supabase/tests/*.test.sql`) — same harness as `phase3_read_rpcs.test.sql` |
| Config file | `app/jest.config.js` (100% lines/branches on `src/features/**` + `src/lib/**`; `src/app/` excluded) |
| Quick run command | `cd app && npm test -- <path>` |
| Full suite command | `cd app && npm test` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| REQ-GPS-VALIDATE | RPC rejects `mocked=true`, accuracy>50, age>60 with generic error | integration (SQL) | pgTAP `supabase/tests/phase4_submit.test.sql` | ❌ Wave 0 |
| REQ-GPS-VALIDATE | GpsService returns `{coord,accuracy,mocked,timestamp}`, high-accuracy mode; iOS mocked→false | unit | `npm test -- src/features/locations/useGpsSample.test.ts` (mock expo-location) | ❌ Wave 0 |
| REQ-SUBMIT | `submit_location` inserts pending row, `confirmation_count=1`, coords as geography | integration (SQL) | pgTAP | ❌ Wave 0 |
| REQ-SUBMIT | submit mutation maps fields, sensitive→'sensitive', PIN only when code_required | unit (MSW) | `npm test -- src/features/submit/submitLocation.test.ts` | ❌ Wave 0 |
| REQ-CODE-WRITE | access code never in public search; `update_access_code` D-24 gate + `code_confirmed_at` reset | integration (SQL) | pgTAP | ❌ Wave 0 |
| REQ-PENDING | `get_my_pending_submissions` returns only caller's pending; anon → none | integration (SQL) | pgTAP | ❌ Wave 0 |
| REQ-PENDING | withdraw DELETEs own pending row only | integration (SQL) | pgTAP | ❌ Wave 0 |
| REQ-SENSITIVITY | staged sensitive value survives to `locations` filter semantics | integration (SQL, Phase 5 publish) | pgTAP (Phase 4: staging assert) | ❌ Wave 0 |
| SC8 | SubmitFlow Zod schema: conditional PIN, required name/policy, error states | unit | `npm test -- src/features/submit/submitSchema.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd app && npm test -- <touched feature test>` (fast).
- **Per wave merge:** `cd app && npm test` (full jest, 100% gate on features/lib).
- **Phase gate:** Full jest suite green + pgTAP RPC suite green before `/gsd:verify-work`. TDD Guard enforces test-first on `app/src/**`.
> ⚠ Carryover risk: Phase 3's pgTAP suite has **never executed** (no Docker in this environment — tracked todo `2026-07-07-run-pgtap-suite-on-docker-capable-machine`). Phase 4 adds more RPC correctness that pgTAP is the *only* automated check for. The planner should either (a) run pgTAP on a Docker-capable machine this phase, or (b) explicitly accept the same tracked override and lean on Supabase MCP `apply_migration` + manual RPC probing.

### Wave 0 Gaps
- [ ] `supabase/tests/phase4_submit.test.sql` — RPC correctness (GPS rejection, pending insert, pending-scoping, withdraw, code gate).
- [ ] `src/features/submit/` (or `features/locations/`) test files: `useGpsSample`, `submitLocation`, `submitSchema`, `updateAccessCode`, `withdrawSubmission`, `useMyPendingSubmissions`.
- [ ] MSW handlers for `/rest/v1/rpc/submit_location`, `/update_access_code`, `/get_my_pending_submissions`, `/withdraw_submission`.
- [ ] `expo-location` jest mock (granted/denied, mocked true/false, accuracy/timestamp fixtures).
- [ ] Migration → `supabase gen types` → regenerate `database.types.ts` (new columns + 4 RPCs).

## Security Domain

`security_enforcement` not disabled → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (central) | All four write RPCs require `auth.uid()` (D-18); `raise 'not authenticated'`. |
| V3 Session Management | yes (reuse) | Supabase JWT session (Phase 1/2); no change. |
| V4 Access Control | **yes (central)** | Pending pins scoped by `auth.uid()`; withdraw restricted to own pending row; access code never in public reads; SECURITY DEFINER + `set search_path=public`. |
| V5 Input Validation | **yes (central)** | Zod client schema; server RPC re-validates GPS (accuracy/freshness/mock) + typed params; policy_tag/access_sensitivity CHECK. |
| V6 Cryptography | no | Access code is user data, not a managed secret (stored plaintext like the existing `access_instructions` design; note for a future decision if hashing is ever desired — out of scope). |
| V7 Error Handling / Logging | yes | Generic GPS-rejection error (SC7); no lat/lng/address/email in logs, Sentry, or RPC messages (CLAUDE.md). |

### Known Threat Patterns for {Supabase PostGIS write RPC + Expo GPS + RN wizard}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed GPS (mock provider) | Spoofing | Reject `mocked=true` server-side; enforce accuracy/freshness; Phase 5 proximity is the real presence gate (Pitfall 1/2). |
| Pending bathroom leaked to public | Information Disclosure | Option A — pending data never in `locations`; pending reads `auth.uid()`-scoped (Pattern 1/4, Pitfall 3). |
| Access code exposed in public search | Information Disclosure | Code only in submission staging / `locations.access_instructions`; public search never selects it; authed-only `get_access_code` for the update UI (Pitfall 4). |
| Malicious code overwrite breaks a working door | Tampering / DoS | D-24 confirm-before-overwrite (stage-then-confirm, OQ-3); no immediate overwrite. |
| Authed-only RPC callable by anon (grant drift) | Elevation of Privilege | Explicit `revoke from public` + `revoke from anon` + `grant to authenticated` (Pitfall 5). |
| SECURITY DEFINER search_path attack | Elevation of Privilege | `set search_path = public`, schema-qualified refs. |
| Withdraw someone else's submission | Tampering | RPC `WHERE submitter_id = auth.uid() AND status='pending'` (Pitfall 6). |
| SQL injection | Tampering | Parameterized RPC args only; no dynamic SQL (CLAUDE.md: no raw SQL outside migrations). |
| PII/GPS in logs | Information Disclosure | Scrub coords/address/email everywhere (CLAUDE.md). |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Startup reading:** `AGENTS.md`, `docs/context-router.md`, `.planning/STATE.md`; `app/AGENTS.md` mandates reading `https://docs.expo.dev/versions/v55.0.0/` before writing Expo code (done for `expo-location`).
- **No raw SQL** except migrations / safely-parameterized server code — all DB access via `.rpc()`.
- **GPS coordinates in PostGIS geography only** — including the new `submissions.coordinates` staging column (`geography(Point,4326)`, SRID 4326, `ST_Point(lng,lat)`).
- **No PII in logs** — no coords/address/email in logs, Sentry, RPC error messages (SC7 generic error aligns).
- **TDD Guard (MANDATORY):** test → fail → implement → pass on `app/src/**`; 100% coverage on `src/features/**` + `src/lib/**`; jest pinned 29.7.0. Placeholder/scaffold non-behavioral files created via Bash (Write blocked on them).
- **`android/` never manually edited** (Expo-generated); `app/.env.local` never committed.
- **Multi-agent review gate:** PostGIS/RPC correctness audited by Antigravity; security/privacy by Codex; no commit without APPROVE from both. Maintain `.claude/review-queue.txt` → `/review-gate`.
- **Component Acceptance Checklist (`docs/design/design-system.md` §20)** must be cited in every PLAN.md that creates/modifies a screen (ROADMAP SC10) — applies to SubmitFlow screens, the pending-status sheet, and the LocationDetailSheet "Update door code" extension.
- **Superpowers skills:** `using-superpowers` at task start; `test-driven-development` before behavior; `verification-before-completion` before claiming done.
- **Self-modifying commit gate:** commits touching `.claude/settings.json` permissions or `.claude/hooks/*` stay blocked — not expected this phase.

## Sources

### Primary (HIGH confidence)
- Live migrations (read directly): `20260519010000_remote_schema.sql` (submissions DDL + RLS + app_config `submission_publish_threshold=2`), `20260519020000_fix_schema.sql` (GPS thresholds `max_accuracy_m`/`max_gps_age_s`/`verify_radius_m` + verification_events geography), `20260624000000_block_fixes.sql` (dropped `locations_insert_auth` + `submissions_update_own`; legacy `get_locations_in_radius`/`count_locations_within`), `20260704010002_phase3_search_rpcs.sql` (the three shipped read RPCs + hardening conventions), `20260627000004_profile_rpcs.sql` (auth-gated write RPC pattern).
- `supabase/seed.sql` — dev locations inserted with NO submissions rows (confirms "row in locations = published").
- `docs/schema-contract.md` — field names/types, RLS intent, coordinate handling, line 96 "go through submissions + verification gate".
- `app/src/lib/database.types.ts` — live `submissions`/`locations`/`verification_events` shapes (`location_id` nullable; `verification_events.location_id` not null).
- `app/package.json` (read directly) — installed versions (RHF, zod, resolvers, expo-location, bottom-sheet, mapbox).
- `app/src/app/(tabs)/index.tsx`, `(components)/LocationDetailSheet.tsx`, `features/locations/useCurrentPosition.ts`, `features/auth/validation.ts` — extension points + existing patterns.
- `.planning/phases/03-read-path-map/03-RESEARCH.md` + `03-PATTERNS.md` — shipped RPC/hook/screen conventions to mirror.
- [docs.expo.dev/versions/v55.0.0/sdk/location](https://docs.expo.dev/versions/v55.0.0/sdk/location) — `LocationObject.mocked` (Android-only), `coords.accuracy`, `timestamp`, `Accuracy.BestForNavigation`.

### Secondary (MEDIUM confidence)
- `docs/design/{wireframes,flows,design-system}.md` — SubmitFlow field layout (Step 2 hours/access code/timing tips), timing-tips "recent first" list, §20 Component Acceptance Checklist.

### Tertiary (LOW confidence)
- Google Places Autocomplete package/API choice (OQ-1) — unresolved; no library verified this pass.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps read from installed `package.json`; expo-location API verified against v55 docs.
- Pre-publication storage (Option A): MEDIUM-HIGH — resolved from four hard schema facts, but it is a design decision Phase 5 depends on; ratify in discuss/plan.
- GPS validation + mock trust boundary: HIGH — verified against Expo v55 docs; the "server enforces, OS detects" nuance is a documented platform reality.
- `update_access_code` D-24 mechanism: MEDIUM — decision is underspecified (OQ-3).
- Pitfalls: HIGH — each traced to a specific migration/schema/doc fact.

**Research date:** 2026-07-07
**Valid until:** 2026-08-06 (30 days — stable stack; re-verify if Expo SDK or the Supabase schema changes).
