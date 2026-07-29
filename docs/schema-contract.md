# Schema Contract

Status: aligned with live schema as of 2026-07-10 (confirmed directly against `information_schema`/`list_tables` on project `ebmzhjmmtmldhrojkdqw`). Migrations in `supabase/migrations/` are the authoritative source of truth. This document is a reviewer reference for field names, types, and RLS intent. Adds Phase 4 `locations` PIN-staging columns and previously-undocumented `submissions`, `tags`, `ratings`, and `confidence_scores` tables.

## Database Principles

- PostgreSQL with PostGIS is the source of truth for persisted bathroom coordinates.
- RLS must be enabled for user-owned, moderation-sensitive, and public-facing contribution tables.
- Soft-deleted, shadowbanned, expired, and suppressed records must be filtered below the UI layer.
- Client code must not hold service-role keys or perform admin/moderation writes directly.
- Sensitive audit data should be queryable only by authorized service/admin paths.

## Required Extensions

Expected extensions:
- `postgis`
- `pgcrypto` or equivalent UUID generation support

## Required Coordinate Handling

Bathroom coordinates must use PostGIS:
- Prefer `geography(Point, 4326)` for meter-based distance queries, or `geometry(Point, 4326)` with explicit geography casts for meters.
- All writes must set SRID 4326.
- Distance search must use meter-safe functions and indexes.
- Plain `latitude` and `longitude` columns must not be the canonical persisted location. If used for generated display or migration compatibility, they must be derived and not independently trusted.

Reviewers should reject:
- App-owned canonical `lat`/`lng` fields without PostGIS source of truth
- Distance math in degrees
- Missing spatial indexes on public search paths
- Inconsistent SRID handling

## Live Tables

These are the confirmed live table names in Supabase project `ebmzhjmmtmldhrojkdqw`. Use these names exactly in all code, queries, and migrations.

### `users`

Purpose: user profile and trust state.

Actual fields (as of live schema / migrations):
- `id uuid primary key references auth.users(id) on delete cascade`
- `email text`
- `display_name text`
- `gps_consent boolean` — GDPR GPS consent flag
- `gps_consent_at timestamptz`
- `gamification_points integer default 0`
- `trust_score integer default 9` — ⚠ integer, not numeric; default 9 (Phase 5 must align trust calc with this scale)
- `trust_multiplier numeric default 0.5` — ⚠ default 0.5, not 1.0 (Phase 5 must document intended range)
- `gps_verified_contribution_count integer default 0`
- `leaderboard_position integer`
- `shadowban_status boolean default false` — column name is `shadowban_status`, NOT `is_shadowbanned`
- `admin_override boolean default false`
- `family_mode boolean default false`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Rules:
- Public reads must not expose email, admin_override, or shadowban_status.
- Users may read/update only safe profile fields (display_name, family_mode, gps_consent, gps_consent_at) via SECURITY DEFINER RPC — no direct UPDATE policy.
- trust_score, trust_multiplier, shadowban_status, admin_override are writable only by service/admin paths.

### `locations`

