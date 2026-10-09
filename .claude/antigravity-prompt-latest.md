<!-- RETIRED: this scope (sha256:a747ea14…) was committed as 66e992a on 2026-10-09. Do not review it again. -->
<!-- review-manifest
reviewer: antigravity
generated_at: 2026-09-29T02:12:32Z
scope_hash: sha256:a747ea14046678d503e4581795c5da9980fec6ae5eb0de0803fddc1b105a3e5f
review_id: rv-20260929T021232Z-43ad8d04
risk_level: high
runtime_required: true
blind_review: true
queue:
  - app/src/lib/database.types.ts
  - app/src/features/submit/submitLocation.ts
diff_base: HEAD
context_tier: 1
-->

# Antigravity Review Packet: Regenerate database.types.ts for Phase 5 and remove the submit_location type bridge, Attempt 1

You are Antigravity, the architecture and data-integrity reviewer. This packet is a set of claims, not proof. Inspect every queued path from disk and confirm the staged scope matches `scope_hash`. Policy `.claude/antigravity-review-policy.json` governs your allowed verdicts: during probation they are ADVISORY (clean), REQUEST CHANGES, and BLOCK.

## Required Skills

- `.claude/skills/artifact_qa_gate.md` shared core plus its **Antigravity Overlay**.
- `superpowers:using-superpowers` first.
- `superpowers:verification-before-completion` before any positive verdict.
- Project domain skills (`postgis_optimizer.md`, `rls_security_guard.md`, `trust_engine_validator.md`) only when the queue touches their boundary. Name any unavailable skill as a gap.

## Queue (2 paths, all staged)

Modified (2):
- `app/src/lib/database.types.ts`
- `app/src/features/submit/submitLocation.ts`

## Task Goal

Plan 05-02 Task 4. The four Phase 5 migrations (`20260731000000` to `20260731000300`) are now applied to the production Supabase project. `app/src/lib/database.types.ts` still described the older schema, so `submitLocation.ts` carried a temporary type intersection adding the two newer `submit_location` parameters. This batch (1) replaces `database.types.ts` with types generated from the live schema and (2) deletes the intersection so `submitLocation.ts` uses the generated `Args` type directly. No runtime behavior, SQL, or test changes.

## Neutral Claim Table

| # | Claim | Authority source | Disproof to attempt | Evidence needed |
|---|-------|------------------|---------------------|-----------------|
| C1 | `database.types.ts` is byte-identical to what the live project's type generator emits now. | The live project `ebmzhjmmtmldhrojkdqw`, via the Supabase type-generation tool or CLI | Regenerate independently and compare byte for byte; look for any hand edit or transcription slip | Command run, comparison result |
| C2 | The diff against the previous file contains only Phase 5 schema additions plus generator boilerplate: `locations.confidence_value`, `submissions.publication_seen_at`, the `notification_outbox` table, the functions `acknowledge_submission_publication`, `confidence_tier_for`, `get_my_unseen_submission_publications`, `verify_location`, the two new optional `submit_location` parameters, and a parenthesization change in five generic helper types. | `git diff HEAD -- app/src/lib/database.types.ts` and the migrations in `supabase/migrations/2026073100*.sql` | Find any changed line that is not explained by a migration or by the generator template | Diff read against the migrations |
| C3 | The generated `submit_location` `Args` matches the deployed 14-argument function, including that the two accessibility parameters are optional with SQL defaults, and `submitLocation.ts` still sends both explicitly. | Live function signature, `20260731000300_phase5_verify_and_publish.sql`, `submitLocation.ts` | Compare parameter names, types, and optionality with the live function; find a call site that would now fail to type-check or send a wrong key | Function signature query, `tsc` result |
| C4 | Removing the intersection changes no runtime behavior; the emitted JavaScript for `submitLocation.ts` is unchanged apart from erased types. | The diff of `submitLocation.ts` (type alias only) | Find any non-type change in the file diff | Diff, test results |
| C5 | No other file in `app/src` depended on the removed bridge or on a type that changed shape in the regenerated file. | `tsc --noEmit`, grep for the removed names and for consumers of the changed types | Search for consumers of `Database`, `Tables`, `Functions`, `Constants` whose inferred types could narrow or widen | `tsc` result, grep |
| C6 | Regenerated types expose no server-only surface to the client that was not already reachable: the `notification_outbox` type is present because the table exists, but the client has no privilege on it. | Live grants on `public.notification_outbox`, `20260731000200_phase5_notification_outbox.sql` | Query the live grants for `anon` and `authenticated`; look for any app code that reads the table | Grant query, grep |

