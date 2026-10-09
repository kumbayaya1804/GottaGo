---
name: privacy-pii-guard
description: Use when Gotta Go client code adds or changes logging, console output, analytics, crash reporting (Sentry), breadcrumbs, error display, or debug UI, or sends user, session, auth, or location data anywhere outside Supabase.
---

# Skill: Privacy PII Guard

## Purpose

Apply the `SPEC.md` Privacy Requirements to data leaving the app through logs and telemetry.

## Rules

- Raw user IDs never go to client logs, analytics, or crash reports, even alone. `SPEC.md` forbids it. If a crash tool needs a user key, send an opaque per-install or salted-hash value, never `auth.uid()` or `users.id`.
- No email, display name, auth or refresh tokens, session objects, or OAuth callback URLs (they carry codes or tokens) in any log, breadcrumb, or event.
- Precise coordinates go only to approved Supabase RPCs that need them: location search and detail for map behavior (`search_locations_nearby`, `search_locations_bbox`, `get_location_detail`), `submit_location`, Phase 5 pending-candidate discovery (`search_pending_submissions_nearby`, signed-in callers only), and the Phase 5 verification RPC. `SPEC.md` allows them for "approved storage and minimal map behavior". Never in logs, breadcrumbs, analytics, crash reports, or any other sink.
- Raw Supabase or PostgREST error objects can carry payloads. Log the RPC name and error code only.
- Sentry needs `sendDefaultPii: false` and `beforeSend` and `beforeBreadcrumb` scrubbers covering the fields above, plus a test that feeds a tokenized URL, a session object, and coordinates through the scrubber.
- Clear telemetry identity on sign-out.
- `SPEC.md` records no telemetry consent decision yet. Flag any new identity or location telemetry as needing one before it ships.

## Workflow

1. List every sink the change writes to: console, Sentry event, breadcrumb, analytics, UI.
2. For each, list the fields sent and check them against the rules.
3. Require a scrubber test for new telemetry. Code review alone does not show that scrubbing works.