Purpose: canonical bathroom/place record.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `address text`
- `coordinates geography not null` — PostGIS geography(Point,4326); write with `ST_Point(lng,lat)::geography`
- `policy_tag text` — "chill_spot", "purchase_required", "code_required", "public_facility"
- `access_sensitivity text`
- `hours jsonb`
- `is_open_now boolean`
- `data_source text not null default 'community'`
- `confidence_score text` — ⚠ stored as text tier label ('High'/'Medium'/'Low'), NOT a numeric
- `confidence_tier text`
- `verification_count integer default 0`
- `last_verified_at timestamptz`
- `decay_tier text`
- `respect_signal_score numeric default 0`
- `chill_spot boolean default false`
- `failure_event_count integer default 0`
- `access_instructions text`
- `shadowban_status boolean default false` — column name is `shadowban_status`, NOT `is_shadowbanned`
- `deleted_at timestamptz` — soft delete flag
- `suppressed_at timestamptz` — LIVE (added by `20260704010000_phase3_suppressed_at.sql`, Phase 3). NULL means not suppressed. Public search RPCs filter `suppressed_at IS NULL` today (shipped Phase 3 behavior). What does NOT exist yet: the auto-suppress trigger (Phase 7 will set it when same-type report count exceeds threshold) and the `unsuppress_location` admin function — until then the column is only settable by admin/service-role action.
- `timezone text not null default 'America/Los_Angeles'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- `access_code_confirmed_at timestamptz` — (Phase 4) "code last confirmed" timestamp. Live `locations` column is nullable with NO database default (`20260707030000_phase4_access_code_update.sql`) — it is not set on a plain `locations` insert. Three real states: (1) on the staged `submissions` row, `submit_location` writes `now()` at creation time; (2) on a live `locations` row, `confirm_access_code` resets it to `now()` on a confirmed code update; (3) the not-yet-built Phase 5 publish transaction is expected to copy the submission's value onto the new `locations` row (`04-RESEARCH.md`). No UI surfaces it yet (04-CONTEXT.md D-22).
- `pending_access_code text` — (Phase 4) staged replacement PIN awaiting one confirming verification before it overwrites `access_instructions`; max 100 chars (`char_length(pending_access_code) <= 100`).
- `pending_code_proposed_by uuid` — (Phase 4) submitter of the staged `pending_access_code`, for the stage-then-confirm update flow (04-CONTEXT.md D-24).

Rules:
- Public searches must exclude: `deleted_at IS NOT NULL`, `shadowban_status = true`, and `suppressed_at IS NOT NULL`.
- Inserts must validate coordinate shape and SRID (use PostGIS geography type, not raw lat/lng).
- Client code must NOT insert directly to locations — go through `submissions` + verification gate.
- Public queries must not expose contributor identity.

### `submissions` (Phase 4)

Purpose: pre-publication staging for new-location submissions — the only path client code may use to propose a new `locations` row.

Actual fields (as of live schema):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid` — nullable FK to `locations(id)`; the shipped model leaves this null while pending (no draft `locations` row is created pre-publication)
- `submitter_id uuid` — FK to `users(id)`
- `status text default 'pending'` — CHECK constrained to `'pending' | 'published' | 'expired' | 'rejected'`
- `confirmation_count integer default 0`
- `expires_at timestamptz default (now() + 14 days)`
- `name text`, `coordinates geography`, `address text`, `policy_tag text` (CHECK constrained to the same 4 values as `locations.policy_tag`), `access_sensitivity text` (CHECK: null or `'sensitive'`), `hours jsonb`, `access_instructions text`, `access_code_confirmed_at timestamptz`, `timing_tip text`
- `created_at timestamptz default now()`, `updated_at timestamptz default now()`

Rules:
- Direct authenticated INSERT is revoked (`20260708010000_phase4_drop_direct_submission_insert.sql` drops `submissions_insert_auth`) — all client writes go through `submit_location` / `withdraw_submission` (SECURITY DEFINER RPCs); `get_my_pending_submissions()` is the companion read RPC, not a write path.
- Read surface: `get_my_pending_submissions()` is the caller-scoped pending read path (`submitter_id = auth.uid()`). Separately, the base-table RLS policy `submissions_select_published` remains live (`20260519010000_remote_schema.sql`; expressly left untouched by the Phase 4 migration): it allows SELECT of rows with `status = 'published'` plus the caller's own rows. There is NO public read of *other users'* pending submissions, and no JOIN of `submissions` into the public search RPCs (a documented pending-pin design in `docs/design/*.md` describing a JOIN-based approach was superseded by this separate-RPC design; see 04-CONTEXT.md D-26).
- Withdrawal (`withdraw_submission`) hard-deletes the row — no "withdrawn" status is retained (D-29).

### `tags` (key/value, Phase 3+)

Purpose: extensible per-location boolean/attribute flags not worth a dedicated `locations` column — e.g. `has_changing_table`, `has_wheelchair`.