## User Advocacy Gate

Does this decision serve someone with 60 seconds before an emergency? This batch is types only. Its value to that person is indirect: the app sends a request the server accepts, so a contribution does not fail with a generic error because the client and server disagreed about a function signature. Reviewers should say whether the change could mask a signature mismatch (a type that compiles but sends the wrong argument) and whether any failure state leaves a contributor without a clear outcome.

## Runtime Boundary And Mock Audit

- The types are generated from the live production schema, which already has the four migrations applied; that state was verified separately with read-only queries (ledger, function signatures, grants).
- Nothing here executes SQL. The app tests mock the Supabase client, so they prove request shaping and UI states, not server behavior or that the generated types match the server. C1 and C3 are the only claims that tie the types to the live schema.
- Not exercised: a real device, a real submit against the live database, push delivery.

## Verification

Run on the working tree before this packet:

- In `app/`: `npx tsc --noEmit` exit 0; `npx eslint src --quiet` exit 0; `npx jest --coverage` exit 0 with 46 suites and 397 tests.
- The diff of `database.types.ts` was read line by line against the expected Phase 5 additions; nothing else differs except the helper-type parenthesization.
- Live read-only checks (done earlier, same day): the migration ledger lists the four Phase 5 versions; exactly one `submit_location` with 14 arguments exists; the outbox has row-level security on and no grants to `anon` or `authenticated`.

The file was written from the generator's output by the implementer, not produced by a CLI redirect, so a byte comparison by the reviewer is the check that matters.

## Blind-Review Rules

- Exclude `.claude/reviews/**` and every `.claude/*-review-latest.md` file from every repository-wide search, including `rg`, `grep -r`, and `git grep` (for example `rg ... -g '!.claude/reviews/**' -g '!.claude/*-review-latest.md'`). If an unscoped search surfaces archived reviewer text, stop using the result and report it.
- Do not read the other reviewer's packet, verdict, or archives.
- The only gate command you may run is the fingerprint preflight: `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`.
- Read deleted files with `git show HEAD:<path>`.
- A problem found only in lines this batch did not change is a `NOTE (follow-up)` under `### Follow-ups`, not REQUEST CHANGES, unless the batch's change depends on it or directly contradicts it. BLOCK-level safety problems block wherever they are.

## Staged Diff

### app/src/lib/database.types.ts

