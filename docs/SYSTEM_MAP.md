# Gotta Go — System Map

**Status:** Current as of Phase 4 close + pre-Phase-5 P0 remediation (commit `c5f4f7b`)
**Last Updated:** 2026-07-10
**Source:** Confirmed directly against live Supabase schema (project `ebmzhjmmtmldhrojkdqw`) and `supabase/migrations/*.sql`, not a recovery-era guess. See `docs/schema-contract.md` for full column-level detail — this file is a high-level map only.

## 1. Data Core (Supabase + PostGIS)

### Tables (live)
- **`users`**: `trust_score` **integer**, default 9 (NOT a 0.0-1.0 float). `trust_multiplier` **numeric**, default 0.5 (NOT 1.0). `shadowban_status boolean`. `family_mode boolean` (Phase 3). `gps_verified_contribution_count integer`.
- **`locations`**: `coordinates` **geography(Point,4326)** (NOT `geometry`). `confidence_score`/`confidence_tier` are **text tiers** (`'High'/'Medium'/'Low'`), not a numeric that "degrades" as a raw float. `decay_tier` is **text**, not integer. `shadowban_status`, `deleted_at`, `suppressed_at` (Phase 3, auto-suppress trigger). Phase 4 added `access_code_confirmed_at`, `pending_access_code`, `pending_code_proposed_by` (PIN stage-then-confirm).
- **`submissions`** (Phase 4): pre-publication staging; `status` is **text NOT NULL** CHECK-constrained to `pending|published|expired|rejected` (not a Postgres enum); `location_id` stays NULL while pending (no draft `locations` row).
- **`tags`** (key/value): accessibility/attribute flags (`has_changing_table`, `has_wheelchair`) not worth dedicated columns.
- **`ratings`**: cleanliness/accessibility/convenience, 1-5 each, per user per location.
- **`confidence_scores`**: a *separate* one-row-per-location tier table (`'High'/'Medium'/'Low'`) distinct from `locations.confidence_score`/`confidence_tier` — relationship between the two not yet reconciled, flag for Phase 5.
- **`verification_events`**: `location_id`, `user_id`, `gps_location` (geography point), `distance_from_location_meters`, `weight`, `event_type`, `timestamp`. There is **no `is_gps_verified` column** — that was a May-era guess.
- **`respect_signal_log`** / **`respect_signal_90d`**: raw log + rolling 90-day view (regular view today; Phase 6 upgrades to a `CONCURRENTLY`-refreshed materialized view).
- **`availability_flags`**, **`reports`**, **`trust_events`**, **`failure_events`**, **`app_config`**: see `docs/schema-contract.md`.

## 2. Live RPCs (SECURITY DEFINER, confirmed 2026-07-10)

**Read path (Phase 3):** `search_locations_bbox(...)`, `search_locations_nearby(user_lat, user_lng, ...)`, `get_location_detail(location_id, user_lat, user_lng)` — all return explicit public-safe columns (never `SELECT *`/`SETOF locations`) and enforce `family_mode`/shadowban/suppression filters server-side. Only `search_locations_nearby` and `get_location_detail` take a caller lat/lng and return a server-computed `distance_m`; `search_locations_bbox` has no caller position input and its return table ends at `chill_spot` (no distance field). The two legacy Phase 1 full-row radius RPCs (`get_locations_in_radius`, `count_locations_within`) were retired entirely (2026-07-10 remediation) — do not recreate them.

**Submission path (Phase 4):** `submit_location(p_name, p_lat, p_lng, p_accuracy_m, p_mocked, p_captured_at, p_policy_tag, p_address, p_access_sensitivity, p_hours, p_access_code, p_timing_tip) returns uuid`, `get_my_pending_submissions()` (no args, `auth.uid()`-scoped), `withdraw_submission(p_submission_id)`, `update_access_code(p_location_id, p_code)` (stage), `confirm_access_code(p_location_id)` (confirm), `get_access_code(p_location_id)` (signed-in only).

**Profile/auth:** `update_profile`, `delete_account`, `get_profile_stats`, `set_gps_consent`, `check_display_name_available`, `handle_new_user` (trigger).

**Verification/trust-engine RPCs are NOT yet built** — Phase 5 scope. `verification_events` currently has zero client-writable path (`verification_events_insert_auth` policy dropped 2026-07-10; client-role table privileges revoked to `authenticated: SELECT` only, `anon`: none). All future verification writes must go through a new hardened Phase 5 RPC.

## 3. The Trust Engine — NOT YET BUILT (Phase 5 scope)

The May-era formulas previously guessed here (`ST_DWithin` verification check, `trust_multiplier * (is_gps_verified ? 1.0 : 0.5)` weighting) do not correspond to any shipped function — there is no verification-weight or confidence-decay RPC live yet. See `.planning/phases/05-trust-engine-verification/05-READINESS.md` and `05-DISCUSSION-DRAFT.md` for the actual open design questions (pending-candidate discovery, pre-publication event modeling, trust/decay formulas, the 48-hour no-flag route, numeric confidence authority) that must be resolved before this section can describe real behavior.

## 4. Security Guardrails (confirmed live)

- Shadowbanning enforced server-side: all three Phase 3 search RPCs filter `shadowban_status`/`deleted_at`/`suppressed_at` — not a UI-layer concern.
- RLS enabled on every table listed above. `verification_events` client-role write access fully revoked (2026-07-10) — RLS denies rows, and table-level grants were separately locked down (`anon`: none, `authenticated`: SELECT only) so no unused write/DDL privilege remains as residual attack surface.
- Base-table `SELECT` on `locations` is revoked from `anon`/`authenticated` — the three Phase 3 RPCs are the only public read path.

## 5. Audit Log

| Date | Scope | Verdict | Notes |
| :--- | :--- | :--- | :--- |
| 2026-05-18 | Architectural Mapping | INITIALIZED | Baseline established from recovered metadata (superseded — types/formulas below were guesses, several wrong; see corrections above). |
| 2026-07-10 | Item 4 authority-doc refresh | RECONCILED | Rewritten against live `information_schema`/`list_tables`/`list_migrations` output, not recovered-metadata guesses. Antigravity/Codex have not independently re-reviewed this specific doc pass — treat as Claude-verified, not yet cross-AI-approved. |