Actual fields (as of live schema):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid` — FK to `locations(id)`
- `key text`, `value text`
- `created_at timestamptz default now()`

Rules:
- Accessibility booleans are read as `tags.find(t => t.key === '<name>')?.value === 'true'`, not dedicated `locations` columns — search RPCs must include tags in the payload or perform a separate lookup (see `docs/design/design-system.md` accessibility overlay notes).

### `ratings` (Phase 8 scope, table live)

Purpose: per-location, per-user 1-5 ratings across three dimensions.

Actual fields (as of live schema):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid`, `user_id uuid` — FKs to `locations(id)`/`users(id)`
- `cleanliness integer` (CHECK 1-5), `accessibility integer` (CHECK 1-5), `convenience integer` (CHECK 1-5)
- `review_text text`
- `created_at timestamptz default now()`, `updated_at timestamptz default now()`

Note: PROJECT.md's "Separate changing surface cleanliness dimension" requirement is not yet a column here — tracked as a future `ratings` migration (RC-03).

### `confidence_scores` (separate from `locations.confidence_score`/`confidence_tier`)

Purpose: dedicated confidence-tier table, one row per location, distinct from the denormalized `confidence_score`/`confidence_tier` text columns still present on `locations` itself.

Actual fields (as of live schema):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid unique` — FK to `locations(id)`
- `score text default 'Low'` — CHECK constrained to `'High' | 'Medium' | 'Low'`
- `computed_at timestamptz default now()`

Note: the relationship between this table and `locations.confidence_score`/`confidence_tier` (which one is authoritative, whether the other is derived/synced) was not re-verified during this doc pass — confirm against the confidence/decay computation logic before Phase 5 trust-engine work treats either as canonical.

### `verification_events`

Purpose: record GPS-verified user checks for a bathroom.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid not null references locations(id)` — Phase 5 (05-01) alters this nullable as part of the polymorphic submission_id/location_id evolution (D-39); not yet changed live as of this doc pass
- `user_id uuid references users(id) on delete set null` — nullable (NOT NULL was dropped by `20260627000003_nullable_user_fks.sql`, which also switched the FK to `ON DELETE SET NULL` for account-deletion anonymization)
- `gps_location geography(Point,4326)` — PostGIS point of user GPS at verification time; the sole raw-coordinate column (the original `gps_lat`/`gps_lon` numeric columns were backfilled into this column and dropped by `20260519020000_fix_schema.sql`)
- `distance_from_location_meters numeric not null` — distance from user to location at time of event
- `weight numeric not null` — verification weight (NOT `weighted_value`)
- `event_type text not null` — type of verification event (NOT `result`)
- `timestamp timestamptz default now()` — event time (NOT `verified_at`)

Note: `gps_accuracy_meters` column was in early design but is not in the live schema. GPS accuracy
validation is enforced via app_config thresholds (max_accuracy_m) at the RPC layer.

Rules:
- Public reads must expose only aggregate effects, not raw user GPS history.
- Writes must reject shadowbanned users' events from affecting public aggregate state (shadowbanned verifications set weight=0).
- Writes must validate GPS freshness (max_gps_age_s), accuracy (max_accuracy_m), and proximity (verify_radius_m) via server-side RPC.
- distance_from_location_meters must be computed server-side via PostGIS, not trusted from client.

### `availability_flags`

Purpose: temporary availability/accessibility state.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid not null references locations(id)`
- `reporter_id uuid not null references users(id)` — column is `reporter_id`, NOT `reported_by`
- `type text not null` — column is `type`, NOT `flag_type`; values: 'currently_closed', 'inaccessible'
- `created_at timestamptz default now()`
- `expires_at timestamptz not null default (now() + interval '24 hours')`

Public access: via `availability_flags_public` view (migration 030000). Direct base-table SELECT
is revoked from anon/authenticated; the view excludes reporter_id and applies expiry + shadowban filters.

Rules:
- Public reads must use the `availability_flags_public` view — base table is not directly readable.
- Expired flags (expires_at <= now()) must not influence active availability.
- Shadowbanned reporters must not influence public state (enforced in the security-definer view).

### `reports`

Purpose: abuse, duplicate, correction, closure, and safety reports.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid not null references locations(id)`
- `user_id uuid not null references users(id)` — column is `user_id`, NOT `reported_by`
- `report_type text not null` — values: 'permanently_closed', 'moved_relocated', 'currently_locked', 'now_requires_purchase', 'staff_pushed_back', 'access_tightened', 'dirty_unsafe', 'changing_station_unusable', 'inaccurate_information'
- `trust_weight numeric not null default 1.0`
- `geographic_distance_meters numeric`
- `details text`
- `created_at timestamptz default now()`

