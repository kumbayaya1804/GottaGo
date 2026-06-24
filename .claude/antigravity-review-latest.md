## Antigravity Review - Phase 1 Complete Retrospective Review

**VERDICT: BLOCK**

### Issues
- **[CRITICAL] [supabase/migrations/20260519010000_remote_schema.sql:87-89](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260519010000_remote_schema.sql#L87-L89)**: The `locations_insert_auth` policy permits any authenticated user to insert new canonical bathroom entries directly into the `locations` table. This bypasses the mandatory `submissions` table and verification gates entirely, violating the SPEC.md requirement that no location publishes without a 2-verification threshold.
  *Required Fix*: Drop this policy. Clients must submit locations to the `submissions` table, and only service-role or secure server-side RPC functions should publish to `locations`.
- **[CRITICAL] [supabase/migrations/20260519010000_remote_schema.sql:218-220](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260519010000_remote_schema.sql#L218-L220)**: The `submissions_update_own` policy allows users to update any column of their own submissions, including `status`. A malicious user can write directly to their submission and set it to `'published'`, bypassing verification checks.
  *Required Fix*: Drop this policy entirely, or add a `with check` clause to ensure users cannot modify fields like `status` or `confirmation_count` (which should only be mutable via service-role or database RPCs).
- **[CRITICAL] [supabase/migrations/20260519010000_remote_schema.sql:393-395](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260519010000_remote_schema.sql#L393-L395)**: The `ratings_select_public` policy allows direct SELECT on the base `ratings` table, which exposes the `user_id` of the rater. This violates SPEC.md privacy rules preventing public correlation of user IDs to sensitive location history.
  *Required Fix*: Revoke SELECT on the base `ratings` table from `anon` and `authenticated`. Create a security-definer view `ratings_public` that excludes `user_id` (or maps it to a safe display name) and grant SELECT on that view.
- **[CRITICAL] [supabase/migrations/](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/)**: The database view `respect_signal_90d` and functions `get_locations_in_radius` and `count_locations_within` are defined in the client-side [database.types.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/lib/database.types.ts) but are completely missing from the SQL migration files. 
  *Required Fix*: Create a new migration file to define these database functions and view so that local databases (e.g. built using `supabase db push`) remain in sync with the production schema.
- **[MAJOR] [docs/schema-contract.md](file:///C:/Users/mrsai/Gotta%20Go/docs/schema-contract.md)**: Extreme schema/spec mismatches exist between the documentation contract and the actual database column definitions:
  * `users.trust_score`: expects `numeric` defaulting to `0` (or `0.0 to 1.0` float); SQL uses `integer` defaulting to `9`.
  * `users.trust_multiplier`: expects default `1`; SQL uses default `0.5`.
  * `users.shadowban_status` and `locations.shadowban_status`: SQL uses `shadowban_status` but `docs/schema-contract.md` and `SPEC.md` refer to `is_shadowbanned`.
  * `verification_events`: expects `verified_at`, `weighted_value`, and `result` columns; SQL uses `timestamp`, `weight`, and `event_type`.
  * `availability_flags`: expects `reported_by` and `flag_type`; SQL uses `reporter_id` and `type`.
  * `reports`: expects `reported_by`, `status`, and `resolved_at`; SQL uses `user_id` and `report_type` and completely lacks moderation status/resolution tracking.
  * `trust_events`: expects `event_type`, `score_delta`, `reason`, `created_at`; SQL uses `action_type`, `delta`, `context_ref`, and `timestamp`.
  *Required Fix*: Align [schema-contract.md](file:///C:/Users/mrsai/Gotta%20Go/docs/schema-contract.md) to match the actual implemented database columns and types to prevent developer confusion.
- **[MAJOR] [app/src/lib/__tests__/](file:///C:/Users/mrsai/Gotta%20Go/app/src/lib/__tests__/)**: Lack of any database test coverage. There are no tests verifying that RLS policies block unauthorized reads/writes, that shadowbanned entities are filtered correctly, or that PostGIS query boundaries function as expected.
  *Required Fix*: Introduce database-layer RLS test scripts (either using pgTAP, a database migration test script, or local Jest/MSW client integration tests simulating different authenticated roles).

### Concerns
- **Trust Score Mismatch**: A new user starting with a `trust_score = 9` (integer) instead of `0` or `1.0` (as a decimal base) will distort the contribution weights if the code expects a decimal between `0` and `1`. This logic needs immediate alignment before Phase 2/3 trust calculations are implemented.

### Verification
- Checked directory structure and database migration files: confirmed missing view and function objects.
- Analyzed RLS policies in `20260519010000_remote_schema.sql` and `20260519030000_fix_rls.sql`: confirmed direct insertion, update, and privacy gaps.
- Executed Jest tests locally: all 4 current tests pass successfully.

### Approved
- **Supabase Client Initialization**: [supabase.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/lib/supabase.ts) is fully correct and properly configured with env guards, `AsyncStorage`, `detectSessionInUrl: false`, and automatic refresh/session persistence.
- **App Layout & Router Structures**: Client application scaffolding conforms to Expo Router expectations.
