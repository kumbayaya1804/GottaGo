# Schema Contract

Status: provisional. This is the database contract reviewers should enforce until real Supabase migrations supersede it.

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

## Candidate Tables

Actual migrations may choose different names, but must cover these responsibilities.

### `profiles`

Purpose: user profile and trust state.

Expected fields:
- `id uuid primary key references auth.users(id)`
- `display_name text`
- `trust_score numeric not null default 0`
- `trust_multiplier numeric not null default 1`
- `gps_verified_contribution_count integer not null default 0`
- `is_shadowbanned boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:
- Public reads must not expose email or sensitive moderation notes.
- Users may read/update only allowed profile fields for themselves.
- Trust and shadowban fields should be writable only by service/admin paths.

### `bathroom_locations`

Purpose: canonical bathroom/place record.

Expected fields:
- `id uuid primary key`
- `name text`
- `location geography(Point, 4326) not null`
- `created_by uuid references profiles(id)`
- `confidence_score numeric not null default 0`
- `is_shadowbanned boolean not null default false`
- `suppressed_at timestamptz`
- `deleted_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:
- Public searches must exclude `deleted_at is not null`, `suppressed_at is not null`, and `is_shadowbanned = true`.
- Inserts must validate coordinate shape and SRID.
- Public result queries must avoid exposing contributor identity unless intentionally approved.

### `verification_events`

Purpose: record GPS-verified user checks for a bathroom.

Expected fields:
- `id uuid primary key`
- `location_id uuid not null references bathroom_locations(id)`
- `user_id uuid not null references profiles(id)`
- `verified_at timestamptz not null default now()`
- `gps_accuracy_meters numeric`
- `distance_from_location_meters numeric`
- `weighted_value numeric not null default 1`
- `result text not null`
- `created_at timestamptz not null default now()`

Rules:
- Public reads should expose only aggregate effects, not raw user visit history.
- Writes must reject shadowbanned users from affecting public aggregate state.
- Writes must validate GPS freshness, accuracy, and distance rules.

### `availability_flags`

Purpose: temporary availability/accessibility state.

Expected fields:
- `id uuid primary key`
- `location_id uuid not null references bathroom_locations(id)`
- `reported_by uuid references profiles(id)`
- `flag_type text not null`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`

Rules:
- Public reads must filter `expires_at > now()`.
- Expired flags must not influence active availability.
- Shadowbanned reporters must not influence public state.

### `reports`

Purpose: abuse, duplicate, correction, closure, and safety reports.

Expected fields:
- `id uuid primary key`
- `location_id uuid references bathroom_locations(id)`
- `reported_by uuid references profiles(id)`
- `report_type text not null`
- `status text not null default 'open'`
- `details text`
- `created_at timestamptz not null default now()`
- `resolved_at timestamptz`

Rules:
- Reporter identity is not public.
- Normal users can create reports and read only permitted status.
- Moderation status transitions require service/admin authority.

### `trust_events`

Purpose: audit trail for trust/reputation changes.

Expected fields:
- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `event_type text not null`
- `score_delta numeric not null`
- `reason text`
- `created_at timestamptz not null default now()`

Rules:
- Not public.
- Written by service/admin or trusted server logic only.
- Must be auditable and deterministic enough to explain trust changes.

### `respect_signal_90d`

Purpose: recent rolling aggregate for quality/respect signal.

Expected shape:
- `location_id uuid`
- 90-day aggregate counts or weighted scores
- last refreshed timestamp or documented refresh mechanism

Rules:
- Must exclude deleted, suppressed, shadowbanned, and expired inputs.
- Refresh strategy must be documented.
- Public access should expose only aggregate values safe for display.

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

