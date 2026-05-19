# Gotta Go — System Map

**Status:** Recovery Phase (Architectural Baseline)
**Last Updated:** May 18, 2026
**Lead Auditor:** Gemini

## 1. Data Core (Supabase + PostGIS)

### Tables (Planned/Recovered)
- **`users`**:
  - `id`: uuid (Primary Key)
  - `trust_score`: float (0.0 to 1.0)
  - `trust_multiplier`: float (base weight for contributions)
  - `gps_verified_contribution_count`: integer
  - `shadowban_status`: boolean
- **`locations`**:
  - `id`: uuid (Primary Key)
  - `coordinates`: geometry(Point, 4326)
  - `confidence_score`: float (degrades over time)
  - `decay_tier`: integer (determines speed of confidence loss)
  - `shadowban_status`: boolean
  - `deleted_at`: timestamptz (soft delete)
- **`verification_events`**:
  - `id`: uuid
  - `user_id`: fkey -> users.id
  - `location_id`: fkey -> locations.id
  - `weight`: float (calculated at time of event)
  - `is_gps_verified`: boolean
- **`respect_signal_log`**:
  - Raw log of signals used to refresh the materialized view.

### Materialized Views
- **`respect_signal_90d`**:
  - Rolling 90-day aggregation of weighted verification signals per location.

## 2. The Trust Engine

### Verification Logic
- **GPS Verification**: Calculated via `ST_DWithin(user_location, location_coordinates, threshold_meters)`.
- **Contribution Weight**: `user.trust_multiplier * (is_gps_verified ? 1.0 : 0.5)`.

### Confidence Decay
- **Mechanism**: Confidence scores for locations degrade if no fresh `verification_events` occur.
- **Audit Requirement**: Formula must be verified for "reputation death spirals" (where valid but low-traffic locations disappear).

## 3. Security Guardrails

### Shadowbanning
- **Requirement**: Must be enforced at the **query layer** using Supabase RLS or Views.
- **Implementation Goal**: `WHERE shadowban_status = false` must be implicit in all public-facing API calls.

### Row Level Security (RLS)
- **Owner-only**: Users can only update their own profiles.
- **Verified-only**: Certain actions (e.g., adding new locations) may require a minimum `trust_score`.

## 4. Audit Log (Gemini)

| Date | Scope | Verdict | Notes |
| :--- | :--- | :--- | :--- |
| 2026-05-18 | Architectural Mapping | **INITIALIZED** | Baseline established from recovered metadata. |