```diff
diff --git a/app/src/lib/database.types.ts b/app/src/lib/database.types.ts
index 864f9a2..4e6e13b 100644
--- a/app/src/lib/database.types.ts
+++ b/app/src/lib/database.types.ts
@@ -154,6 +154,7 @@ export type Database = {
           chill_spot: boolean | null
           confidence_score: string | null
           confidence_tier: string | null
+          confidence_value: number | null
           coordinates: unknown
           created_at: string | null
           data_source: string
@@ -183,6 +184,7 @@ export type Database = {
           chill_spot?: boolean | null
           confidence_score?: string | null
           confidence_tier?: string | null
+          confidence_value?: number | null
           coordinates: unknown
           created_at?: string | null
           data_source?: string
@@ -212,6 +214,7 @@ export type Database = {
           chill_spot?: boolean | null
           confidence_score?: string | null
           confidence_tier?: string | null
+          confidence_value?: number | null
           coordinates?: unknown
           created_at?: string | null
           data_source?: string
@@ -235,6 +238,88 @@ export type Database = {
         }
         Relationships: []
       }
+      notification_outbox: {
+        Row: {
+          attempt_count: number
+          claim_expires_at: string | null
+          claim_token: string | null
+          claimed_at: string | null
+          created_at: string
+          delivered_at: string | null
+          expo_ticket_id: string | null
+          failed_at: string | null
+          id: string
+          last_error: string | null
+          location_id: string | null
+          max_attempts: number
+          next_attempt_at: string
+          receipt_checked_at: string | null
+          recipient_user_id: string
+          submission_id: string
+          ticket_created_at: string | null
+        }
+        Insert: {
+          attempt_count?: number
+          claim_expires_at?: string | null
+          claim_token?: string | null
+          claimed_at?: string | null
+          created_at?: string
+          delivered_at?: string | null
+          expo_ticket_id?: string | null
+          failed_at?: string | null
+          id?: string
+          last_error?: string | null
+          location_id?: string | null
+          max_attempts?: number
+          next_attempt_at?: string
+          receipt_checked_at?: string | null
+          recipient_user_id: string
+          submission_id: string
+          ticket_created_at?: string | null
+        }
+        Update: {
+          attempt_count?: number
+          claim_expires_at?: string | null
+          claim_token?: string | null
+          claimed_at?: string | null
+          created_at?: string
+          delivered_at?: string | null
+          expo_ticket_id?: string | null
+          failed_at?: string | null
+          id?: string
+          last_error?: string | null
+          location_id?: string | null
+          max_attempts?: number
+          next_attempt_at?: string
+          receipt_checked_at?: string | null
+          recipient_user_id?: string
+          submission_id?: string
+          ticket_created_at?: string | null
+        }
+        Relationships: [
+          {
+            foreignKeyName: "notification_outbox_location_id_fkey"
+            columns: ["location_id"]
+            isOneToOne: false
+            referencedRelation: "locations"
+            referencedColumns: ["id"]
+          },
+          {
+            foreignKeyName: "notification_outbox_recipient_user_id_fkey"
+            columns: ["recipient_user_id"]
+            isOneToOne: false
+            referencedRelation: "users"
+            referencedColumns: ["id"]
+          },
+          {
+            foreignKeyName: "notification_outbox_submission_id_fkey"
+            columns: ["submission_id"]
+            isOneToOne: true
+            referencedRelation: "submissions"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
       ratings: {
         Row: {
           accessibility: number | null
@@ -413,6 +498,7 @@ export type Database = {
           location_id: string | null
           name: string | null
           policy_tag: string | null
+          publication_seen_at: string | null
           status: string
           submitter_id: string | null
           timing_tip: string | null
@@ -432,6 +518,7 @@ export type Database = {
           location_id?: string | null
           name?: string | null
           policy_tag?: string | null
+          publication_seen_at?: string | null
           status?: string
           submitter_id?: string | null
           timing_tip?: string | null
@@ -451,6 +538,7 @@ export type Database = {
           location_id?: string | null
           name?: string | null
           policy_tag?: string | null
+          publication_seen_at?: string | null
           status?: string
           submitter_id?: string | null
           timing_tip?: string | null
@@ -754,7 +842,12 @@ export type Database = {
       }
     }
     Functions: {
+      acknowledge_submission_publication: {
+        Args: { p_submission_id: string }
+        Returns: undefined
+      }
       check_display_name_available: { Args: { name: string }; Returns: boolean }
+      confidence_tier_for: { Args: { p_value: number }; Returns: string }
       confirm_access_code: {
         Args: { p_location_id: string }
         Returns: undefined
@@ -791,6 +884,15 @@ export type Database = {
           policy_tag: string
         }[]
       }
+      get_my_unseen_submission_publications: {
+        Args: never
+        Returns: {
+          location_id: string
+          name: string
+          published_at: string
+          submission_id: string
+        }[]
+      }
       get_profile_stats: { Args: never; Returns: Json }
       search_locations_bbox: {
         Args: {
@@ -862,6 +964,7 @@ export type Database = {
           p_accuracy_m: number
           p_address?: string
           p_captured_at: string
+          p_changing_table?: boolean
           p_hours?: Json
           p_lat: number
           p_lng: number
@@ -869,6 +972,7 @@ export type Database = {
           p_name: string
           p_policy_tag: string
           p_timing_tip?: string
+          p_wheelchair?: boolean
         }
         Returns: string
       }
@@ -880,6 +984,17 @@ export type Database = {
         Args: { new_display_name?: string; new_family_mode?: boolean }
         Returns: undefined
       }
+      verify_location: {
+        Args: {
+          p_accuracy_m: number
+          p_captured_at: string
+          p_lat: number
+          p_lng: number
+          p_mocked: boolean
+          p_submission_id: string
+        }
+        Returns: Json
+      }
       withdraw_submission: {
         Args: { p_submission_id: string }
         Returns: undefined
@@ -902,12 +1017,12 @@ export type Tables<
   DefaultSchemaTableNameOrOptions extends
     | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
     | { schema: keyof DatabaseWithoutInternals },
-  TableName extends DefaultSchemaTableNameOrOptions extends {
+  TableName extends (DefaultSchemaTableNameOrOptions extends {
     schema: keyof DatabaseWithoutInternals
   }
     ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
         DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
-    : never = never,
+    : never) = never,
 > = DefaultSchemaTableNameOrOptions extends {
   schema: keyof DatabaseWithoutInternals
 }
@@ -931,11 +1046,11 @@ export type TablesInsert<
   DefaultSchemaTableNameOrOptions extends
     | keyof DefaultSchema["Tables"]
     | { schema: keyof DatabaseWithoutInternals },
-  TableName extends DefaultSchemaTableNameOrOptions extends {
+  TableName extends (DefaultSchemaTableNameOrOptions extends {
     schema: keyof DatabaseWithoutInternals
   }
     ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
-    : never = never,
+    : never) = never,
 > = DefaultSchemaTableNameOrOptions extends {
   schema: keyof DatabaseWithoutInternals
 }
@@ -956,11 +1071,11 @@ export type TablesUpdate<
   DefaultSchemaTableNameOrOptions extends
     | keyof DefaultSchema["Tables"]
     | { schema: keyof DatabaseWithoutInternals },
-  TableName extends DefaultSchemaTableNameOrOptions extends {
+  TableName extends (DefaultSchemaTableNameOrOptions extends {
     schema: keyof DatabaseWithoutInternals
   }
     ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
-    : never = never,
+    : never) = never,
 > = DefaultSchemaTableNameOrOptions extends {
   schema: keyof DatabaseWithoutInternals
 }
@@ -981,11 +1096,11 @@ export type Enums<
   DefaultSchemaEnumNameOrOptions extends
     | keyof DefaultSchema["Enums"]
     | { schema: keyof DatabaseWithoutInternals },
-  EnumName extends DefaultSchemaEnumNameOrOptions extends {
+  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
     schema: keyof DatabaseWithoutInternals
   }
     ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
-    : never = never,
+    : never) = never,
 > = DefaultSchemaEnumNameOrOptions extends {
   schema: keyof DatabaseWithoutInternals
 }
@@ -998,11 +1113,11 @@ export type CompositeTypes<
   PublicCompositeTypeNameOrOptions extends
     | keyof DefaultSchema["CompositeTypes"]
     | { schema: keyof DatabaseWithoutInternals },
-  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
+  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
     schema: keyof DatabaseWithoutInternals
   }
     ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
-    : never = never,
+    : never) = never,
 > = PublicCompositeTypeNameOrOptions extends {
   schema: keyof DatabaseWithoutInternals
 }
```

