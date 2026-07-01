## Antigravity Review - Phase 2 Auth & Profiles Wave 2

**VERDICT: REQUEST CHANGES**

### Issues
- **[CRITICAL] app/src/features/profile/profileStats.ts:22** — Direct client-side SELECT query on base table `ratings` is blocked by database privilege revocation. 
  * *Description & Impact*: Migration `20260624000002_ratings_privacy_fix.sql` explicitly runs `revoke select on ratings from authenticated;` (and `20260624000000_block_fixes.sql` revokes it from `anon`) to prevent exposure of rater identity (PII). Because table-level privileges are checked before RLS, any client-side query targeting the base `ratings` table directly will fail at runtime with a permission error (PostgreSQL error code `42501`). Furthermore, the public view `ratings_public` excludes the `user_id` column to enforce privacy, meaning the client cannot use it to filter and count ratings given by a specific user.
  * *Required Fix*: Implement a `SECURITY DEFINER` RPC in PostgreSQL (e.g., `get_user_profile_stats(p_user_id uuid)`) that performs the counting queries on the server side where table privileges are bypassed, and expose this RPC to the `authenticated` role. Update `profileStats.ts` to call this RPC instead of querying the base tables directly from the client.

### Concerns
- **[MINOR] app/src/features/auth/oauth.ts:25** — Unsafe property access on `data.url`.
  * *Description & Impact*: If `supabase.auth.signInWithOAuth` returns successfully but without a redirect URL in `data` (or if `data` is null), `WebBrowser.openAuthSessionAsync(data.url, redirectTo)` will throw a runtime `TypeError` trying to access `url` on null/undefined.
  * *Recommendation*: Use optional chaining or throw an explicit descriptive error if `data?.url` is missing before opening the auth session.
- **[MINOR] iOS OAuth Compliance (Apple Guideline 4.8)** — Front-end implementation dependency.
  * *Description & Impact*: `oauth.ts` exposes `signInWithGoogle` without any platform-specific guards, leaving the responsibility of platform-gating entirely to the calling screen (`sign-in.tsx`). If the UI fails to correctly platform-gate this call on iOS, the app will violate Apple Developer Guideline 4.8 and face App Store rejection.
  * *Recommendation*: Double-check `sign-in.tsx` to verify that `signInWithGoogle` is strictly gated behind `Platform.OS === 'android'` and that iOS displays the disabled Apple Sign-In stub only.

### Verification
- **Code Inspection**: Reviewed all changed files logged in `.claude/review-queue.txt` ([oauth.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/auth/oauth.ts), [updateProfile.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/profile/updateProfile.ts), [deleteAccount.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/profile/deleteAccount.ts), and [profileStats.ts](file:///C:/Users/mrsai/Gotta%20Go/app/src/features/profile/profileStats.ts)).
- **Privilege & Policy Audit**: Audited `supabase/migrations/20260624000000_block_fixes.sql` and `20260624000002_ratings_privacy_fix.sql` to confirm database permission settings, confirming the `revoke select on ratings` blocks all direct client-side selects.
- **Unit Test Execution**: Ran `npm test` within the `app` directory. All 19 test suites and 133 tests passed successfully. Note that `profileStats.test.ts` passed because it mocks the Supabase client and did not hit the live PostgreSQL database permission checks.

### Approved
- **Auth Callback & OAuth Handling**: PKCE code extraction and session exchange logic in `oauth.ts` are robust and correctly implemented.
- **Profile RPC Wiring**: The `updateProfile` and `deleteAccount` wrappers are clean, secure, and properly call the `update_profile` and `delete_account` RPCs.
- **Account Deletion Cascade Safety**: The database-level modifications to the 7 foreign keys (`ON DELETE SET NULL`) successfully unblock account deletion.
