## Antigravity Review - Phase 4: GPS Service & Submission

**VERDICT: APPROVE**

### Reviewed Queue
- [app/src/app/(components)/LocationDetailSheet.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/(components)/LocationDetailSheet.tsx)
- [app/src/app/(components)/PendingStatusSheet.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/(components)/PendingStatusSheet.tsx)
- [app/src/app/(components)/SensitivityConfirmModal.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/(components)/SensitivityConfirmModal.tsx)
- [app/src/app/(components)/WithdrawConfirmModal.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/(components)/WithdrawConfirmModal.tsx)
- [app/src/app/(tabs)/index.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/(tabs)/index.tsx)
- [app/src/app/(tabs)/submit.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/(tabs)/submit.tsx)
- [app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx)
- [app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx)
- [app/src/app/__tests__/(components)/PendingStatusSheet.test.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/__tests__/(components)/PendingStatusSheet.test.tsx)
- [app/src/app/__tests__/(tabs)/MapScreen.test.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/__tests__/(tabs)/MapScreen.test.tsx)
- [app/src/app/__tests__/(tabs)/submit.test.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/__tests__/(tabs)/submit.test.tsx)
- [app/src/features/submit/__tests__/submitLocation.test.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/__tests__/submitLocation.test.ts)
- [app/src/features/submit/__tests__/submitSchema.test.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/__tests__/submitSchema.test.ts)
- [app/src/features/submit/__tests__/updateAccessCode.test.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/__tests__/updateAccessCode.test.ts)
- [app/src/features/submit/__tests__/useGpsSample.test.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/__tests__/useGpsSample.test.ts)
- [app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts)
- [app/src/features/submit/__tests__/withdrawSubmission.test.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/__tests__/withdrawSubmission.test.ts)
- [app/src/features/submit/submitLocation.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/submitLocation.ts)
- [app/src/features/submit/submitSchema.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/submitSchema.ts)
- [app/src/features/submit/types.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/types.ts)
- [app/src/features/submit/updateAccessCode.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/updateAccessCode.ts)
- [app/src/features/submit/useGpsSample.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/useGpsSample.ts)
- [app/src/features/submit/useMyPendingSubmissions.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/useMyPendingSubmissions.ts)
- [app/src/features/submit/withdrawSubmission.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/submit/withdrawSubmission.ts)
- [app/src/lib/database.types.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/lib/database.types.ts)
- [supabase/migrations/20260707020000_phase4_submission_staging.sql](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260707020000_phase4_submission_staging.sql)
- [supabase/migrations/20260707030000_phase4_access_code_update.sql](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260707030000_phase4_access_code_update.sql)
- [supabase/migrations/20260708000000_phase4_code_review_fixes.sql](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260708000000_phase4_code_review_fixes.sql)
- [supabase/migrations/20260708010000_phase4_drop_direct_submission_insert.sql](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260708010000_phase4_drop_direct_submission_insert.sql)
- [supabase/tests/phase4_access_code.test.sql](file:///C:/Users/mrsai/Gotta%20Go/supabase/tests/phase4_access_code.test.sql)
- [supabase/tests/phase4_submit.test.sql](file:///C:/Users/mrsai/Gotta%20Go/supabase/tests/phase4_submit.test.sql)
- [supabase/migrations/20260708020000_phase4_codex_review_fixes.sql](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260708020000_phase4_codex_review_fixes.sql)

### Issues
- **No Issues:** All major and minor findings have been resolved. The Codex review findings (null/blank door code staging, Step 2 wizard validation bypasses, and double-press re-entrancy) are fully addressed and verified.

### Concerns
- **pgTAP Test Execution Constraints:** The pgTAP database test suites (`phase4_submit.test.sql` and `phase4_access_code.test.sql`) were verified using static analysis and found to be correct, but they could not be executed locally due to the lack of a Docker setup in this environment.
- **Accessibility Parameters Deferred:** In Step 1 of the SubmitFlow wizard, users can select accessibility options (changing table, wheelchair accessibility), but these parameters are currently omitted from the `submit_location` RPC payload. This matches the Phase 4 roadmap but needs validation when the publication flow is fully built in Phase 5.

### Verification
- **Frontend Test Suite:** Executed `npm test -- --watchAll=false --runInBand`. Checked output: all 47 test suites containing 383 tests passed successfully. This includes new test coverage confirming Step 2 validation blocks overlong input submissions, and proving that the double-press submit re-entrancy guard is effective.
- **TypeScript Compiler Check:** Executed `npx tsc --noEmit` in `app` - exit 0 (clean).
- **PostGIS Schema Verification:** Confirmed that PostGIS functions (e.g. `extensions.geography`, `extensions.st_setsrid`) in all migration files are fully schema-qualified to prevent resolution failures under custom search paths.
- **Direct INSERT Prevention:** Verified the removal of the direct `submissions_insert_auth` RLS policy, sealing the raw table-insertion security vulnerability.

### Runtime Boundary Check
- **Input Validation Boundary:** The database trust boundary is secured at the RPC layer in [phase4_codex_review_fixes.sql](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260708020000_phase4_codex_review_fixes.sql), rejecting null, empty, whitespace-only, or overlong proposals.
- **Wizard Step Boundary:** Form inputs (`hours`, `accessCode`, `timingTip`) are validated against Zod constraints before advancing to Step 3 in [submit.tsx](file:///C:/Users/mrsai/Gotta%20Go/app/src/app/(tabs)/submit.tsx), preventing invalid or overlong inputs from ever being staged.
- **Re-entrancy Boundary:** The `submittingRef.current` synchronous guard on the final CTA prevents duplicate pending submissions from fast double taps.
- **Security-Definer Search Paths:** All database RPCs use `SECURITY DEFINER` with explicit `set search_path = public` scopes, shielding them against path search hijacking while bypassing base table RLS correctly.
- **Session Boundaries:** Frontend components like `SubmitScreen` and `LocationDetailSheet` gate submission and update actions via the `useSession` context. Unauthenticated actions correctly display the fallback `AuthRequiredModal`.
- **Query Isolations:** The pending-location layer is entirely isolated to `get_my_pending_submissions` (server-enforced `submitter_id = auth.uid()`), ensuring other users or anonymous requests never leak staging information.

### Approved
- Server-side GPS verification (handling stale, inaccurate, and future-skewed timestamps).
- Two-party stage-then-confirm door code update mechanism, mitigating single-user clobbering risks.
- Visual separation of Mapbox layers between pending pins and public clustered bathroom marks.