### app/src/features/submit/submitLocation.ts

```diff
diff --git a/app/src/features/submit/submitLocation.ts b/app/src/features/submit/submitLocation.ts
index a5fc598..82dc597 100644
--- a/app/src/features/submit/submitLocation.ts
+++ b/app/src/features/submit/submitLocation.ts
@@ -2,23 +2,7 @@ import { supabase } from '../../lib/supabase';
 import type { Database } from '../../lib/database.types';
 import type { SubmitInput } from './types';
 
-/**
- * TEMPORARY BRIDGE — remove when 05-02 Task 4 runs `supabase gen types`.
- *
- * The generated `Args` type still describes the OLD 12-argument submit_location
- * signature, because `database.types.ts` can only be regenerated against the LIVE
- * schema and the Phase 5 migrations have not been pushed yet (05-02 Task 5 is a
- * blocking human-authorized checkpoint). Intersecting the generated type with the
- * two new parameters keeps this file type-safe in the meantime WITHOUT hand-editing
- * `database.types.ts`, which the plan forbids.
- *
- * After Task 4 regenerates the types, delete this intersection and go back to the
- * bare `Database['public']['Functions']['submit_location']['Args']`.
- */
-type SubmitLocationArgs = Database['public']['Functions']['submit_location']['Args'] & {
-  p_changing_table: boolean;
-  p_wheelchair: boolean;
-};
+type SubmitLocationArgs = Database['public']['Functions']['submit_location']['Args'];
 
 /**
  * Submits a new bathroom location via the `submit_location` SECURITY DEFINER RPC.
```

## Required Verdict Format

Write to `.claude/antigravity-review-latest.md`, run `node .claude/hooks/archive-review-artifact.js antigravity`, and print the verdict.

```md
## Antigravity Review - Regenerate database.types.ts for Phase 5 and remove the submit_location type bridge, attempt 1

**VERDICT: ADVISORY / REQUEST CHANGES / BLOCK**

scope_hash: sha256:a747ea14046678d503e4581795c5da9980fec6ae5eb0de0803fddc1b105a3e5f
review_id: rv-20260929T021232Z-43ad8d04
risk_level: high
runtime_required: true
blind_review: true
prior_reviewer_outputs_read: false
evidence_level: 0|1|2|3|4
runtime_evidence: executed|not_applicable|unavailable

### Reviewed Queue
### Skills Applied
- `.claude/skills/artifact_qa_gate.md` shared core and Antigravity Overlay
- superpowers:using-superpowers
- superpowers:verification-before-completion
- <add any others actually applied>
### Issues
### Concerns
### Follow-ups
### Verification
### Evidence Receipts
### Adversarial Disproof
### Unverified Boundaries
### Runtime Boundary Check
### Claim And State Audit
### Approved
```