Note: `status` and `resolved_at` columns are NOT in the live schema. Moderation state is handled
via `suppressed_at` on locations (set by auto-suppress trigger when report thresholds exceeded).
Phase 7 may add explicit report status tracking if needed.

Rules:
- Reporter identity (user_id) is not public — `reports_select_own` policy restricts reads to own rows.
- Users can create reports (reports_insert_auth) and read only their own.
- Auto-suppress trigger fires when same-type report count exceeds app_config.report_suppress_threshold.

### `trust_events`

Purpose: audit trail for trust/reputation changes.

Actual fields (as of live schema / migrations):
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid references users(id) on delete set null` — nullable (NOT NULL was dropped by `20260627000003_nullable_user_fks.sql`, which also switched the FK to `ON DELETE SET NULL` for account-deletion anonymization, same as `verification_events.user_id` above)
- `action_type text not null` — column is `action_type`, NOT `event_type`
- `delta integer not null` — column is `delta`, NOT `score_delta`; integer not numeric
- `context_ref text` — column is `context_ref`, NOT `reason`
- `timestamp timestamptz default now()` — column is `timestamp`, NOT `created_at`

Rules:
- Not public — trust_events_select_own restricts to own rows; writes require service_role.
- Written by service-role or SECURITY DEFINER RPCs only (trust_events_service_insert policy).
- Must be auditable: delta sign must match action_type (e.g., negative delta for penalizing action types).
- TDD rule: all trust_events writes must assert delta sign matches action_type in tests.

### `respect_signal_log`

Purpose: raw log of respect signals per location (user behaviors that signal community respect).

Actual fields:
- `id uuid primary key default gen_random_uuid()`
- `location_id uuid not null references locations(id)`
- `event_type text not null`
- `weight numeric not null`
- `timestamp timestamptz default now()`

Rules:
- Written by service-role/RPC triggers only.
- Public reads expose only aggregates (via respect_signal_90d view).

### `respect_signal_90d`

Purpose: rolling 90-day aggregate of respect signals per location (VIEW).

Actual shape (from migration 20260624000000_block_fixes.sql):
- `location_id uuid`
- `total_weight numeric` — sum of weights over last 90 days
- `event_count bigint` — count of signal events over last 90 days

Phase 6 upgrades this to a MATERIALIZED VIEW with CONCURRENT refresh (requires unique index).
Until Phase 6, this is a regular view queried on demand.

Rules:
- Source data must exclude deleted, suppressed, and shadowbanned contributions (enforced at write time into respect_signal_log).
- Public access exposes only aggregate values — no individual event identity.
- Concurrent refresh (Phase 6) must use a unique index on location_id to support CONCURRENTLY.

## RLS Expectations

Every table should state:
- Is RLS enabled?
- Who can select?
- Who can insert?
- Who can update?
- Who can delete?
- Which writes require service/admin authority?

Minimum expectation:
- Public search uses a constrained view/RPC rather than broad table access where practical.
- Users cannot mutate trust, confidence, moderation, or shadowban fields directly.
- Users cannot read raw verification history for other users.
- Admin-only data has explicit policies or is isolated from client access.

## Required Review Checks For Migrations

Reviewers should check:
- PostGIS extension exists before spatial columns/functions
- Spatial indexes exist for search queries
- Foreign keys are present and intentional
- Soft-delete filters are reflected in public views/RPCs
- RLS is enabled before client access
- Policies are tested
- Security-definer functions set `search_path` safely
- No migration stores sensitive GPS samples without a retention decision

