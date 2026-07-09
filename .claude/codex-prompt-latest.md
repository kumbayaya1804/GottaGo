<!-- review-manifest
reviewer: codex
generated_at: 2026-07-09T16:18:45Z
queue:
  - app/src/app/(components)/LocationDetailSheet.tsx
  - app/src/app/(components)/PendingStatusSheet.tsx
  - app/src/app/(components)/SensitivityConfirmModal.tsx
  - app/src/app/(components)/WithdrawConfirmModal.tsx
  - app/src/app/(tabs)/index.tsx
  - app/src/app/(tabs)/submit.tsx
  - app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx
  - app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx
  - app/src/app/__tests__/(components)/PendingStatusSheet.test.tsx
  - app/src/app/__tests__/(tabs)/MapScreen.test.tsx
  - app/src/app/__tests__/(tabs)/submit.test.tsx
  - app/src/features/submit/__tests__/submitLocation.test.ts
  - app/src/features/submit/__tests__/submitSchema.test.ts
  - app/src/features/submit/__tests__/updateAccessCode.test.ts
  - app/src/features/submit/__tests__/useGpsSample.test.ts
  - app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts
  - app/src/features/submit/__tests__/withdrawSubmission.test.ts
  - app/src/features/submit/submitLocation.ts
  - app/src/features/submit/submitSchema.ts
  - app/src/features/submit/types.ts
  - app/src/features/submit/updateAccessCode.ts
  - app/src/features/submit/useGpsSample.ts
  - app/src/features/submit/useMyPendingSubmissions.ts
  - app/src/features/submit/withdrawSubmission.ts
  - app/src/lib/database.types.ts
  - supabase/migrations/20260707020000_phase4_submission_staging.sql
  - supabase/migrations/20260707030000_phase4_access_code_update.sql
  - supabase/migrations/20260708000000_phase4_code_review_fixes.sql
  - supabase/tests/phase4_access_code.test.sql
  - supabase/tests/phase4_submit.test.sql
  - supabase/migrations/20260708010000_phase4_drop_direct_submission_insert.sql
  - supabase/migrations/20260708020000_phase4_codex_review_fixes.sql
diff_base: c4c143f
context_tier: 1
-->

# Codex Review Request — Phase 4: GPS Service & Submission

You are Codex, senior implementation-quality reviewer and escalation engineer for Gotta Go. Review priorities per CODEX.md: (1) security/privacy, (2) data integrity and database enforcement, (3) location/GPS correctness, (4) abuse resistance and shadowban behavior, (5) Supabase/RLS correctness, (6) user-visible correctness and failure states, (7) test coverage, (8) maintainability. Do not approve from task description alone or because isolated component tests pass while parent layout/provider/auth-event/RLS behavior is mocked away. Run practical verification where available (tsc, tests). Output your verdict in the standard format from CODEX.md (VERDICT / Reviewed Queue / Findings / Open Questions / Verification / Runtime Boundary Check / Approved).

# Phase 4 Review Packet — GPS Service & Submission

## Task Goal And Phase

**Phase:** 04-gps-service-submission (GPS Service & Submission), Gotta Go (React Native/Expo + Supabase bathroom-finder app)

**Goal:** Users physically present at a bathroom can submit it. GPS sample is validated server-side. Submitted locations enter pending state awaiting verification. Access codes and timing tips are writable in this phase — before Phase 8 attempts to display them.

**Success criteria (ROADMAP):**
1. GpsService hook returns `{coord, accuracy, mocked, timestamp}` with high-accuracy mode
2. Mocked locations are rejected at the RPC layer (not just client-side)
3. `submit_location` RPC inserts a pending row and fires creator-initial verification event
4. `submit_location` RPC accepts optional `access_code` and `timing_tips` fields and stores them correctly
5. `submit_location` RPC accepts an `access_sensitivity` value using the same community-set/correctable trust model as `policy_tag` (feeds Phase 3's `family_mode` filter)
6. Access code write path requires auth; stored value is NOT returned in public search results (only in authenticated LocationDetail reads)
7. GPS accuracy > 50m and stale fixes (>60s) are rejected server-side with a generic error
8. SubmitFlow form validates with Zod, handles all error states (denied permission, low accuracy, failed write)
9. Newly submitted location appears on map in pending state visible only to submitter
10. All screens pass Phase 1.5 component acceptance checklist before Codex review

**What shipped (6 plans, all merged to master):**
- `submit_location`, `get_my_pending_submissions`, `withdraw_submission` RPCs + `submissions` staging columns
- `update_access_code`, `confirm_access_code`, `get_access_code` RPCs (stage-then-confirm door-code gate) + `locations` code columns
- Client wrappers: `useGpsSample`, `submitLocation`, `submitSchema`, `useMyPendingSubmissions`, `withdrawSubmission`, `updateAccessCode`/`confirmAccessCode`/`getAccessCode`
- SubmitFlow 3-step wizard (`submit.tsx`), `SensitivityConfirmModal`
- Pending-pin map layer, `PendingStatusSheet`, `WithdrawConfirmModal`, "Update door code" on `LocationDetailSheet`

## Reviewed Queue

Every file below is queued for inspection **from disk** (this packet gives context; read the actual current file contents, don't rely solely on the diff excerpts below):

```
app/src/app/(components)/LocationDetailSheet.tsx
app/src/app/(components)/PendingStatusSheet.tsx
app/src/app/(components)/SensitivityConfirmModal.tsx
app/src/app/(components)/WithdrawConfirmModal.tsx
app/src/app/(tabs)/index.tsx
app/src/app/(tabs)/submit.tsx
app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx
app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx
app/src/app/__tests__/(components)/PendingStatusSheet.test.tsx
app/src/app/__tests__/(tabs)/MapScreen.test.tsx
app/src/app/__tests__/(tabs)/submit.test.tsx
app/src/features/submit/__tests__/submitLocation.test.ts
app/src/features/submit/__tests__/submitSchema.test.ts
app/src/features/submit/__tests__/updateAccessCode.test.ts
app/src/features/submit/__tests__/useGpsSample.test.ts
app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts
app/src/features/submit/__tests__/withdrawSubmission.test.ts
app/src/features/submit/submitLocation.ts
app/src/features/submit/submitSchema.ts
app/src/features/submit/types.ts
app/src/features/submit/updateAccessCode.ts
app/src/features/submit/useGpsSample.ts
app/src/features/submit/useMyPendingSubmissions.ts
app/src/features/submit/withdrawSubmission.ts
app/src/lib/database.types.ts
supabase/migrations/20260707020000_phase4_submission_staging.sql
supabase/migrations/20260707030000_phase4_access_code_update.sql
supabase/migrations/20260708000000_phase4_code_review_fixes.sql
supabase/migrations/20260708010000_phase4_drop_direct_submission_insert.sql
supabase/tests/phase4_access_code.test.sql
supabase/tests/phase4_submit.test.sql
supabase/migrations/20260708020000_phase4_codex_review_fixes.sql
```

Diff base: `c4c143f` (last commit before Phase 4 execution began) → current working tree (includes the direct-insert RLS fix and the Codex re-review fix migration).

## Prior Findings Already Fixed This Session (do not re-report these; verify they are actually fixed)

An internal Claude code review (`04-REVIEW.md`) and independent verification already ran and found/fixed:

1. **PostGIS schema-qualification bug** — this Supabase project has `postgis` installed in the `extensions` schema, not `public`. Any function with `set search_path = public` (this project's SECURITY DEFINER convention) or the `supabase db push` migration session cannot resolve bare `geography`/`geometry`/`st_*` by name. Fixed by schema-qualifying every reference as `extensions.*` in `20260707020000_phase4_submission_staging.sql`. **Please verify**: are there any *remaining* bare (non-`extensions.`-qualified) PostGIS type/function references anywhere in the 4 migration files in this queue?
2. **CR-01**: SubmitFlow's "Hours" field was a bare uncontrolled `TextInput` — user input silently discarded, always sent as `null`. Fixed: wired to a `Controller`, `submitSchema.hours` changed from `Record<string,string>` to free-text `string`.
3. **CR-02 (critical, abuse-resistance)**: `update_access_code` unconditionally overwrote ANY existing pending proposal from a different user — an attacker's second account could stage a malicious code over a legitimate pending one, then confirm from the second account. Fixed in `20260708000000_phase4_code_review_fixes.sql`: rejects staging over a *different* user's in-flight proposal (same user re-staging their own is still allowed).
4. **WR-01**: `get_access_code` returned bare `NULL` typed as non-nullable `text`. Fixed: raises `'location not available'`.
5. **WR-02**: `submit_location`'s freshness check didn't reject a *future*-dated `p_captured_at` (only staleness was bounded). Fixed: also rejects timestamps >5s ahead of server clock.
6. **WR-03**: `confirm_access_code`'s promoting `UPDATE` didn't re-apply the `deleted_at`/`shadowban_status`/`suppressed_at` visibility filters used by its initial `SELECT` (TOCTOU-style gap). Fixed: filters re-applied on the `UPDATE`.
7. **WR-04**: `withdraw_submission` silently no-op'd on a non-matching id instead of signaling failure. Fixed: raises `'submission not available'` on a zero-row match.
8. **WR-05**: door-code update input had no length bound (unlike the initial-submission field). Fixed: client `maxLength={100}` + server `CHECK (char_length(pending_access_code) <= 100)`.
9. **IN-01**: no server-side enum validation on `policy_tag`/`access_sensitivity`. Fixed: `CHECK` constraints added.
10. **IN-02** (accepted, not fixed): `confirmAccessCode`/`getAccessCode` wrappers have no call site yet — confirmed intentional (infra-ahead-of-UI for the confirmation-flow UI), tracked for a future phase.

**One additional finding NOT in `04-REVIEW.md`** — discovered independently while gathering RLS/grant evidence for *this* packet, via direct SQL against the live database (not from reading source):

11. **Direct-INSERT RLS bypass (critical)**: a pre-existing `submissions_insert_auth` policy (`INSERT`, `WITH CHECK (auth.uid() = submitter_id)`) — predating Phase 4 — let any signed-in user `POST /rest/v1/submissions` directly, completely bypassing `submit_location`'s server-side GPS accuracy/freshness/mock-detection checks (SC2, SC7) and letting them set an arbitrary `confirmation_count`/`coordinates`/`access_sensitivity`. Verified via direct query: `submissions` and `submit_location` are both owned by `postgres`; `relforcerowsecurity=false` means the table owner bypasses RLS for its own operations, so `submit_location`'s internal INSERT is unaffected by the policy's removal. No client code queries `submissions`/`locations` directly (`grep -rn "from('submissions')" app/src` — zero matches). Fixed in `supabase/migrations/20260708010000_phase4_drop_direct_submission_insert.sql` (currently uncommitted in the working tree, included in the diff below) by dropping the policy — brings `submissions` in line with the same RPC-only write-path contract `locations` already enforces (confirmed against an existing Phase 3 pgTAP test asserting base-table SELECT denial). Added a pgTAP assertion using `set local role authenticated` (the same real-role-switching pattern as `phase3_read_rpcs.test.sql`) to verify genuine RLS enforcement, not just the RPC's own `auth.uid()` check.

**Please independently verify #11 is real and correctly fixed** — re-check the live RLS policy set on `public.submissions` and `public.locations` if you have DB access, or at minimum confirm the migration file's logic and reasoning hold up, since this was found via live-database inspection rather than static code reading and is exactly the kind of thing this project's review process (RLS placement, not UI-only) exists to catch.

## Live Database Facts (verified via direct SQL, 2026-07-08 — not derivable from the diff alone)

```sql
-- postgis extension location
select extname, nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where extname='postgis';
-- => postgis, extensions

-- RLS enabled on both tables, not forced (table owner bypasses)
select relname, relrowsecurity, relforcerowsecurity from pg_class
  where relname in ('submissions','locations') and relnamespace = 'public'::regnamespace;
-- => submissions: true, false | locations: true, false

-- submissions and submit_location are BOTH owned by postgres
-- (confirms SECURITY DEFINER RPCs bypass RLS via table-owner semantics, independent of any policy)

-- Current policies on public.submissions (AFTER the 20260708010000 fix):
select policyname, cmd from pg_policies where schemaname='public' and tablename='submissions';
-- => submissions_select_published (SELECT), submissions_service_all (ALL, service_role only)
-- (submissions_insert_auth REMOVED)

-- Current policies on public.locations (unchanged, for comparison):
-- => locations_service_all (ALL, service_role only), locations_select_public (SELECT, deleted_at/shadowban/suppressed filter)
-- locations has NO INSERT/UPDATE/DELETE policy for anon/authenticated — RLS default-deny protects it
-- despite anon/authenticated having raw table GRANTs (Supabase's standard blanket-GRANT + RLS-policy pattern,
-- confirmed applied uniformly across every table in this schema, not specific to this phase)
```

## Verification Evidence

- `cd app && npx tsc --noEmit` — clean, independently re-run 2026-07-08 after every fix in this packet including the RLS drop.
- `cd app && npm test` — 47 suites, 381 tests, all green, independently re-run after every fix.
- pgTAP suites (`phase4_submit.test.sql` plan(21), `phase4_access_code.test.sql` plan(21)) — assertion counts verified to match `select plan(N)` via static inspection; **execution has not run in this environment (no Docker)**. Static reading is not a substitute for a passing run — please weigh this in your verdict.
- Live pushes: all 5 migrations in the queue have been applied to the live Supabase project (`ebmzhjmmtmldhrojkdqw`) via `supabase db push`, each under fresh explicit user authorization per this project's convention.
- Two device-UAT walkthroughs (SubmitFlow wizard end-to-end; pending-pin/withdraw/code-update flow) are deferred — no physical device available in this environment — tracked in `.planning/phases/04-gps-service-submission/04-HUMAN-UAT.md`, consistent with Phase 3's precedent of 7 similarly-deferred items.

## Runtime Boundary And Mock Audit

- **Nearest callers/callees:** `submit.tsx` → `submitLocation.ts`/`useGpsSample.ts`/`submitSchema.ts` (04-03) → `submit_location` RPC (04-01). `index.tsx` (map) → `useMyPendingSubmissions.ts` (04-04) → `get_my_pending_submissions` RPC (04-01), tap → `PendingStatusSheet.tsx` → `withdrawSubmission.ts` (04-04) → `withdraw_submission` RPC (04-01). `LocationDetailSheet.tsx` → `updateAccessCode.ts` (04-04) → `update_access_code`/`confirm_access_code`/`get_access_code` RPCs (04-02).
- **Providers/route guards:** `useSession` (existing `SessionProvider`) gates the whole SubmitFlow wizard (D-18, auth-required-from-start) and the "Update door code" action (D-23, signed-in-only) via `AuthRequiredModal`.
- **RPCs/policies/migrations:** 4 migrations in the queue, all SECURITY DEFINER, all with explicit `auth.uid() is null` checks plus (as of this session) genuine RLS enforcement on the underlying tables (no direct-write RLS bypass remains after the `submissions_insert_auth` drop).
- **Tests that mock these boundaries:** `submit.test.tsx` mocks `useSession`, `getGpsSample`, `submitLocation` (not the RPC layer itself — component-level only); `MapScreen.test.tsx` and `LocationDetailSheet.test.tsx` similarly mock `useSession`/`useMyPendingSubmissions`/`updateAccessCode` at the module boundary. **Could the mock hide production behavior?** The unit tests for the RPC *wrapper* modules (`submitLocation.test.ts` etc.) mock only `supabase.rpc` itself and assert the exact `p_*` argument mapping — these are the tests that would catch a wrapper-level regression. The *actual* server-side validation/RLS logic is only exercised by the pgTAP suites, which have never executed in this environment (see above) — this is the layer where a real defect (like the RLS bypass found this session) could hide from the jest suite entirely, since jest never talks to the live database.
- **Async UI flows:** SubmitFlow's Step 3 GPS confirm → sensitivity confirm dialog (conditional) → `submitLocation` → Success screen; `PendingStatusSheet`'s withdraw → confirm dialog → RPC → pin removal — both traced task-by-task in `04-05-PLAN.md`/`04-06-PLAN.md` Task breakdowns.

---

## Diff (c4c143f → current working tree, all queued files)


```diff
diff --git a/app/src/app/(components)/LocationDetailSheet.tsx b/app/src/app/(components)/LocationDetailSheet.tsx
index 60633ca..a33e0cc 100644
--- a/app/src/app/(components)/LocationDetailSheet.tsx
+++ b/app/src/app/(components)/LocationDetailSheet.tsx
@@ -1,8 +1,9 @@
-import React, { useCallback, useEffect, useMemo, useRef } from 'react';
+import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import {
   View,
   Text,
   Pressable,
+  TextInput,
   StyleSheet,
   useColorScheme,
   Linking,
@@ -10,6 +11,7 @@ import {
 } from 'react-native';
 import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
 import { useQuery } from '@tanstack/react-query';
+import { useRouter } from 'expo-router';
 import { formatDistanceToNow } from 'date-fns';
 import { Colors } from '../../constants/Colors';
 import { spacing } from '../../constants/spacing';
@@ -17,6 +19,9 @@ import { typography } from '../../constants/typography';
 import { radius } from '../../constants/radius';
 import { useLocationDetail } from '../../features/locations/useLocationDetail';
 import { formatDistance, usesMilesForLocale } from '../../features/locations/formatDistance';
+import { useSession } from '../../features/auth/useSession';
+import { updateAccessCode } from '../../features/submit/updateAccessCode';
+import AuthRequiredModal from './AuthRequiredModal';

 /**
  * LocationDetail bottom sheet (peek / half / full) — the primary read-detail
@@ -49,6 +54,17 @@ export interface LocationDetailSheetProps {

 const MISSING_HOURS_COPY = 'Hours not yet available';

+// [LOCKED — 04-UI-SPEC.md Copywriting Contract] 'Update door code' is verbatim (D-23).
+const UPDATE_CODE_CTA = 'Update door code';
+const CODE_INPUT_LABEL = 'New door code';
+const CODE_SUBMIT_LABEL = 'Propose new code';
+// D-24 stage-then-confirm: the proposed code is NEVER presented as live — it needs one
+// confirming verification from a DIFFERENT user (server-side gate, 04-02) before it replaces
+// the old value. This copy states that pending-confirmation contract explicitly.
+const CODE_PENDING_COPY =
+  'New code proposed. It needs one confirming verification from another user before it goes live.';
+const CODE_FAILURE_COPY = "Couldn't submit the new code. Check your connection and try again.";
+
 /** Human display label + policy-tag token color for a raw policy_tag value. */
 function policyTagPresentation(
   policyTag: string | null,
@@ -124,6 +140,20 @@ export default function LocationDetailSheet({
   const sheetRef = useRef<BottomSheet>(null);
   const snapPoints = useMemo(() => ['30%', '55%', '90%'], []);

+  // The 'Update door code' action is signed-in-only (D-23). Signed-out taps route to the
+  // AuthRequiredModal (action='see access code') — this sheet never shows the current/live
+  // code to anon (T-04-23), so no getAccessCode call and no code display exist here at all.
+  const session = useSession()?.session ?? null;
+  const router = useRouter();
+  const [authModalVisible, setAuthModalVisible] = useState(false);
+  const [codeUpdateOpen, setCodeUpdateOpen] = useState(false);
+  const [codeInput, setCodeInput] = useState('');
+  const [codeSubmitting, setCodeSubmitting] = useState(false);
+  const [codeError, setCodeError] = useState(false);
+  const [codeProposed, setCodeProposed] = useState(false);
+  // Synchronous re-entrancy guard (see DeleteAccountModal): stops a double-tap from staging twice.
+  const codeSubmittingRef = useRef(false);
+
   const detailQuery = useQuery({
     // Keyed on the forwarded coords so a new fix refreshes the RPC-echoed distance.
     queryKey: ['locationDetail', locationId, userLat, userLng],
@@ -139,6 +169,15 @@ export default function LocationDetailSheet({
     } else {
       sheetRef.current?.close();
     }
+    // Reset the code-update UI whenever the selected location changes (or clears) so a
+    // proposed-code confirmation never bleeds across two different locations.
+    setAuthModalVisible(false);
+    setCodeUpdateOpen(false);
+    setCodeInput('');
+    setCodeSubmitting(false);
+    setCodeError(false);
+    setCodeProposed(false);
+    codeSubmittingRef.current = false;
   }, [locationId]);

   const handleChange = useCallback(
@@ -154,6 +193,35 @@ export default function LocationDetailSheet({
     Linking.openURL(directionsUrl(detail.lat, detail.lng, detail.name));
   }, [detailQuery.data]);

+  const handleUpdateCodePress = useCallback(() => {
+    // Signed-in-only (D-23): anon is routed to the auth gate, never shown a code UI.
+    if (session === null) {
+      setAuthModalVisible(true);
+      return;
+    }
+    setCodeUpdateOpen(true);
+  }, [session]);
+
+  async function handleSubmitCode() {
+    if (codeSubmittingRef.current || locationId === null) return;
+    const trimmed = codeInput.trim();
+    if (trimmed.length === 0) return;
+    codeSubmittingRef.current = true;
+    setCodeSubmitting(true);
+    setCodeError(false);
+    try {
+      // updateAccessCode STAGES only — the different-user promotion gate is server-side (D-24).
+      await updateAccessCode(locationId, trimmed);
+      setCodeProposed(true);
+      setCodeUpdateOpen(false);
+    } catch {
+      setCodeError(true);
+    } finally {
+      codeSubmittingRef.current = false;
+      setCodeSubmitting(false);
+    }
+  }
+
   if (locationId === null) return null;

   const detail = detailQuery.data;
@@ -238,7 +306,7 @@ export default function LocationDetailSheet({
               <Text style={[styles.body, { color: colors.textSecondary }]}>{detail.address}</Text>
             )}

-            {/* Action row: only Get Directions this phase (D-13/D-20) */}
+            {/* Action row: Get Directions (D-13) + signed-in-gated Update door code (D-23) */}
             <View style={styles.actionRow}>
               <Pressable
                 accessibilityRole="button"
@@ -252,9 +320,85 @@ export default function LocationDetailSheet({
                 </Text>
               </Pressable>
             </View>
+
+            <View style={styles.secondaryActionRow}>
+              <Pressable
+                accessibilityRole="button"
+                accessibilityLabel={UPDATE_CODE_CTA}
+                accessibilityHint="Propose a new door code for community confirmation"
+                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
+                onPress={handleUpdateCodePress}
+              >
+                <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>
+                  {UPDATE_CODE_CTA}
+                </Text>
+              </Pressable>
+            </View>
+
+            {codeProposed ? (
+              <Text
+                accessibilityLiveRegion="polite"
+                style={[styles.codePending, { color: colors.textSecondary }]}
+              >
+                {CODE_PENDING_COPY}
+              </Text>
+            ) : codeUpdateOpen ? (
+              <View style={styles.codePanel}>
+                <TextInput
+                  style={[styles.codeInput, { borderColor: colors.border, color: colors.textPrimary }]}
+                  placeholder={CODE_INPUT_LABEL}
+                  placeholderTextColor={colors.textDisabled}
+                  accessibilityLabel={CODE_INPUT_LABEL}
+                  autoCapitalize="none"
+                  autoCorrect={false}
+                  maxLength={100}
+                  value={codeInput}
+                  onChangeText={setCodeInput}
+                />
+                {codeError && (
+                  <Text
+                    accessibilityLiveRegion="assertive"
+                    style={[styles.codeError, { color: colors.errorRed }]}
+                  >
+                    {CODE_FAILURE_COPY}
+                  </Text>
+                )}
+                <Pressable
+                  accessibilityRole="button"
+                  accessibilityLabel={CODE_SUBMIT_LABEL}
+                  accessibilityState={{ disabled: codeSubmitting }}
+                  disabled={codeSubmitting}
+                  style={[
+                    styles.primaryButton,
+                    styles.codeSubmitButton,
+                    { backgroundColor: codeSubmitting ? colors.border : colors.primary },
+                  ]}
+                  onPress={handleSubmitCode}
+                >
+                  <Text
+                    style={[
+                      styles.primaryButtonLabel,
+                      { color: codeSubmitting ? colors.textDisabled : colors.textInverse },
+                    ]}
+                  >
+                    {CODE_SUBMIT_LABEL}
+                  </Text>
+                </Pressable>
+              </View>
+            ) : null}
           </View>
         )}
       </BottomSheetView>
+
+      {authModalVisible && (
+        <AuthRequiredModal
+          visible
+          action="see access code"
+          onSignIn={() => router.push('/(auth)/sign-in')}
+          onCreateAccount={() => router.push('/(auth)/sign-up')}
+          onCancel={() => setAuthModalVisible(false)}
+        />
+      )}
     </BottomSheet>
   );
 }
@@ -320,6 +464,10 @@ const styles = StyleSheet.create({
     marginTop: spacing.xl,
     flexDirection: 'row',
   },
+  secondaryActionRow: {
+    marginTop: spacing.md,
+    flexDirection: 'row',
+  },
   primaryButton: {
     flex: 1,
     minHeight: 48,
@@ -327,6 +475,31 @@ const styles = StyleSheet.create({
     alignItems: 'center',
     justifyContent: 'center',
   },
+  codePanel: {
+    marginTop: spacing.md,
+  },
+  codeInput: {
+    minHeight: 52,
+    borderWidth: 1,
+    borderRadius: radius.sm,
+    paddingHorizontal: spacing.base,
+    fontSize: typography.body.fontSize,
+  },
+  codeError: {
+    marginTop: spacing.sm,
+    fontSize: typography.subhead.fontSize,
+    fontWeight: typography.subhead.fontWeight,
+    lineHeight: typography.subhead.lineHeight,
+  },
+  codeSubmitButton: {
+    marginTop: spacing.md,
+  },
+  codePending: {
+    marginTop: spacing.md,
+    fontSize: typography.subhead.fontSize,
+    fontWeight: typography.subhead.fontWeight,
+    lineHeight: typography.subhead.lineHeight,
+  },
   primaryButtonLabel: {
     fontSize: typography.bodyMedium.fontSize,
     fontWeight: typography.bodyMedium.fontWeight,
diff --git a/app/src/app/(components)/PendingStatusSheet.tsx b/app/src/app/(components)/PendingStatusSheet.tsx
new file mode 100644
index 0000000..918b74a
--- /dev/null
+++ b/app/src/app/(components)/PendingStatusSheet.tsx
@@ -0,0 +1,194 @@
+import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
+import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
+import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
+import { Colors } from '../../constants/Colors';
+import { spacing } from '../../constants/spacing';
+import { typography } from '../../constants/typography';
+import { radius } from '../../constants/radius';
+import type { PendingSubmissionProperties } from '../../features/submit/types';
+import WithdrawConfirmModal from './WithdrawConfirmModal';
+
+/**
+ * Submitter-only pending-status bottom sheet (D-26 / D-27). Opened when the map's
+ * SEPARATE pending `ShapeSource` pin is tapped — NOT the published LocationDetailSheet.
+ *
+ * Reuses LocationDetailSheet's BottomSheet/BottomSheetView scaffold and snapPoints, but
+ * renders verification PROGRESS (a dynamic 'N of 2' count from the tapped feature's
+ * `confirmationCount`, read straight off the map data — no second fetch, D-27) instead of
+ * the published badge/hours/directions block. There is NO Rate/Report/Directions row: a
+ * pending submission is not yet a published, navigable location.
+ *
+ * The one action is the destructive 'Withdraw submission' CTA (D-28, `colors.emergency`)
+ * which opens the D-30 confirm dialog. Withdrawal is server-scoped (WithdrawConfirmModal →
+ * `withdraw_submission`); on success this calls `onWithdrawn` so the caller invalidates the
+ * pending query and the pin disappears from the map entirely (D-29). No access code or any
+ * signed-in-only value is ever shown here.
+ */
+
+// A location publishes after 2 independent GPS verifications (PROJECT data-integrity
+// constraint / D-27). The progress copy renders `confirmationCount` against this.
+export const PUBLISH_THRESHOLD = 2;
+
+// [LOCKED — 04-UI-SPEC.md] verbatim copy; the count is dynamic, the rest is not paraphrasable.
+const PENDING_BADGE = 'Pending';
+const WITHDRAW_CTA = 'Withdraw submission';
+
+/** LOCKED verification-progress body (D-27) — only the leading count is dynamic. */
+function progressCopy(confirmationCount: number): string {
+  return `Pending — ${confirmationCount} of ${PUBLISH_THRESHOLD} GPS verifications received. Share with friends to speed up verification.`;
+}
+
+export interface PendingStatusSheetProps {
+  /** The tapped pending feature's properties, or null when the sheet is closed. */
+  submission: PendingSubmissionProperties | null;
+  /** Called when the sheet is dismissed by gesture (index returns to -1). */
+  onDismiss: () => void;
+  /** Called after a successful withdraw so the caller invalidates ['pendingSubmissions', uid]. */
+  onWithdrawn: () => void;
+}
+
+export default function PendingStatusSheet({
+  submission,
+  onDismiss,
+  onWithdrawn,
+}: PendingStatusSheetProps) {
+  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
+  const colors = Colors[colorScheme];
+  const sheetRef = useRef<BottomSheet>(null);
+  const snapPoints = useMemo(() => ['30%', '55%'], []);
+  const [confirmVisible, setConfirmVisible] = useState(false);
+
+  // Open to peek when a pending pin is selected; close (animate out) when cleared, and
+  // drop any open confirm dialog so it never lingers over a dismissed sheet.
+  useEffect(() => {
+    if (submission !== null) {
+      sheetRef.current?.snapToIndex(0);
+    } else {
+      sheetRef.current?.close();
+      setConfirmVisible(false);
+    }
+  }, [submission]);
+
+  const handleChange = useCallback(
+    (index: number) => {
+      if (index === -1) onDismiss();
+    },
+    [onDismiss],
+  );
+
+  const handleWithdrawn = useCallback(() => {
+    setConfirmVisible(false);
+    onWithdrawn();
+  }, [onWithdrawn]);
+
+  if (submission === null) return null;
+
+  return (
+    <>
+      <BottomSheet
+        ref={sheetRef}
+        index={-1}
+        snapPoints={snapPoints}
+        enablePanDownToClose
+        onChange={handleChange}
+        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.md }}
+        handleIndicatorStyle={{ backgroundColor: colors.border }}
+      >
+        <BottomSheetView style={styles.content}>
+          <View
+            accessibilityRole="summary"
+            accessibilityLabel={`Pending submission ${submission.name}`}
+          >
+            <Text style={[styles.name, { color: colors.textPrimary }]}>{submission.name}</Text>
+
+            {/* Status conveyed by text + token color (never color-only), design-system §18.4. */}
+            <View style={styles.badgeRow}>
+              <View style={[styles.badge, { backgroundColor: colors.pinPending }]}>
+                <Text style={[styles.badgeText, { color: colors.textInverse }]}>
+                  {PENDING_BADGE}
+                </Text>
+              </View>
+            </View>
+
+            <Text style={[styles.body, { color: colors.textPrimary }]}>
+              {progressCopy(submission.confirmationCount)}
+            </Text>
+
+            {/* Only action on a pending submission: withdraw (destructive). No Rate/Report/Directions. */}
+            <View style={styles.actionRow}>
+              <Pressable
+                accessibilityRole="button"
+                accessibilityLabel={WITHDRAW_CTA}
+                accessibilityHint="Opens a confirmation before withdrawing your pending submission"
+                style={[styles.destructiveButton, { backgroundColor: colors.emergency }]}
+                onPress={() => setConfirmVisible(true)}
+              >
+                <Text style={[styles.destructiveButtonLabel, { color: colors.textInverse }]}>
+                  {WITHDRAW_CTA}
+                </Text>
+              </Pressable>
+            </View>
+          </View>
+        </BottomSheetView>
+      </BottomSheet>
+
+      <WithdrawConfirmModal
+        visible={confirmVisible}
+        submissionId={submission.id}
+        onCancel={() => setConfirmVisible(false)}
+        onWithdrawn={handleWithdrawn}
+      />
+    </>
+  );
+}
+
+const styles = StyleSheet.create({
+  content: {
+    paddingHorizontal: spacing.base,
+    paddingTop: spacing.sm,
+    paddingBottom: spacing.xl,
+  },
+  name: {
+    fontSize: typography.h2.fontSize,
+    fontWeight: typography.h2.fontWeight,
+    lineHeight: typography.h2.lineHeight,
+  },
+  badgeRow: {
+    marginTop: spacing.sm,
+    flexDirection: 'row',
+    flexWrap: 'wrap',
+    gap: spacing.sm,
+  },
+  badge: {
+    paddingHorizontal: spacing.sm,
+    paddingVertical: spacing.xs,
+    borderRadius: radius.pill,
+  },
+  badgeText: {
+    fontSize: typography.caption.fontSize,
+    fontWeight: typography.caption.fontWeight,
+    lineHeight: typography.caption.lineHeight,
+  },
+  body: {
+    marginTop: spacing.lg,
+    fontSize: typography.body.fontSize,
+    fontWeight: typography.body.fontWeight,
+    lineHeight: typography.body.lineHeight,
+  },
+  actionRow: {
+    marginTop: spacing.xl,
+    flexDirection: 'row',
+  },
+  destructiveButton: {
+    flex: 1,
+    minHeight: 48,
+    borderRadius: radius.md,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  destructiveButtonLabel: {
+    fontSize: typography.bodyMedium.fontSize,
+    fontWeight: typography.bodyMedium.fontWeight,
+    lineHeight: typography.bodyMedium.lineHeight,
+  },
+});
diff --git a/app/src/app/(components)/SensitivityConfirmModal.tsx b/app/src/app/(components)/SensitivityConfirmModal.tsx
new file mode 100644
index 0000000..2843676
--- /dev/null
+++ b/app/src/app/(components)/SensitivityConfirmModal.tsx
@@ -0,0 +1,135 @@
+import React, { useEffect, useState } from 'react';
+import { View, Text, Modal, Pressable, StyleSheet, useColorScheme } from 'react-native';
+import { Colors } from '../../constants/Colors';
+import { spacing } from '../../constants/spacing';
+import { typography } from '../../constants/typography';
+import { radius } from '../../constants/radius';
+
+// [LOCKED D-15] — verbatim from 04-UI-SPEC.md Destructive-actions matrix; do not paraphrase.
+const SENSITIVITY_CONFIRM_BODY = 'This location will be hidden from Family mode users';
+
+interface SensitivityConfirmModalProps {
+  visible: boolean;
+  onConfirm: () => void;
+  onCancel: () => void;
+}
+
+/**
+ * D-15 confirm-before-submit dialog. Fires on the Step-3 final submit only when the
+ * `access_sensitivity` switch is ON, forcing a conscious acknowledgement before the
+ * location is hidden from Family-mode users (T-04-19).
+ *
+ * Copies DeleteAccountModal's scrim+card skeleton (reset-on-open effect; explicit
+ * Cancel; `onRequestClose` no-op so the Android back button can't silently dismiss).
+ * Unlike DeleteAccountModal this dialog is NON-destructive (confirm uses `primary`,
+ * not `emergency`) and performs no network call itself — the caller owns the RPC — so
+ * it needs no `submittingRef` re-entrancy guard.
+ */
+export default function SensitivityConfirmModal({
+  visible,
+  onConfirm,
+  onCancel,
+}: SensitivityConfirmModalProps) {
+  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
+  const colors = Colors[colorScheme];
+  // Re-entrancy guard against a double-tap firing onConfirm twice before the parent
+  // unmounts/re-renders the dialog closed. Reset every time the modal (re)opens.
+  const [confirmed, setConfirmed] = useState(false);
+
+  useEffect(() => {
+    if (visible) setConfirmed(false);
+  }, [visible]);
+
+  function handleConfirm() {
+    if (confirmed) return;
+    setConfirmed(true);
+    onConfirm();
+  }
+
+  return (
+    <Modal
+      testID="sensitivity-confirm-modal"
+      visible={visible}
+      transparent
+      animationType="fade"
+      onRequestClose={() => {}}
+    >
+      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
+        <View style={[styles.card, { backgroundColor: colors.surface }]}>
+          <Text style={[styles.title, { color: colors.textPrimary }]}>Hide from Family mode?</Text>
+          <Text
+            accessibilityLiveRegion="polite"
+            style={[styles.body, { color: colors.textSecondary }]}
+          >
+            {SENSITIVITY_CONFIRM_BODY}
+          </Text>
+          <Pressable
+            accessibilityRole="button"
+            accessibilityLabel="Confirm — hide from Family mode"
+            style={[styles.confirmButton, { backgroundColor: colors.primary }]}
+            onPress={handleConfirm}
+          >
+            <Text style={[styles.confirmButtonLabel, { color: colors.textInverse }]}>Confirm</Text>
+          </Pressable>
+          <Pressable
+            accessibilityRole="button"
+            accessibilityLabel="Cancel"
+            style={styles.ghostButton}
+            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
+            onPress={onCancel}
+          >
+            <Text style={[styles.ghostButtonLabel, { color: colors.textSecondary }]}>Cancel</Text>
+          </Pressable>
+        </View>
+      </View>
+    </Modal>
+  );
+}
+
+const styles = StyleSheet.create({
+  scrim: {
+    flex: 1,
+    alignItems: 'center',
+    justifyContent: 'center',
+    paddingHorizontal: spacing.base,
+  },
+  card: {
+    width: '100%',
+    borderRadius: radius.lg,
+    padding: spacing.base,
+  },
+  title: {
+    fontSize: typography.h2.fontSize,
+    fontWeight: typography.h2.fontWeight,
+    lineHeight: typography.h2.lineHeight,
+  },
+  body: {
+    marginTop: spacing.base,
+    fontSize: typography.body.fontSize,
+    fontWeight: typography.body.fontWeight,
+    lineHeight: typography.body.lineHeight,
+  },
+  confirmButton: {
+    marginTop: spacing.xl,
+    minHeight: 48,
+    borderRadius: radius.md,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  confirmButtonLabel: {
+    fontSize: typography.bodyMedium.fontSize,
+    fontWeight: typography.bodyMedium.fontWeight,
+    lineHeight: typography.bodyMedium.lineHeight,
+  },
+  ghostButton: {
+    marginTop: spacing.md,
+    minHeight: 44,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  ghostButtonLabel: {
+    fontSize: typography.body.fontSize,
+    fontWeight: typography.body.fontWeight,
+    lineHeight: typography.body.lineHeight,
+  },
+});
diff --git a/app/src/app/(components)/WithdrawConfirmModal.tsx b/app/src/app/(components)/WithdrawConfirmModal.tsx
new file mode 100644
index 0000000..8ef72ee
--- /dev/null
+++ b/app/src/app/(components)/WithdrawConfirmModal.tsx
@@ -0,0 +1,182 @@
+import React, { useEffect, useRef, useState } from 'react';
+import { View, Text, Modal, Pressable, StyleSheet, useColorScheme } from 'react-native';
+import { Colors } from '../../constants/Colors';
+import { spacing } from '../../constants/spacing';
+import { typography } from '../../constants/typography';
+import { radius } from '../../constants/radius';
+import { withdrawSubmission } from '../../features/submit/withdrawSubmission';
+
+/**
+ * D-30 confirm-before-withdraw dialog for the submitter-only PendingStatusSheet.
+ *
+ * Mirrors DeleteAccountModal's scrim + card + destructive-confirm + Cancel structure
+ * and its synchronous `submittingRef` re-entrancy guard (a `submitting` state check
+ * alone can't stop two presses dispatched before the first re-render commits). Swipe /
+ * hardware-back dismiss is FORBIDDEN on a destructive confirm (design-system.md §16) —
+ * `onRequestClose` is a no-op, close only via explicit Cancel.
+ *
+ * On confirm this calls the server-scoped `withdraw_submission` RPC (04-01 enforces
+ * `submitter_id = auth.uid()`, T-04-21 — this UI cannot withdraw another user's pin) and,
+ * only on success, calls `onWithdrawn` so the caller invalidates the pending query and the
+ * pin disappears from the map entirely (D-29). On failure it shows inline error copy and
+ * does NOT call `onWithdrawn`.
+ */
+
+// [LOCKED — 04-UI-SPEC.md Destructive actions / D-30] verbatim, do not paraphrase.
+const WITHDRAW_CONFIRM_COPY = "Are you sure? This can't be undone";
+const WITHDRAW_FAILURE_COPY =
+  "Couldn't withdraw your submission. Check your connection and try again.";
+const WITHDRAW_CONFIRM_LABEL = 'Withdraw';
+
+interface WithdrawConfirmModalProps {
+  visible: boolean;
+  /** The submitter's own pending submission id to withdraw, or null when none is selected. */
+  submissionId: string | null;
+  onCancel: () => void;
+  /** Called only after a successful withdraw so the caller can invalidate the pending query. */
+  onWithdrawn: () => void;
+}
+
+export default function WithdrawConfirmModal({
+  visible,
+  submissionId,
+  onCancel,
+  onWithdrawn,
+}: WithdrawConfirmModalProps) {
+  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
+  const colors = Colors[colorScheme];
+  const [submitting, setSubmitting] = useState(false);
+  const [error, setError] = useState(false);
+  const submittingRef = useRef(false);
+
+  // Reset transient submit/error state every time the dialog (re)opens so a prior failed
+  // attempt never carries over — the modal stays mounted, only `visible` toggles.
+  useEffect(() => {
+    if (visible) {
+      setSubmitting(false);
+      setError(false);
+      submittingRef.current = false;
+    }
+  }, [visible]);
+
+  async function handleWithdraw() {
+    if (submittingRef.current || submissionId === null) return;
+    submittingRef.current = true;
+    setSubmitting(true);
+    setError(false);
+    try {
+      await withdrawSubmission(submissionId);
+      onWithdrawn();
+    } catch {
+      setError(true);
+    } finally {
+      submittingRef.current = false;
+      setSubmitting(false);
+    }
+  }
+
+  return (
+    <Modal
+      testID="withdraw-confirm-modal"
+      visible={visible}
+      transparent
+      animationType="fade"
+      onRequestClose={() => {}}
+    >
+      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
+        <View style={[styles.card, { backgroundColor: colors.surface }]}>
+          <Text style={[styles.title, { color: colors.textPrimary }]}>
+            {WITHDRAW_CONFIRM_COPY}
+          </Text>
+          {error && (
+            <Text
+              accessibilityLiveRegion="assertive"
+              style={[styles.errorText, { color: colors.errorRed }]}
+            >
+              {WITHDRAW_FAILURE_COPY}
+            </Text>
+          )}
+          <Pressable
+            accessibilityRole="button"
+            accessibilityLabel="Withdraw submission — permanent"
+            accessibilityState={{ disabled: submitting }}
+            accessibilityHint="This permanently withdraws your pending submission"
+            disabled={submitting}
+            style={[
+              styles.destructiveButton,
+              { backgroundColor: submitting ? colors.border : colors.emergency },
+            ]}
+            onPress={handleWithdraw}
+          >
+            <Text
+              style={[
+                styles.destructiveButtonLabel,
+                { color: submitting ? colors.textDisabled : colors.textInverse },
+              ]}
+            >
+              {WITHDRAW_CONFIRM_LABEL}
+            </Text>
+          </Pressable>
+          <Pressable
+            accessibilityRole="button"
+            accessibilityLabel="Cancel"
+            style={styles.ghostButton}
+            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
+            onPress={onCancel}
+          >
+            <Text style={[styles.ghostButtonLabel, { color: colors.textSecondary }]}>Cancel</Text>
+          </Pressable>
+        </View>
+      </View>
+    </Modal>
+  );
+}
+
+const styles = StyleSheet.create({
+  scrim: {
+    flex: 1,
+    alignItems: 'center',
+    justifyContent: 'center',
+    paddingHorizontal: spacing.base,
+  },
+  card: {
+    width: '100%',
+    borderRadius: radius.lg,
+    padding: spacing.base,
+  },
+  title: {
+    fontSize: typography.h3.fontSize,
+    fontWeight: typography.h3.fontWeight,
+    lineHeight: typography.h3.lineHeight,
+    textAlign: 'center',
+  },
+  errorText: {
+    marginTop: spacing.md,
+    fontSize: typography.subhead.fontSize,
+    fontWeight: typography.subhead.fontWeight,
+    lineHeight: typography.subhead.lineHeight,
+  },
+  destructiveButton: {
+    marginTop: spacing.xl,
+    minHeight: 48,
+    borderRadius: radius.md,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  destructiveButtonLabel: {
+    fontSize: typography.bodyMedium.fontSize,
+    fontWeight: typography.bodyMedium.fontWeight,
+    lineHeight: typography.bodyMedium.lineHeight,
+  },
+  ghostButton: {
+    marginTop: spacing.md,
+    minHeight: 44,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  ghostButtonLabel: {
+    fontSize: typography.body.fontSize,
+    fontWeight: typography.body.fontWeight,
+    lineHeight: typography.body.lineHeight,
+  },
+});
diff --git a/app/src/app/(tabs)/index.tsx b/app/src/app/(tabs)/index.tsx
index a6d2070..eb6bf95 100644
--- a/app/src/app/(tabs)/index.tsx
+++ b/app/src/app/(tabs)/index.tsx
@@ -8,7 +8,7 @@ import Mapbox, {
   SymbolLayer,
   UserLocation,
 } from '@rnmapbox/maps';
-import { useQuery } from '@tanstack/react-query';
+import { useQuery, useQueryClient } from '@tanstack/react-query';
 import { Colors } from '../../constants/Colors';
 import { spacing } from '../../constants/spacing';
 import { typography } from '../../constants/typography';
@@ -18,8 +18,15 @@ import { useCurrentPosition } from '../../features/locations/useCurrentPosition'
 import { useLocationsBbox } from '../../features/locations/useLocationsBbox';
 import { useDeniedLocationState } from '../../features/locations/useDeniedLocationState';
 import { useFiltersStore } from '../../features/filters/useFiltersStore';
+import { useSession } from '../../features/auth/useSession';
+import { useMyPendingSubmissions } from '../../features/submit/useMyPendingSubmissions';
 import type { LocationFeatureCollection } from '../../features/locations/types';
+import type {
+  PendingSubmissionFeatureCollection,
+  PendingSubmissionProperties,
+} from '../../features/submit/types';
 import LocationDetailSheet from '../(components)/LocationDetailSheet';
+import PendingStatusSheet from '../(components)/PendingStatusSheet';
 import FilterChipRow from '../(components)/FilterChipRow';

 /**
@@ -44,6 +51,13 @@ Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');
 /** Dev-seed center (Eugene, OR — D-31) used only until the first GPS fix. */
 const SEED_CENTER: [number, number] = [-123.09, 44.05];
 const EMPTY_FC: LocationFeatureCollection = { type: 'FeatureCollection', features: [] };
+const EMPTY_PENDING_FC: PendingSubmissionFeatureCollection = {
+  type: 'FeatureCollection',
+  features: [],
+};
+// '< Pending >' label on the submitter-only pin — status carried by color+text, never
+// color-only (design-system §18.4). The dashed-outline visual is device-verified (checkpoint).
+const PENDING_PIN_LABEL = '< Pending >';
 const ZOOM_OUT_COPY = 'Zoom in to see individual locations';
 const BANNER_COPY = "Couldn't load bathrooms here.";
 // [LOCKED ERR-01] — verbatim, do not paraphrase (03-UI-SPEC.md).
@@ -73,6 +87,20 @@ export default function MapScreen() {
   const { coords } = useCurrentPosition();
   const { showManualSearch } = useDeniedLocationState();
   const [selectedId, setSelectedId] = useState<string | null>(null);
+  const [selectedPending, setSelectedPending] = useState<PendingSubmissionProperties | null>(null);
+
+  // Signed-in submitter's own pending pins (SC9). Scoping is entirely server-side
+  // (`submitter_id = auth.uid()`, T-04-20) — this is a SEPARATE authed-only query, never a
+  // client-side "my rows" filter and never a JOIN into Phase 3's search RPCs.
+  const session = useSession()?.session ?? null;
+  const queryClient = useQueryClient();
+  const pendingQuery = useQuery({
+    queryKey: ['pendingSubmissions', session?.user?.id],
+    queryFn: () => useMyPendingSubmissions(),
+    // Defense in depth: the RPC returns nothing for anon anyway, but never even fire it.
+    enabled: !!session,
+  });
+  const pendingCollection = pendingQuery.data ?? EMPTY_PENDING_FC;

   const activeRpcFilters = useFiltersStore((s) => s.activeRpcFilters);
   const clearAllFilters = useFiltersStore((s) => s.clearAll);
@@ -137,6 +165,16 @@ export default function MapScreen() {
     if (typeof id === 'string') setSelectedId(id);
   }, []);

+  // Pending pins live in their OWN source, so they get their own handler — the published
+  // branch above stays untouched. The tapped feature already carries confirmationCount /
+  // expiresAt (get_my_pending_submissions), so the pending sheet needs no second fetch (D-27).
+  const handlePendingPress = useCallback((event: ShapePressEvent) => {
+    const props = event.features?.[0]?.properties;
+    if (props && typeof props.id === 'string') {
+      setSelectedPending(props as unknown as PendingSubmissionProperties);
+    }
+  }, []);
+
   return (
     <View style={styles.screen}>
       <MapView
@@ -185,6 +223,36 @@ export default function MapScreen() {
             />
           </ShapeSource>
         )}
+
+        {/* SEPARATE submitter-only pending layer (RESEARCH Pattern 4) — NOT clustered with
+            id="locations" and NOT a merged feature collection. Gated on an active session so
+            anon never even mounts it; visibility is server-scoped, not client-filtered. */}
+        {!belowPinThreshold && !showManualSearch && !!session && (
+          <ShapeSource
+            id="pendingLocations"
+            shape={pendingCollection as never}
+            onPress={handlePendingPress as never}
+          >
+            <CircleLayer
+              id="pendingPin"
+              style={{
+                circleColor: colors.pinPending,
+                circleRadius: 8,
+                circleStrokeWidth: 2,
+                circleStrokeColor: colors.background,
+              }}
+            />
+            <SymbolLayer
+              id="pendingBadge"
+              style={{
+                textField: PENDING_PIN_LABEL,
+                textSize: 10,
+                textColor: colors.pinPending,
+                textOffset: [0, 1.6] as never,
+              }}
+            />
+          </ShapeSource>
+        )}
       </MapView>

       {!showManualSearch && (
@@ -281,6 +349,19 @@ export default function MapScreen() {
         userLng={coords?.userLng ?? null}
         onDismiss={() => setSelectedId(null)}
       />
+
+      <PendingStatusSheet
+        submission={selectedPending}
+        onDismiss={() => setSelectedPending(null)}
+        onWithdrawn={() => {
+          // Pin vanishes from the map entirely (D-29): drop the sheet + refetch the
+          // now-shorter pending set for this submitter.
+          queryClient.invalidateQueries({
+            queryKey: ['pendingSubmissions', session?.user?.id],
+          });
+          setSelectedPending(null);
+        }}
+      />
     </View>
   );
 }
diff --git a/app/src/app/(tabs)/submit.tsx b/app/src/app/(tabs)/submit.tsx
index 4c89723..f15b18d 100644
--- a/app/src/app/(tabs)/submit.tsx
+++ b/app/src/app/(tabs)/submit.tsx
@@ -1,8 +1,846 @@
-import { View, Text } from 'react-native';
+import React, { useCallback, useEffect, useState } from 'react';
+import {
+  View,
+  Text,
+  TextInput,
+  Pressable,
+  Switch,
+  ScrollView,
+  ActivityIndicator,
+  StyleSheet,
+  useColorScheme,
+} from 'react-native';
+import { useForm, Controller, type Resolver } from 'react-hook-form';
+import { zodResolver } from '@hookform/resolvers/zod';
+import { useRouter } from 'expo-router';
+import { useMutation } from '@tanstack/react-query';
+import { Colors } from '../../constants/Colors';
+import { spacing } from '../../constants/spacing';
+import { typography } from '../../constants/typography';
+import { radius } from '../../constants/radius';
+import { useSession } from '../../features/auth/useSession';
+import { submitSchema, type SubmitSchema } from '../../features/submit/submitSchema';
+import { getGpsSample } from '../../features/submit/useGpsSample';
+import { submitLocation } from '../../features/submit/submitLocation';
+import type { GpsSample, GpsDenied, SubmitInput } from '../../features/submit/types';
+import AuthRequiredModal from '../(components)/AuthRequiredModal';
+import SensitivityConfirmModal from '../(components)/SensitivityConfirmModal';
+
+/**
+ * SubmitFlow — the 3-step "Add a Bathroom" wizard (04-05, ROADMAP SC8) plus the
+ * Success screen. Composed from shipped patterns (FilterChipRow segmented visuals,
+ * sign-up RHF field layout, DeleteAccountModal confirm skeleton, AuthRequiredModal
+ * gate) — no single multi-step analog existed.
+ *
+ * The whole wizard is auth-gated from the start (D-18): a signed-out user sees the
+ * AuthRequiredModal and the form never mounts. Coordinates come exclusively from the
+ * Step-3 GPS fix (D-05); the address field is a free-text label only (D-04) — Google
+ * Places autocomplete is DEFERRED (OQ-1), no autocomplete package is imported.
+ *
+ * Component Acceptance Checklist: design-system.md §20 (ROADMAP SC10) — walked for
+ * this screen at the Task-3 device checkpoint.
+ */
+
+// [LOCKED copy — verbatim from 04-UI-SPEC.md Copywriting Contract; do not paraphrase]
+const CTA_NEXT = 'Next →';
+const CTA_BACK = 'Back';
+const CTA_AT_LOCATION = "I'm at This Location"; // wireframes.md #14
+const CTA_BACK_TO_MAP = 'Back to Map'; // wireframes.md #15
+const CTA_RETRY = 'Retry';
+const SENSITIVITY_LABEL = 'Not suitable for kids'; // D-10
+const SENSITIVITY_EXPLAINER = 'Hides this location from users who have Family mode enabled.'; // D-12
+const PIN_LABEL = 'Door code (optional) — only shown to signed-in users'; // D-19
+const ADDRESS_AFFORDANCE = 'No address? Describe the location instead'; // D-04
+const SUCCESS_HEADING = 'Location Submitted!'; // wireframes.md #15
+const SUCCESS_BODY =
+  "It'll appear publicly after 2 GPS verifications. You can see it on the map now."; // wireframes.md #15
+// [LOCKED error matrix — design-system.md §15 / 04-UI-SPEC.md; map the RPC's generic
+// rejection to these friendly strings only — never surface the specific reason (SC7).]
+const ERR_01 = "We can't find your location. Use search to browse bathrooms near an address.";
+const ERR_02 = 'GPS accuracy too low — move to an open area and try again.';
+const ERR_03 = 'GPS fix is stale — wait a moment and retry.';
+const ERR_08 = "Couldn't submit your location. Check your connection and try again.";
+
+// GPS confirm thresholds (advisory client pre-checks; the RPC re-validates, Pitfall 1).
+const MAX_ACCURACY_M = 50;
+const MAX_FIX_AGE_MS = 60_000;
+
+/** Flatten the wizard form + GPS sample into the `submitLocation` payload (D-05/D-17). */
+function buildInput(values: SubmitSchema, sample: GpsSample): SubmitInput {
+  return {
+    name: values.name,
+    lat: sample.coord.lat,
+    lng: sample.coord.lng,
+    accuracy: sample.accuracy,
+    mocked: sample.mocked,
+    timestamp: sample.timestamp,
+    policyTag: values.policyTag,
+    address: values.address || null,
+    sensitive: values.accessSensitivity,
+    hours: values.hours ?? null,
+    accessCode: values.accessCode || null,
+    timingTip: values.timingTip || null,
+  };
+}
+
+type PolicyTag = SubmitSchema['policyTag'];
+
+const POLICY_OPTIONS: readonly { value: PolicyTag; label: string }[] = [
+  { value: 'chill_spot', label: 'Chill Spot' },
+  { value: 'purchase_required', label: 'Purchase Required' },
+  { value: 'code_required', label: 'Code Required' },
+  { value: 'public_facility', label: 'Public Facility' },
+];
+
+/**
+ * Accessibility toggles are captured in the UI to honor the Step-1 surface inventory,
+ * but are NOT yet forwarded on submit: the 04-03 `submit_location` RPC / `SubmitInput`
+ * expose no accessibility parameters this phase. Tracked as a deferred item (SUMMARY).
+ */
+const ACCESSIBILITY_OPTIONS = [
+  { key: 'changing', label: 'Changing table' },
+  { key: 'wheelchair', label: 'Wheelchair accessible' },
+] as const;
+
+type WizardStep = 1 | 2 | 3 | 'success';
+
 export default function SubmitScreen() {
+  const router = useRouter();
+  const sessionCtx = useSession();
+  const session = sessionCtx?.session ?? null;
+  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
+  const colors = Colors[colorScheme];
+
+  const [step, setStep] = useState<WizardStep>(1);
+  const [describeMode, setDescribeMode] = useState(false);
+  const [accessibility, setAccessibility] = useState<Record<string, boolean>>({});
+  const [confirmVisible, setConfirmVisible] = useState(false);
+  const [sample, setSample] = useState<GpsSample | GpsDenied | null>(null);
+  const [gpsLoading, setGpsLoading] = useState(false);
+
+  const {
+    control,
+    trigger,
+    watch,
+    getValues,
+    formState: { errors },
+  } = useForm<SubmitSchema>({
+    // `accessSensitivity` has a zod `.default(false)`, so the schema's INPUT type marks
+    // it optional while the OUTPUT (SubmitSchema) marks it required — RHF is generic over
+    // the output type, so the resolver's input-typed signature needs this cast bridge.
+    resolver: zodResolver(submitSchema) as Resolver<SubmitSchema>,
+    defaultValues: {
+      name: '',
+      address: '',
+      accessSensitivity: false,
+      accessCode: '',
+      timingTip: '',
+    },
+  });
+
+  const policyTag = watch('policyTag');
+
+  const mutation = useMutation({
+    mutationFn: (input: SubmitInput) => submitLocation(input),
+    onSuccess: () => setStep('success'),
+  });
+
+  // Read a single high-accuracy GPS fix (SC1). Re-runnable for the ERR-03 stale Retry.
+  const loadSample = useCallback(async () => {
+    setGpsLoading(true);
+    try {
+      setSample(await getGpsSample());
+    } finally {
+      setGpsLoading(false);
+    }
+  }, []);
+
+  // Fetch the fix on entering Step 3 (only if one isn't already loaded).
+  useEffect(() => {
+    if (step === 3 && sample === null && !gpsLoading) {
+      void loadSample();
+    }
+  }, [step, sample, gpsLoading, loadSample]);
+
+  // D-18: the entire wizard requires sign-in from the start. Render the inline
+  // AuthRequiredModal gate (never a hard redirect) and do NOT mount the form.
+  if (session === null) {
+    return (
+      <View style={[styles.gateContainer, { backgroundColor: colors.background }]}>
+        <AuthRequiredModal
+          visible
+          action="submit"
+          onSignIn={() => router.push('/(auth)/sign-in')}
+          onCreateAccount={() => router.push('/(auth)/sign-up')}
+          onCancel={() => router.replace('/(tabs)')}
+        />
+      </View>
+    );
+  }
+
+  async function goToStep2() {
+    const ok = await trigger(['name', 'policyTag']);
+    if (ok) setStep(2);
+  }
+
+  // Derived GPS state. `sample` is the denied sentinel, a real fix, or null (loading).
+  const isDenied = sample !== null && 'denied' in sample;
+  const gpsSample = sample !== null && !('denied' in sample) ? sample : null;
+  const isStale = gpsSample !== null && Date.now() - gpsSample.timestamp > MAX_FIX_AGE_MS;
+  const accuracyPoor =
+    gpsSample !== null && gpsSample.accuracy !== null && gpsSample.accuracy > MAX_ACCURACY_M;
+  const gpsValid =
+    gpsSample !== null &&
+    gpsSample.accuracy !== null &&
+    gpsSample.accuracy <= MAX_ACCURACY_M &&
+    !gpsSample.mocked &&
+    !isStale;
+
+  function doSubmit() {
+    setConfirmVisible(false);
+    if (gpsSample === null) return;
+    mutation.mutate(buildInput(getValues(), gpsSample));
+  }
+
+  // On the 56pt CTA: fire the D-15 confirm dialog first if sensitivity is ON (T-04-19),
+  // otherwise submit directly. The CTA is already gated on `gpsValid` via `disabled`.
+  function handleAtLocationPress() {
+    if (!gpsValid) return;
+    if (getValues('accessSensitivity')) {
+      setConfirmVisible(true);
+    } else {
+      doSubmit();
+    }
+  }
+
+  const progressDots = [1, 2, 3];
+
   return (
-    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
-      <Text>Submit (Phase 3)</Text>
-    </View>
+    <ScrollView
+      style={[styles.screen, { backgroundColor: colors.background }]}
+      contentContainerStyle={styles.content}
+      keyboardShouldPersistTaps="handled"
+    >
+      {/* Progress indicator ①────○────○ — done/active use `primary`, upcoming `border`. */}
+      <View style={styles.progressRow} accessibilityLabel={`Step ${step === 'success' ? 3 : step} of 3`}>
+        {progressDots.map((dot, i) => {
+          const active = step !== 'success' && dot <= step;
+          return (
+            <React.Fragment key={dot}>
+              {i > 0 && (
+                <View
+                  style={[
+                    styles.progressBar,
+                    { backgroundColor: active ? colors.primary : colors.border },
+                  ]}
+                />
+              )}
+              <View
+                style={[
+                  styles.progressDot,
+                  { backgroundColor: active ? colors.primary : colors.border },
+                ]}
+              />
+            </React.Fragment>
+          );
+        })}
+      </View>
+
+      {step === 1 && (
+        <View>
+          <Text style={[styles.title, { color: colors.textPrimary }]}>Add a Bathroom</Text>
+
+          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Name</Text>
+          <Controller
+            control={control}
+            name="name"
+            render={({ field: { onChange, value } }) => (
+              <TextInput
+                accessibilityLabel="Name"
+                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
+                placeholder="e.g. Corner Cafe restroom"
+                placeholderTextColor={colors.textDisabled}
+                value={value ?? ''}
+                onChangeText={onChange}
+              />
+            )}
+          />
+          {errors.name?.message && (
+            <Text style={[styles.fieldError, { color: colors.errorRed }]}>{errors.name.message}</Text>
+          )}
+
+          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Address</Text>
+          <Controller
+            control={control}
+            name="address"
+            render={({ field: { onChange, value } }) => (
+              <TextInput
+                accessibilityLabel={describeMode ? 'Describe the location' : 'Address'}
+                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
+                placeholder={describeMode ? 'Describe the location (e.g. behind the gas station)' : 'Street address'}
+                placeholderTextColor={colors.textDisabled}
+                multiline={describeMode}
+                value={value ?? ''}
+                onChangeText={onChange}
+              />
+            )}
+          />
+          {/* D-04: free-text affordance — coordinates always come from GPS (D-05), so
+              this is a label-only convenience; no autocomplete this phase (OQ-1). */}
+          <Pressable
+            accessibilityRole="button"
+            accessibilityLabel={ADDRESS_AFFORDANCE}
+            onPress={() => setDescribeMode((m) => !m)}
+            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
+          >
+            <Text style={[styles.textLink, { color: colors.primary }]}>{ADDRESS_AFFORDANCE}</Text>
+          </Pressable>
+
+          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Policy:</Text>
+          <Controller
+            control={control}
+            name="policyTag"
+            render={({ field: { onChange, value } }) => (
+              <View style={styles.segmentGroup}>
+                {POLICY_OPTIONS.map((opt) => {
+                  const selected = value === opt.value;
+                  return (
+                    <Pressable
+                      key={opt.value}
+                      accessibilityRole="button"
+                      accessibilityLabel={opt.label}
+                      accessibilityState={{ selected }}
+                      onPress={() => onChange(opt.value)}
+                      style={[
+                        styles.segment,
+                        {
+                          backgroundColor: selected ? colors.primary : colors.surface,
+                          borderColor: selected ? colors.primary : colors.border,
+                        },
+                      ]}
+                    >
+                      <Text
+                        style={[
+                          styles.segmentLabel,
+                          { color: selected ? colors.textInverse : colors.textPrimary },
+                        ]}
+                      >
+                        {opt.label}
+                      </Text>
+                    </Pressable>
+                  );
+                })}
+              </View>
+            )}
+          />
+          {errors.policyTag?.message && (
+            <Text style={[styles.fieldError, { color: colors.errorRed }]}>Select a policy.</Text>
+          )}
+
+          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Accessibility:</Text>
+          {ACCESSIBILITY_OPTIONS.map((opt) => {
+            const checked = !!accessibility[opt.key];
+            return (
+              <Pressable
+                key={opt.key}
+                accessibilityRole="checkbox"
+                accessibilityLabel={opt.label}
+                accessibilityState={{ checked }}
+                onPress={() => setAccessibility((a) => ({ ...a, [opt.key]: !checked }))}
+                style={styles.checkboxRow}
+              >
+                <View
+                  style={[
+                    styles.checkboxBox,
+                    {
+                      borderColor: checked ? colors.primary : colors.border,
+                      backgroundColor: checked ? colors.primary : 'transparent',
+                    },
+                  ]}
+                >
+                  {checked && (
+                    <Text style={[styles.checkboxTick, { color: colors.textInverse }]}>✓</Text>
+                  )}
+                </View>
+                <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
+              </Pressable>
+            );
+          })}
+
+          {/* D-13: sensitivity is an RN Switch (visually distinct from the policy
+              segmented picker), with the D-12 declarative-effect explainer beneath. */}
+          <View style={styles.switchRow}>
+            <View style={styles.switchTextGroup}>
+              <Text style={[styles.body, { color: colors.textPrimary }]}>{SENSITIVITY_LABEL}</Text>
+              <Text style={[styles.subhead, { color: colors.textSecondary }]}>
+                {SENSITIVITY_EXPLAINER}
+              </Text>
+            </View>
+            <Controller
+              control={control}
+              name="accessSensitivity"
+              render={({ field: { onChange, value } }) => (
+                <Switch
+                  accessibilityLabel={SENSITIVITY_LABEL}
+                  accessibilityState={{ checked: !!value }}
+                  value={!!value}
+                  onValueChange={onChange}
+                  trackColor={{ true: colors.primary }}
+                />
+              )}
+            />
+          </View>
+
+          <Pressable
+            accessibilityRole="button"
+            accessibilityLabel={CTA_NEXT}
+            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
+            onPress={goToStep2}
+          >
+            <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>{CTA_NEXT}</Text>
+          </Pressable>
+        </View>
+      )}
+
+      {step === 2 && (
+        <View>
+          <Text style={[styles.title, { color: colors.textPrimary }]}>Access & Hours</Text>
+
+          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Hours:</Text>
+          <Controller
+            control={control}
+            name="hours"
+            render={({ field: { onChange, value } }) => (
+              <TextInput
+                accessibilityLabel="Hours"
+                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
+                placeholder="e.g. Open 7am–10pm"
+                placeholderTextColor={colors.textDisabled}
+                value={value ?? ''}
+                onChangeText={onChange}
+              />
+            )}
+          />
+
+          {/* D-17: PIN field renders ONLY for the code_required policy. */}
+          {policyTag === 'code_required' && (
+            <View>
+              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Door code</Text>
+              <Controller
+                control={control}
+                name="accessCode"
+                render={({ field: { onChange, value } }) => (
+                  <TextInput
+                    accessibilityLabel={PIN_LABEL}
+                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
+                    placeholder="1234"
+                    placeholderTextColor={colors.textDisabled}
+                    value={value ?? ''}
+                    onChangeText={onChange}
+                  />
+                )}
+              />
+              <Text style={[styles.subhead, { color: colors.textSecondary }]}>{PIN_LABEL}</Text>
+            </View>
+          )}
+
+          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Timing tip</Text>
+          <Controller
+            control={control}
+            name="timingTip"
+            render={({ field: { onChange, value } }) => (
+              <TextInput
+                accessibilityLabel="Timing tip"
+                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
+                placeholder="e.g. Busiest at lunch"
+                placeholderTextColor={colors.textDisabled}
+                value={value ?? ''}
+                onChangeText={onChange}
+              />
+            )}
+          />
+
+          <View style={styles.navRow}>
+            <Pressable
+              accessibilityRole="button"
+              accessibilityLabel={CTA_BACK}
+              style={[styles.secondaryButton, { borderColor: colors.primary }]}
+              onPress={() => setStep(1)}
+            >
+              <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>{CTA_BACK}</Text>
+            </Pressable>
+            <Pressable
+              accessibilityRole="button"
+              accessibilityLabel={CTA_NEXT}
+              style={[styles.primaryButtonFlex, { backgroundColor: colors.primary }]}
+              onPress={() => setStep(3)}
+            >
+              <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>{CTA_NEXT}</Text>
+            </Pressable>
+          </View>
+        </View>
+      )}
+
+      {step === 3 && (
+        <View>
+          <Text style={[styles.title, { color: colors.textPrimary }]}>GPS Confirm</Text>
+
+          {gpsLoading && (
+            <View style={styles.gpsRow}>
+              <ActivityIndicator color={colors.primary} />
+              <Text style={[styles.subhead, { color: colors.textSecondary }]}>
+                Reading your location…
+              </Text>
+            </View>
+          )}
+
+          {/* Live accuracy readout — every status pairs color + glyph + text (WCAG 1.4.1,
+              design-system.md §18.4). This app ships no icon library; an accessible text
+              glyph stands in for the Ionicons checkmark/warning marks. */}
+          {!gpsLoading && gpsSample !== null && gpsSample.accuracy !== null && (
+            <View style={styles.gpsRow}>
+              <Text
+                style={[
+                  styles.gpsGlyph,
+                  { color: accuracyPoor ? colors.warningAmber : colors.successGreen },
+                ]}
+              >
+                {accuracyPoor ? '⚠' : '✓'}
+              </Text>
+              <Text
+                style={[
+                  styles.body,
+                  { color: accuracyPoor ? colors.warningAmber : colors.successGreen },
+                ]}
+              >
+                {`GPS accuracy: ±${Math.round(gpsSample.accuracy)}m (${accuracyPoor ? 'poor' : 'good'})`}
+              </Text>
+            </View>
+          )}
+
+          {/* Inline GPS error area — generic RPC rejection maps to LOCKED copy only (SC7). */}
+          {!gpsLoading && isDenied && (
+            <Text
+              accessibilityLiveRegion="polite"
+              style={[styles.gpsError, { color: colors.errorRed }]}
+            >
+              {ERR_01}
+            </Text>
+          )}
+          {!gpsLoading && accuracyPoor && (
+            <View style={styles.gpsErrorRow} accessibilityLiveRegion="polite">
+              <Text style={[styles.gpsGlyph, { color: colors.warningAmber }]}>⚠</Text>
+              <Text style={[styles.gpsError, { color: colors.warningAmber }]}>{ERR_02}</Text>
+            </View>
+          )}
+          {!gpsLoading && !accuracyPoor && isStale && (
+            <View>
+              <Text
+                accessibilityLiveRegion="polite"
+                style={[styles.gpsError, { color: colors.warningAmber }]}
+              >
+                {ERR_03}
+              </Text>
+              <Pressable
+                accessibilityRole="button"
+                accessibilityLabel={CTA_RETRY}
+                style={[styles.secondaryButton, { borderColor: colors.primary }]}
+                onPress={() => void loadSample()}
+              >
+                <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
+                  {CTA_RETRY}
+                </Text>
+              </Pressable>
+            </View>
+          )}
+
+          {/* ERR-08: RPC failure — inline, form preserved, Retry re-submits (SC7). */}
+          {mutation.isError && (
+            <View>
+              <View style={styles.gpsErrorRow} accessibilityLiveRegion="assertive">
+                <Text style={[styles.gpsGlyph, { color: colors.errorRed }]}>⚠</Text>
+                <Text style={[styles.gpsError, { color: colors.errorRed }]}>{ERR_08}</Text>
+              </View>
+              <Pressable
+                accessibilityRole="button"
+                accessibilityLabel={CTA_RETRY}
+                style={[styles.secondaryButton, { borderColor: colors.primary }]}
+                onPress={doSubmit}
+              >
+                <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
+                  {CTA_RETRY}
+                </Text>
+              </Pressable>
+            </View>
+          )}
+
+          {/* 56pt primary CTA — enabled only for a present, non-mocked, fresh, ≤50m fix. */}
+          <Pressable
+            accessibilityRole="button"
+            accessibilityLabel={CTA_AT_LOCATION}
+            accessibilityState={{ disabled: !gpsValid || mutation.isPending }}
+            disabled={!gpsValid || mutation.isPending}
+            style={[
+              styles.primaryButton,
+              { backgroundColor: !gpsValid || mutation.isPending ? colors.border : colors.primary },
+            ]}
+            onPress={handleAtLocationPress}
+          >
+            {mutation.isPending ? (
+              <ActivityIndicator color={colors.textInverse} />
+            ) : (
+              <Text
+                style={[
+                  styles.primaryButtonLabel,
+                  { color: !gpsValid ? colors.textDisabled : colors.textInverse },
+                ]}
+              >
+                {CTA_AT_LOCATION}
+              </Text>
+            )}
+          </Pressable>
+
+          <Pressable
+            accessibilityRole="button"
+            accessibilityLabel={CTA_BACK}
+            style={[styles.secondaryButton, { borderColor: colors.primary }]}
+            onPress={() => setStep(2)}
+          >
+            <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>{CTA_BACK}</Text>
+          </Pressable>
+        </View>
+      )}
+
+      {step === 'success' && (
+        <View style={styles.successBlock}>
+          <Text style={[styles.successGlyph, { color: colors.successGreen }]}>✓</Text>
+          <Text style={[styles.title, { color: colors.textPrimary }]}>{SUCCESS_HEADING}</Text>
+          <Text style={[styles.body, styles.successBody, { color: colors.textSecondary }]}>
+            {SUCCESS_BODY}
+          </Text>
+          <Pressable
+            accessibilityRole="button"
+            accessibilityLabel={CTA_BACK_TO_MAP}
+            style={[styles.primaryButton, styles.successCta, { backgroundColor: colors.primary }]}
+            onPress={() => router.replace('/(tabs)')}
+          >
+            <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>
+              {CTA_BACK_TO_MAP}
+            </Text>
+          </Pressable>
+        </View>
+      )}
+
+      {/* D-15 confirm dialog — fires before submit when sensitivity is ON. */}
+      <SensitivityConfirmModal
+        visible={confirmVisible}
+        onConfirm={doSubmit}
+        onCancel={() => setConfirmVisible(false)}
+      />
+    </ScrollView>
   );
 }
+
+const styles = StyleSheet.create({
+  screen: {
+    flex: 1,
+  },
+  gateContainer: {
+    flex: 1,
+  },
+  content: {
+    paddingHorizontal: spacing.base,
+    paddingTop: spacing.xl,
+    paddingBottom: spacing.xxxl,
+  },
+  progressRow: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    justifyContent: 'center',
+    marginBottom: spacing.xl,
+  },
+  progressDot: {
+    width: spacing.md,
+    height: spacing.md,
+    borderRadius: radius.pill,
+  },
+  progressBar: {
+    width: spacing.xxl,
+    height: 2,
+    marginHorizontal: spacing.xs,
+  },
+  title: {
+    fontSize: typography.h2.fontSize,
+    fontWeight: typography.h2.fontWeight,
+    lineHeight: typography.h2.lineHeight,
+    marginBottom: spacing.lg,
+  },
+  sectionLabel: {
+    fontSize: typography.h3.fontSize,
+    fontWeight: typography.h3.fontWeight,
+    lineHeight: typography.h3.lineHeight,
+    marginTop: spacing.lg,
+    marginBottom: spacing.sm,
+  },
+  input: {
+    minHeight: 44,
+    borderWidth: 1,
+    borderRadius: radius.sm,
+    paddingHorizontal: spacing.base,
+    paddingVertical: spacing.sm,
+    fontSize: typography.body.fontSize,
+  },
+  fieldError: {
+    marginTop: spacing.xs,
+    fontSize: typography.caption.fontSize,
+    fontWeight: typography.caption.fontWeight,
+    lineHeight: typography.caption.lineHeight,
+  },
+  textLink: {
+    marginTop: spacing.sm,
+    fontSize: typography.subhead.fontSize,
+    fontWeight: typography.subhead.fontWeight,
+    lineHeight: typography.subhead.lineHeight,
+  },
+  segmentGroup: {
+    flexDirection: 'row',
+    flexWrap: 'wrap',
+    gap: spacing.sm,
+  },
+  segment: {
+    minHeight: 44,
+    justifyContent: 'center',
+    paddingHorizontal: spacing.base,
+    paddingVertical: spacing.sm,
+    borderWidth: 1,
+    borderRadius: radius.sm,
+  },
+  segmentLabel: {
+    fontSize: typography.body.fontSize,
+    fontWeight: typography.body.fontWeight,
+    lineHeight: typography.body.lineHeight,
+  },
+  checkboxRow: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    minHeight: 44,
+    gap: spacing.md,
+  },
+  checkboxBox: {
+    width: spacing.lg,
+    height: spacing.lg,
+    borderWidth: 1,
+    borderRadius: radius.xs,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  checkboxTick: {
+    fontSize: typography.caption.fontSize,
+    fontWeight: typography.caption.fontWeight,
+    lineHeight: typography.caption.lineHeight,
+  },
+  checkboxLabel: {
+    fontSize: typography.body.fontSize,
+    fontWeight: typography.body.fontWeight,
+    lineHeight: typography.body.lineHeight,
+  },
+  switchRow: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    justifyContent: 'space-between',
+    marginTop: spacing.lg,
+    gap: spacing.base,
+  },
+  switchTextGroup: {
+    flex: 1,
+  },
+  body: {
+    fontSize: typography.body.fontSize,
+    fontWeight: typography.body.fontWeight,
+    lineHeight: typography.body.lineHeight,
+  },
+  subhead: {
+    marginTop: spacing.xs,
+    fontSize: typography.subhead.fontSize,
+    fontWeight: typography.subhead.fontWeight,
+    lineHeight: typography.subhead.lineHeight,
+  },
+  primaryButton: {
+    marginTop: spacing.xl,
+    minHeight: 56,
+    borderRadius: radius.md,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  primaryButtonFlex: {
+    flex: 1,
+    minHeight: 56,
+    borderRadius: radius.md,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  primaryButtonLabel: {
+    fontSize: typography.bodyMedium.fontSize,
+    fontWeight: typography.bodyMedium.fontWeight,
+    lineHeight: typography.bodyMedium.lineHeight,
+  },
+  secondaryButton: {
+    marginTop: spacing.xl,
+    minHeight: 56,
+    paddingHorizontal: spacing.xl,
+    borderWidth: 1.5,
+    borderRadius: radius.md,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  secondaryButtonLabel: {
+    fontSize: typography.bodyMedium.fontSize,
+    fontWeight: typography.bodyMedium.fontWeight,
+    lineHeight: typography.bodyMedium.lineHeight,
+  },
+  navRow: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    gap: spacing.md,
+  },
+  gpsRow: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    gap: spacing.sm,
+    marginTop: spacing.md,
+  },
+  gpsGlyph: {
+    fontSize: typography.h3.fontSize,
+    fontWeight: typography.h3.fontWeight,
+    lineHeight: typography.h3.lineHeight,
+  },
+  gpsErrorRow: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    gap: spacing.sm,
+    marginTop: spacing.md,
+  },
+  gpsError: {
+    flex: 1,
+    fontSize: typography.subhead.fontSize,
+    fontWeight: typography.subhead.fontWeight,
+    lineHeight: typography.subhead.lineHeight,
+  },
+  successBlock: {
+    alignItems: 'center',
+    paddingTop: spacing.xxl,
+  },
+  successGlyph: {
+    fontSize: typography.display.fontSize,
+    fontWeight: typography.display.fontWeight,
+    lineHeight: typography.display.lineHeight,
+    marginBottom: spacing.base,
+  },
+  successBody: {
+    textAlign: 'center',
+    marginTop: spacing.md,
+  },
+  successCta: {
+    alignSelf: 'stretch',
+  },
+});
diff --git a/app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx b/app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx
index 6c841af..dbdc484 100644
--- a/app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx
+++ b/app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx
@@ -54,6 +54,18 @@ jest.mock('../../../features/locations/formatDistance', () => ({
   usesMilesForLocale: () => true,
 }));

+// --- Mock useSession (the Phase 4 Update-door-code gate consumes it) so this suite does
+// not pull the real SessionProvider → supabase → AsyncStorage native module. Default:
+// signed out — the D-24 code-update behavior is covered in LocationDetailSheet.updateCode.test.
+jest.mock('../../../features/auth/useSession', () => ({
+  useSession: () => null,
+}));
+
+// --- The Update-door-code stage wrapper is imported by the sheet but never invoked here.
+jest.mock('../../../features/submit/updateAccessCode', () => ({
+  updateAccessCode: jest.fn(),
+}));
+
 import LocationDetailSheet from '../../(components)/LocationDetailSheet';

 const ID = '11111111-1111-1111-1111-111111111111';
diff --git a/app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx b/app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx
new file mode 100644
index 0000000..aa00730
--- /dev/null
+++ b/app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx
@@ -0,0 +1,188 @@
+/**
+ * Behavior tests for the Phase 4 "Update door code" extension of
+ * app/src/app/(components)/LocationDetailSheet.tsx (D-21 / D-23 / D-24).
+ *
+ * src/app/** is excluded from coverage collection — these tests exist for TDD
+ * Guard compliance and behavioral verification only, not coverage metrics.
+ *
+ * Contract under test:
+ *  - The 'Update door code' action is signed-in-only: tapping it while signed OUT opens
+ *    AuthRequiredModal (action='see access code') and reveals NO code input; it never
+ *    displays any current/live code to anon (T-04-23).
+ *  - Signed IN, tapping it opens a freeform code input (no numeric-only validation, D-20).
+ *  - Submitting a new code calls updateAccessCode(locationId, code) and then shows a
+ *    pending-confirmation state (D-24) — NOT an immediate "code is live" message.
+ *  - Get Directions and the existing published detail remain intact (no regression).
+ */
+import React from 'react';
+import { render, fireEvent, waitFor } from '@testing-library/react-native';
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
+
+jest.mock('@gorhom/bottom-sheet', () => {
+  const RealReact = require('react');
+  const { View } = require('react-native');
+  const BottomSheet = RealReact.forwardRef(
+    ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
+      RealReact.useImperativeHandle(ref, () => ({
+        snapToIndex: jest.fn(),
+        expand: jest.fn(),
+        collapse: jest.fn(),
+        close: jest.fn(),
+      }));
+      return RealReact.createElement(View, { testID: 'location-detail-sheet' }, children);
+    },
+  );
+  return {
+    __esModule: true,
+    default: BottomSheet,
+    BottomSheetView: ({ children }: { children: React.ReactNode }) =>
+      RealReact.createElement(View, null, children),
+    BottomSheetBackdrop: () => null,
+  };
+});
+
+const mockUseLocationDetail = jest.fn();
+jest.mock('../../../features/locations/useLocationDetail', () => ({
+  useLocationDetail: (...args: unknown[]) => mockUseLocationDetail(...args),
+}));
+
+jest.mock('../../../features/locations/formatDistance', () => ({
+  formatDistance: (meters: number) => `FMT:${meters}`,
+  usesMilesForLocale: () => true,
+}));
+
+// Controllable auth session — the update-code action is signed-in-only.
+let mockSessionValue: { session: { user: { id: string } } | null } | null;
+jest.mock('../../../features/auth/useSession', () => ({
+  useSession: () => mockSessionValue,
+}));
+
+// The stage-only update wrapper (never promotes; the different-user gate is server-side).
+const mockUpdateAccessCode = jest.fn();
+jest.mock('../../../features/submit/updateAccessCode', () => ({
+  updateAccessCode: (...args: unknown[]) => mockUpdateAccessCode(...args),
+}));
+
+jest.mock('expo-router', () => ({
+  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
+}));
+
+import LocationDetailSheet from '../../(components)/LocationDetailSheet';
+
+const ID = '11111111-1111-1111-1111-111111111111';
+
+const baseDetail = {
+  id: ID,
+  name: 'Code Cafe',
+  lat: 44.0505,
+  lng: -123.0905,
+  policyTag: 'code_required',
+  confidenceTier: 'High',
+  verificationCount: 5,
+  lastVerifiedAt: '2026-07-01T12:00:00Z',
+  isOpenNow: true,
+  chillSpot: false,
+  address: '123 Willamette St',
+  hours: { mon: '08:00-20:00' },
+  distanceM: 500,
+};
+
+const PENDING_COPY =
+  'New code proposed. It needs one confirming verification from another user before it goes live.';
+
+function renderSheet() {
+  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
+  return render(
+    <QueryClientProvider client={client}>
+      <LocationDetailSheet locationId={ID} userLat={null} userLng={null} onDismiss={jest.fn()} />
+    </QueryClientProvider>,
+  );
+}
+
+beforeEach(() => {
+  jest.clearAllMocks();
+  mockUseLocationDetail.mockResolvedValue(baseDetail);
+  mockUpdateAccessCode.mockResolvedValue(undefined);
+  mockSessionValue = null;
+});
+
+describe('LocationDetailSheet — Update door code (D-23/D-24)', () => {
+  it('renders the "Update door code" action', async () => {
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    const { findByLabelText } = renderSheet();
+    expect(await findByLabelText('Update door code')).toBeTruthy();
+  });
+
+  it('keeps Get Directions intact (no regression)', async () => {
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    const { findByLabelText } = renderSheet();
+    expect(await findByLabelText('Get Directions')).toBeTruthy();
+  });
+
+  it('signed OUT: tapping Update door code opens AuthRequiredModal and shows no code input', async () => {
+    mockSessionValue = { session: null };
+    const { findByLabelText, getByText, queryByLabelText } = renderSheet();
+    fireEvent.press(await findByLabelText('Update door code'));
+    expect(getByText('Sign in to see access code')).toBeTruthy();
+    expect(queryByLabelText('New door code')).toBeNull();
+  });
+
+  it('signed IN: tapping Update door code opens the freeform code input, not the auth modal', async () => {
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    const { findByLabelText, queryByText } = renderSheet();
+    fireEvent.press(await findByLabelText('Update door code'));
+    expect(await findByLabelText('New door code')).toBeTruthy();
+    expect(queryByText('Sign in to see access code')).toBeNull();
+  });
+
+  it('the code input has no numeric-only keyboard (freeform, D-20)', async () => {
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    const { findByLabelText } = renderSheet();
+    fireEvent.press(await findByLabelText('Update door code'));
+    const input = await findByLabelText('New door code');
+    expect(['default', undefined]).toContain(input.props.keyboardType);
+  });
+
+  it('submitting a new alphanumeric code calls updateAccessCode(locationId, code)', async () => {
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    const { findByLabelText } = renderSheet();
+    fireEvent.press(await findByLabelText('Update door code'));
+    fireEvent.changeText(await findByLabelText('New door code'), 'A1b2#');
+    fireEvent.press(await findByLabelText('Propose new code'));
+    await waitFor(() => {
+      expect(mockUpdateAccessCode).toHaveBeenCalledWith(ID, 'A1b2#');
+    });
+  });
+
+  it('after submit shows a pending-confirmation state, NOT a "code is live" message', async () => {
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    const { findByLabelText, findByText, queryByText } = renderSheet();
+    fireEvent.press(await findByLabelText('Update door code'));
+    fireEvent.changeText(await findByLabelText('New door code'), '4242');
+    fireEvent.press(await findByLabelText('Propose new code'));
+    expect(await findByText(PENDING_COPY)).toBeTruthy();
+    expect(queryByText(/code is now live/i)).toBeNull();
+    expect(queryByText(/code updated/i)).toBeNull();
+    expect(queryByText(/now active/i)).toBeNull();
+  });
+
+  it('never reveals the current/live code value anywhere in the sheet (T-04-23)', async () => {
+    // getAccessCode is never called by this UI — the update flow only STAGES a new code.
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    const { findByText, queryByText } = renderSheet();
+    await findByText('Code Cafe');
+    expect(queryByText(/current code/i)).toBeNull();
+    expect(queryByText(/access code/i)).toBeNull();
+  });
+
+  it('on updateAccessCode failure shows an inline error and no pending-confirmation state', async () => {
+    mockUpdateAccessCode.mockRejectedValue(new Error('network down'));
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    const { findByLabelText, findByText, queryByText } = renderSheet();
+    fireEvent.press(await findByLabelText('Update door code'));
+    fireEvent.changeText(await findByLabelText('New door code'), '4242');
+    fireEvent.press(await findByLabelText('Propose new code'));
+    await findByText("Couldn't submit the new code. Check your connection and try again.");
+    expect(queryByText(PENDING_COPY)).toBeNull();
+  });
+});
diff --git a/app/src/app/__tests__/(components)/PendingStatusSheet.test.tsx b/app/src/app/__tests__/(components)/PendingStatusSheet.test.tsx
new file mode 100644
index 0000000..842aba5
--- /dev/null
+++ b/app/src/app/__tests__/(components)/PendingStatusSheet.test.tsx
@@ -0,0 +1,171 @@
+/**
+ * Thin render + behavior tests for app/src/app/(components)/PendingStatusSheet.tsx
+ * (+ the nested WithdrawConfirmModal it renders).
+ *
+ * src/app/** is excluded from coverage collection — these tests exist for TDD
+ * Guard compliance and behavioral verification only, not coverage metrics. Native
+ * Mapbox pin rendering + submitter-scoped visibility are device-verified in the
+ * Task 3 checkpoint; here we lock the sheet's content + withdraw wiring:
+ *  - the LOCKED verification-progress copy renders a DYNAMIC 'N of 2' count from
+ *    the tapped pending feature's confirmationCount (D-27),
+ *  - NO Rate/Report/Directions row (this is the pending variant, not the published
+ *    LocationDetailSheet),
+ *  - the destructive 'Withdraw submission' CTA opens the D-30 confirm dialog, and
+ *    confirming calls withdrawSubmission(id) then onWithdrawn (so the pin vanishes).
+ */
+import React from 'react';
+import { render, fireEvent, waitFor } from '@testing-library/react-native';
+
+// --- Mock @gorhom/bottom-sheet: render children as plain Views so content is queryable.
+jest.mock('@gorhom/bottom-sheet', () => {
+  const RealReact = require('react');
+  const { View } = require('react-native');
+  const BottomSheet = RealReact.forwardRef(
+    ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
+      RealReact.useImperativeHandle(ref, () => ({
+        snapToIndex: jest.fn(),
+        expand: jest.fn(),
+        collapse: jest.fn(),
+        close: jest.fn(),
+      }));
+      return RealReact.createElement(View, { testID: 'pending-status-sheet' }, children);
+    },
+  );
+  return {
+    __esModule: true,
+    default: BottomSheet,
+    BottomSheetView: ({ children }: { children: React.ReactNode }) =>
+      RealReact.createElement(View, null, children),
+    BottomSheetBackdrop: () => null,
+  };
+});
+
+// --- Mock the network withdraw wrapper: assert it is called with the id, control resolution.
+const mockWithdrawSubmission = jest.fn();
+jest.mock('../../../features/submit/withdrawSubmission', () => ({
+  withdrawSubmission: (...args: unknown[]) => mockWithdrawSubmission(...args),
+}));
+
+import PendingStatusSheet from '../../(components)/PendingStatusSheet';
+
+const ID = '22222222-2222-2222-2222-222222222222';
+
+const baseSubmission = {
+  id: ID,
+  name: 'Trailhead Port-a-Potty',
+  policyTag: 'public_facility',
+  confirmationCount: 1,
+  expiresAt: '2026-07-10T12:00:00Z',
+};
+
+function renderSheet(
+  props: Partial<React.ComponentProps<typeof PendingStatusSheet>> = {},
+) {
+  return render(
+    <PendingStatusSheet
+      submission={baseSubmission}
+      onDismiss={jest.fn()}
+      onWithdrawn={jest.fn()}
+      {...props}
+    />,
+  );
+}
+
+beforeEach(() => {
+  jest.clearAllMocks();
+  mockWithdrawSubmission.mockResolvedValue(undefined);
+});
+
+describe('PendingStatusSheet', () => {
+  it('renders nothing when no pending submission is selected', () => {
+    const { queryByText } = renderSheet({ submission: null });
+    expect(queryByText('Trailhead Port-a-Potty')).toBeNull();
+  });
+
+  it('renders the submission name', () => {
+    const { getByText } = renderSheet();
+    expect(getByText('Trailhead Port-a-Potty')).toBeTruthy();
+  });
+
+  it('renders the LOCKED verification-progress copy with a dynamic count (1 of 2)', () => {
+    const { getByText } = renderSheet();
+    expect(
+      getByText(
+        'Pending — 1 of 2 GPS verifications received. Share with friends to speed up verification.',
+      ),
+    ).toBeTruthy();
+  });
+
+  it('renders the progress count dynamically from confirmationCount (0 of 2)', () => {
+    const { getByText } = renderSheet({
+      submission: { ...baseSubmission, confirmationCount: 0 },
+    });
+    expect(
+      getByText(
+        'Pending — 0 of 2 GPS verifications received. Share with friends to speed up verification.',
+      ),
+    ).toBeTruthy();
+  });
+
+  it('shows the "Pending" badge (color + text, never color-only)', () => {
+    const { getByText } = renderSheet();
+    expect(getByText('Pending')).toBeTruthy();
+  });
+
+  it('does NOT render a Rate / Report / Get Directions row (pending variant)', () => {
+    const { queryByText, queryByLabelText } = renderSheet();
+    expect(queryByText('Rate')).toBeNull();
+    expect(queryByText('Report')).toBeNull();
+    expect(queryByText('Get Directions')).toBeNull();
+    expect(queryByLabelText('Get Directions')).toBeNull();
+  });
+
+  it('renders the destructive "Withdraw submission" CTA', () => {
+    const { getByLabelText } = renderSheet();
+    expect(getByLabelText('Withdraw submission')).toBeTruthy();
+  });
+
+  it('tapping "Withdraw submission" opens the D-30 confirm dialog', () => {
+    const { getByLabelText, getByText } = renderSheet();
+    fireEvent.press(getByLabelText('Withdraw submission'));
+    expect(getByText("Are you sure? This can't be undone")).toBeTruthy();
+  });
+
+  it('confirming the withdraw calls withdrawSubmission with the submission id', async () => {
+    const { getByLabelText } = renderSheet();
+    fireEvent.press(getByLabelText('Withdraw submission'));
+    fireEvent.press(getByLabelText('Withdraw submission — permanent'));
+    await waitFor(() => {
+      expect(mockWithdrawSubmission).toHaveBeenCalledWith(ID);
+    });
+  });
+
+  it('calls onWithdrawn after a successful withdraw (so the pin can be invalidated)', async () => {
+    const onWithdrawn = jest.fn();
+    const { getByLabelText } = renderSheet({ onWithdrawn });
+    fireEvent.press(getByLabelText('Withdraw submission'));
+    fireEvent.press(getByLabelText('Withdraw submission — permanent'));
+    await waitFor(() => {
+      expect(onWithdrawn).toHaveBeenCalledTimes(1);
+    });
+  });
+
+  it('does NOT call onWithdrawn when the withdraw RPC fails (shows inline error instead)', async () => {
+    mockWithdrawSubmission.mockRejectedValue(new Error('network down'));
+    const onWithdrawn = jest.fn();
+    const { getByLabelText, findByText } = renderSheet({ onWithdrawn });
+    fireEvent.press(getByLabelText('Withdraw submission'));
+    fireEvent.press(getByLabelText('Withdraw submission — permanent'));
+    await findByText("Couldn't withdraw your submission. Check your connection and try again.");
+    expect(onWithdrawn).not.toHaveBeenCalled();
+  });
+
+  it('the withdraw confirm dialog forbids swipe-dismiss (onRequestClose is a no-op)', () => {
+    const onDismiss = jest.fn();
+    const { getByLabelText, getByTestId } = renderSheet({ onDismiss });
+    fireEvent.press(getByLabelText('Withdraw submission'));
+    fireEvent(getByTestId('withdraw-confirm-modal'), 'requestClose');
+    // A swipe/back gesture on the destructive confirm must not silently withdraw or dismiss.
+    expect(mockWithdrawSubmission).not.toHaveBeenCalled();
+  });
+});
diff --git a/app/src/app/__tests__/(tabs)/MapScreen.test.tsx b/app/src/app/__tests__/(tabs)/MapScreen.test.tsx
index 983bf6f..1fc7d38 100644
--- a/app/src/app/__tests__/(tabs)/MapScreen.test.tsx
+++ b/app/src/app/__tests__/(tabs)/MapScreen.test.tsx
@@ -52,6 +52,28 @@ jest.mock('../../(components)/LocationDetailSheet', () => ({
   },
 }));

+// --- Spy the pending sheet too (it pulls in @gorhom/bottom-sheet; MapScreen only wires it).
+const mockPendingSheetSpy = jest.fn();
+jest.mock('../../(components)/PendingStatusSheet', () => ({
+  __esModule: true,
+  default: (props: unknown) => {
+    mockPendingSheetSpy(props);
+    return null;
+  },
+}));
+
+// --- Controllable auth session (the pending layer is submitter-only, enabled: !!session).
+let mockSessionValue: { session: { user: { id: string } } | null } | null;
+jest.mock('../../../features/auth/useSession', () => ({
+  useSession: () => mockSessionValue,
+}));
+
+// --- The authed-only pending-submissions fetch (separate source, server-scoped).
+const mockUseMyPendingSubmissions = jest.fn();
+jest.mock('../../../features/submit/useMyPendingSubmissions', () => ({
+  useMyPendingSubmissions: (...args: unknown[]) => mockUseMyPendingSubmissions(...args),
+}));
+
 import MapScreen from '../../(tabs)/index';

 const VIEWPORT = { minLng: -123.1, minLat: 44.04, maxLng: -123.08, maxLat: 44.06 };
@@ -88,6 +110,9 @@ beforeEach(() => {
   });
   mockUseLocationsBbox.mockResolvedValue(EMPTY_FC);
   mockUseDeniedLocationState.mockReturnValue({ permission: 'granted', showManualSearch: false });
+  // Default: signed out — the pending layer must stay dark for anon (T-04-20).
+  mockSessionValue = null;
+  mockUseMyPendingSubmissions.mockResolvedValue(EMPTY_FC);
   useFiltersStore.setState({ ...EMPTY_FILTERS });
 });

@@ -179,4 +204,25 @@ describe('MapScreen', () => {
     fireEvent.press(button);
     expect(useFiltersStore.getState().chillSpot).toBe(false);
   });
+
+  it('does NOT fetch pending submissions when signed out (enabled: !!session, T-04-20)', async () => {
+    mockSessionValue = null;
+    renderScreen();
+    // Give any (incorrectly) enabled query a tick to fire.
+    await waitFor(() => expect(mockSheetSpy).toHaveBeenCalled());
+    expect(mockUseMyPendingSubmissions).not.toHaveBeenCalled();
+  });
+
+  it('fetches the submitter-only pending submissions when signed in', async () => {
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    renderScreen();
+    await waitFor(() => expect(mockUseMyPendingSubmissions).toHaveBeenCalled());
+  });
+
+  it('mounts the PendingStatusSheet with no submission selected initially', () => {
+    mockSessionValue = { session: { user: { id: 'user-1' } } };
+    renderScreen();
+    const lastProps = mockPendingSheetSpy.mock.calls.at(-1)?.[0];
+    expect(lastProps).toMatchObject({ submission: null });
+  });
 });
diff --git a/app/src/app/__tests__/(tabs)/submit.test.tsx b/app/src/app/__tests__/(tabs)/submit.test.tsx
new file mode 100644
index 0000000..2803252
--- /dev/null
+++ b/app/src/app/__tests__/(tabs)/submit.test.tsx
@@ -0,0 +1,265 @@
+/**
+ * Thin render + behavior tests for app/src/app/(tabs)/submit.tsx — the 3-step
+ * SubmitFlow wizard (04-05).
+ *
+ * src/app/** is excluded from coverage collection — these tests exist for
+ * TDD Guard compliance and behavioral verification only, not coverage metrics.
+ * Real GPS accuracy / permission prompts / mock-location are device-only and are
+ * covered by the Task 3 device-UAT checkpoint, not jest.
+ */
+
+import React from 'react';
+import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
+
+const mockPush = jest.fn();
+const mockReplace = jest.fn();
+jest.mock('expo-router', () => ({
+  useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace })),
+  useSegments: jest.fn(() => []),
+}));
+
+let mockSessionValue: { session: { user: { id: string; email: string } } | null } | null;
+jest.mock('../../../features/auth/useSession', () => ({
+  useSession: () => mockSessionValue,
+}));
+
+const mockGetGpsSample = jest.fn();
+jest.mock('../../../features/submit/useGpsSample', () => ({
+  getGpsSample: (...args: unknown[]) => mockGetGpsSample(...args),
+}));
+
+const mockSubmitLocation = jest.fn();
+jest.mock('../../../features/submit/submitLocation', () => ({
+  submitLocation: (...args: unknown[]) => mockSubmitLocation(...args),
+}));
+
+import SubmitScreen from '../../(tabs)/submit';
+
+// LOCKED copy mirrored from 04-UI-SPEC.md (verbatim assertions).
+const PIN_LABEL = 'Door code (optional) — only shown to signed-in users';
+const ADDRESS_AFFORDANCE = 'No address? Describe the location instead';
+const SENSITIVITY_LABEL = 'Not suitable for kids';
+const CTA_NEXT = 'Next →';
+const CTA_AT_LOCATION = "I'm at This Location";
+const SUCCESS_HEADING = 'Location Submitted!';
+const SUCCESS_BODY =
+  "It'll appear publicly after 2 GPS verifications. You can see it on the map now.";
+const SENSITIVITY_CONFIRM_BODY = 'This location will be hidden from Family mode users';
+const ERR_08 = "Couldn't submit your location. Check your connection and try again.";
+const ERR_02 = 'GPS accuracy too low — move to an open area and try again.';
+
+function freshSample(accuracy: number) {
+  return {
+    coord: { lat: 44.05, lng: -123.09 },
+    accuracy,
+    mocked: false,
+    timestamp: Date.now(),
+  };
+}
+
+async function renderWizard() {
+  const queryClient = new QueryClient({
+    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
+  });
+  const utils = render(
+    <QueryClientProvider client={queryClient}>
+      <SubmitScreen />
+    </QueryClientProvider>,
+  );
+  await act(async () => {
+    await Promise.resolve();
+  });
+  return utils;
+}
+
+/** Fill Step 1 (name + policy tag) and advance to Step 2. */
+async function advanceToStep2(
+  utils: Awaited<ReturnType<typeof renderWizard>>,
+  policyLabel = 'Chill Spot',
+) {
+  fireEvent.changeText(utils.getByLabelText('Name'), 'Corner Cafe');
+  fireEvent.press(utils.getByText(policyLabel));
+  await act(async () => {
+    fireEvent.press(utils.getByText(CTA_NEXT));
+    await Promise.resolve();
+  });
+}
+
+/** Advance from a rendered Step 2 to Step 3 (GPS confirm); flush the getGpsSample read. */
+async function advanceToStep3(utils: Awaited<ReturnType<typeof renderWizard>>) {
+  await waitFor(() => expect(utils.getAllByText(CTA_NEXT).length).toBeGreaterThan(0));
+  await act(async () => {
+    fireEvent.press(utils.getAllByText(CTA_NEXT)[0]);
+    await Promise.resolve();
+  });
+  await act(async () => {
+    await Promise.resolve();
+    await Promise.resolve();
+  });
+}
+
+beforeEach(() => {
+  jest.clearAllMocks();
+  mockSessionValue = { session: { user: { id: 'user-1', email: 'jamie@example.com' } } };
+  mockGetGpsSample.mockResolvedValue({
+    coord: { lat: 44.05, lng: -123.09 },
+    accuracy: 10,
+    mocked: false,
+    timestamp: Date.now(),
+  });
+  mockSubmitLocation.mockResolvedValue('new-location-id');
+});
+
+describe('SubmitScreen — auth gate (D-18)', () => {
+  it('shows the AuthRequiredModal and no form when signed out', async () => {
+    mockSessionValue = { session: null };
+    const utils = await renderWizard();
+    expect(utils.getByText('Sign in to submit')).toBeTruthy();
+    // The form is not mounted — no name field, no sensitivity switch.
+    expect(utils.queryByLabelText('Name')).toBeNull();
+    expect(utils.queryByText(SENSITIVITY_LABEL)).toBeNull();
+  });
+
+  it('mounts the form (Step 1) when signed in', async () => {
+    const utils = await renderWizard();
+    expect(utils.getByLabelText('Name')).toBeTruthy();
+    expect(utils.getByText(SENSITIVITY_LABEL)).toBeTruthy();
+  });
+});
+
+describe('SubmitScreen — Step 1 (D-04 / D-10 / D-13)', () => {
+  it('renders the free-text address affordance (D-04)', async () => {
+    const utils = await renderWizard();
+    expect(utils.getByText(ADDRESS_AFFORDANCE)).toBeTruthy();
+  });
+
+  it('renders the sensitivity control as an RN Switch (not a chip)', async () => {
+    const utils = await renderWizard();
+    const toggle = utils.getByLabelText(SENSITIVITY_LABEL);
+    expect(toggle.props.accessibilityRole).toBe('switch');
+  });
+});
+
+describe('SubmitScreen — Step 2 conditional PIN (D-17)', () => {
+  it('does NOT render the PIN field for a non-code_required policy', async () => {
+    const utils = await renderWizard();
+    await advanceToStep2(utils, 'Chill Spot');
+    await waitFor(() => expect(utils.queryByLabelText('Hours')).toBeTruthy());
+    expect(utils.queryByText(PIN_LABEL)).toBeNull();
+  });
+
+  it('renders the PIN field with LOCKED helper copy when policy is Code Required', async () => {
+    const utils = await renderWizard();
+    await advanceToStep2(utils, 'Code Required');
+    await waitFor(() => expect(utils.getByText(PIN_LABEL)).toBeTruthy());
+  });
+});
+
+describe('SubmitScreen — Step 3 GPS gate (SC8 / ERR-02)', () => {
+  it('disables "I\'m at This Location" and shows ERR-02 when accuracy > 50m', async () => {
+    mockGetGpsSample.mockResolvedValue(freshSample(80));
+    const utils = await renderWizard();
+    await advanceToStep2(utils, 'Chill Spot');
+    await advanceToStep3(utils);
+    await waitFor(() => expect(utils.getByText(ERR_02)).toBeTruthy());
+    const cta = utils.getByLabelText(CTA_AT_LOCATION);
+    expect(cta.props.accessibilityState.disabled).toBe(true);
+    expect(mockSubmitLocation).not.toHaveBeenCalled();
+  });
+
+  it('enables the CTA with a good, fresh, non-mocked sample (≤ 50m)', async () => {
+    const utils = await renderWizard();
+    await advanceToStep2(utils, 'Chill Spot');
+    await advanceToStep3(utils);
+    await waitFor(() => {
+      const cta = utils.getByLabelText(CTA_AT_LOCATION);
+      expect(cta.props.accessibilityState.disabled).toBe(false);
+    });
+  });
+});
+
+describe('SubmitScreen — sensitivity confirm gate (D-15)', () => {
+  it('opens SensitivityConfirmModal before submitLocation when sensitivity is ON', async () => {
+    const utils = await renderWizard();
+    fireEvent(utils.getByLabelText(SENSITIVITY_LABEL), 'valueChange', true);
+    await advanceToStep2(utils, 'Chill Spot');
+    await advanceToStep3(utils);
+
+    await waitFor(() => {
+      const cta = utils.getByLabelText(CTA_AT_LOCATION);
+      expect(cta.props.accessibilityState.disabled).toBe(false);
+    });
+    fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));
+
+    await waitFor(() => expect(utils.getByText(SENSITIVITY_CONFIRM_BODY)).toBeTruthy());
+    expect(mockSubmitLocation).not.toHaveBeenCalled();
+
+    await act(async () => {
+      fireEvent.press(utils.getByText('Confirm'));
+      await Promise.resolve();
+    });
+    await waitFor(() => expect(mockSubmitLocation).toHaveBeenCalledTimes(1));
+  });
+
+  it('submits directly (no dialog) when sensitivity is OFF and reaches the Success screen', async () => {
+    const utils = await renderWizard();
+    await advanceToStep2(utils, 'Chill Spot');
+    await advanceToStep3(utils);
+    await waitFor(() => {
+      const cta = utils.getByLabelText(CTA_AT_LOCATION);
+      expect(cta.props.accessibilityState.disabled).toBe(false);
+    });
+    await act(async () => {
+      fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));
+      await Promise.resolve();
+    });
+    expect(utils.queryByText(SENSITIVITY_CONFIRM_BODY)).toBeNull();
+    await waitFor(() => expect(mockSubmitLocation).toHaveBeenCalledTimes(1));
+    expect(await utils.findByText(SUCCESS_HEADING)).toBeTruthy();
+    expect(utils.getByText(SUCCESS_BODY)).toBeTruthy();
+    expect(utils.getByText('Back to Map')).toBeTruthy();
+  });
+
+  it('retains a typed Hours value and forwards it to submitLocation', async () => {
+    const utils = await renderWizard();
+    await advanceToStep2(utils, 'Chill Spot');
+    fireEvent.changeText(utils.getByLabelText('Hours'), 'Open 7am-10pm');
+    await advanceToStep3(utils);
+    await waitFor(() => {
+      const cta = utils.getByLabelText(CTA_AT_LOCATION);
+      expect(cta.props.accessibilityState.disabled).toBe(false);
+    });
+    await act(async () => {
+      fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));
+      await Promise.resolve();
+    });
+    await waitFor(() => expect(mockSubmitLocation).toHaveBeenCalledTimes(1));
+    expect(mockSubmitLocation).toHaveBeenCalledWith(
+      expect.objectContaining({ hours: 'Open 7am-10pm' })
+    );
+  });
+});
+
+describe('SubmitScreen — submit failure maps to ERR-08 (SC7)', () => {
+  it('renders LOCKED ERR-08 and does NOT clear the form on RPC error', async () => {
+    mockSubmitLocation.mockRejectedValue(new Error('gps rejected'));
+    const utils = await renderWizard();
+    await advanceToStep2(utils, 'Chill Spot');
+    await advanceToStep3(utils);
+    await waitFor(() => {
+      const cta = utils.getByLabelText(CTA_AT_LOCATION);
+      expect(cta.props.accessibilityState.disabled).toBe(false);
+    });
+    await act(async () => {
+      fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));
+      await Promise.resolve();
+    });
+    expect(await utils.findByText(ERR_08)).toBeTruthy();
+    // Never surfaces the raw rejection reason (SC7).
+    expect(utils.queryByText('gps rejected')).toBeNull();
+    // Still on Step 3 (form preserved, not success).
+    expect(utils.queryByText(SUCCESS_HEADING)).toBeNull();
+    expect(utils.getByLabelText(CTA_AT_LOCATION)).toBeTruthy();
+  });
+});
diff --git a/app/src/features/submit/__tests__/submitLocation.test.ts b/app/src/features/submit/__tests__/submitLocation.test.ts
new file mode 100644
index 0000000..3baa479
--- /dev/null
+++ b/app/src/features/submit/__tests__/submitLocation.test.ts
@@ -0,0 +1,167 @@
+// Mock the supabase singleton so rpc() calls can be intercepted
+jest.mock('../../../lib/supabase', () => ({
+  supabase: {
+    rpc: jest.fn(),
+    auth: {
+      getSession: jest.fn(),
+      onAuthStateChange: jest.fn(() => ({
+        data: { subscription: { unsubscribe: jest.fn() } },
+      })),
+      signOut: jest.fn(),
+    },
+  },
+}));
+
+import { submitLocation } from '../submitLocation';
+import type { SubmitInput } from '../types';
+
+const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
+  rpc: jest.Mock;
+};
+
+beforeEach(() => {
+  jest.clearAllMocks();
+});
+
+function baseInput(overrides: Partial<SubmitInput> = {}): SubmitInput {
+  return {
+    name: 'Alton Baker Park restroom',
+    lat: 44.05,
+    lng: -123.08,
+    accuracy: 12,
+    mocked: false,
+    timestamp: 1799999999000,
+    policyTag: 'public_facility',
+    address: 'North parking lot',
+    sensitive: false,
+    hours: undefined,
+    accessCode: undefined,
+    timingTip: undefined,
+    ...overrides,
+  };
+}
+
+describe('submitLocation', () => {
+  it('calls the submit_location RPC with the full p_* mapping', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'submission-id-123', error: null });
+
+    await submitLocation(baseInput());
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith('submit_location', {
+      p_name: 'Alton Baker Park restroom',
+      p_lat: 44.05,
+      p_lng: -123.08,
+      p_accuracy_m: 12,
+      p_mocked: false,
+      p_captured_at: new Date(1799999999000).toISOString(),
+      p_policy_tag: 'public_facility',
+      p_address: 'North parking lot',
+      p_access_sensitivity: undefined,
+      p_hours: undefined,
+      p_access_code: undefined,
+      p_timing_tip: undefined,
+    });
+  });
+
+  it('maps sensitive:true to p_access_sensitivity "sensitive" (D-09)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });
+
+    await submitLocation(baseInput({ sensitive: true }));
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith(
+      'submit_location',
+      expect.objectContaining({ p_access_sensitivity: 'sensitive' })
+    );
+  });
+
+  it('maps sensitive:false to p_access_sensitivity undefined — omits the key so the RPC default (null) applies (D-09)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });
+
+    await submitLocation(baseInput({ sensitive: false }));
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith(
+      'submit_location',
+      expect.objectContaining({ p_access_sensitivity: undefined })
+    );
+  });
+
+  it('sends p_access_code undefined when policyTag is code_required but accessCode is absent (D-19 optional)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });
+
+    await submitLocation(baseInput({ policyTag: 'code_required', accessCode: undefined }));
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith(
+      'submit_location',
+      expect.objectContaining({ p_access_code: undefined })
+    );
+  });
+
+  it('sends p_access_code when policyTag is code_required (D-17)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });
+
+    await submitLocation(baseInput({ policyTag: 'code_required', accessCode: '1234' }));
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith(
+      'submit_location',
+      expect.objectContaining({ p_access_code: '1234' })
+    );
+  });
+
+  it('omits p_access_code (undefined) when policyTag is not code_required, even if accessCode is present (D-17)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });
+
+    await submitLocation(baseInput({ policyTag: 'public_facility', accessCode: '1234' }));
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith(
+      'submit_location',
+      expect.objectContaining({ p_access_code: undefined })
+    );
+  });
+
+  it('rethrows the raw RPC error unchanged (including the generic "gps rejected" error)', async () => {
+    const rpcError = new Error('gps rejected');
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });
+
+    await expect(submitLocation(baseInput())).rejects.toBe(rpcError);
+  });
+
+  it('returns the submission id string on success', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'submission-id-456', error: null });
+
+    await expect(submitLocation(baseInput())).resolves.toBe('submission-id-456');
+  });
+
+  it('maps a missing address to p_address undefined (D-04 free-text-only submissions)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });
+
+    await submitLocation(baseInput({ address: undefined }));
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith(
+      'submit_location',
+      expect.objectContaining({ p_address: undefined })
+    );
+  });
+
+  it('forwards a provided hours description as p_hours', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });
+    const hours = 'Open 7am-10pm';
+
+    await submitLocation(baseInput({ hours }));
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith(
+      'submit_location',
+      expect.objectContaining({ p_hours: hours })
+    );
+  });
+
+  it('forwards a provided timing tip as p_timing_tip', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });
+
+    await submitLocation(baseInput({ timingTip: 'Busiest around lunch' }));
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith(
+      'submit_location',
+      expect.objectContaining({ p_timing_tip: 'Busiest around lunch' })
+    );
+  });
+});
diff --git a/app/src/features/submit/__tests__/submitSchema.test.ts b/app/src/features/submit/__tests__/submitSchema.test.ts
new file mode 100644
index 0000000..c614b59
--- /dev/null
+++ b/app/src/features/submit/__tests__/submitSchema.test.ts
@@ -0,0 +1,127 @@
+import { submitSchema } from '../submitSchema';
+
+function validInput(overrides: Record<string, unknown> = {}) {
+  return {
+    name: 'Alton Baker Park restroom',
+    address: 'North parking lot',
+    policyTag: 'public_facility',
+    accessSensitivity: false,
+    hours: undefined,
+    accessCode: undefined,
+    timingTip: undefined,
+    ...overrides,
+  };
+}
+
+describe('submitSchema', () => {
+  it('rejects an empty name', () => {
+    const result = submitSchema.safeParse(validInput({ name: '' }));
+    expect(result.success).toBe(false);
+  });
+
+  it('accepts a valid full object', () => {
+    const result = submitSchema.safeParse(validInput());
+    expect(result.success).toBe(true);
+  });
+
+  it('rejects a policyTag outside the 4-value enum', () => {
+    const result = submitSchema.safeParse(validInput({ policyTag: 'not_a_real_tag' }));
+    expect(result.success).toBe(false);
+  });
+
+  it('accepts each of the 4 valid policyTag values', () => {
+    for (const tag of ['chill_spot', 'purchase_required', 'code_required', 'public_facility']) {
+      const result = submitSchema.safeParse(validInput({ policyTag: tag }));
+      expect(result.success).toBe(true);
+    }
+  });
+
+  it('accepts accessCode absent even when policyTag is code_required (D-19 optional)', () => {
+    const result = submitSchema.safeParse(
+      validInput({ policyTag: 'code_required', accessCode: undefined })
+    );
+    expect(result.success).toBe(true);
+  });
+
+  it('accepts accessCode present when policyTag is code_required', () => {
+    const result = submitSchema.safeParse(
+      validInput({ policyTag: 'code_required', accessCode: '1234' })
+    );
+    expect(result.success).toBe(true);
+  });
+
+  it('flags an issue on accessCode when it is supplied but policyTag is not code_required', () => {
+    const result = submitSchema.safeParse(
+      validInput({ policyTag: 'public_facility', accessCode: '1234' })
+    );
+    expect(result.success).toBe(false);
+    if (!result.success) {
+      expect(result.error.issues.some((issue) => issue.path.includes('accessCode'))).toBe(true);
+    }
+  });
+
+  it('defaults accessSensitivity to false when omitted', () => {
+    const input = validInput();
+    delete (input as Record<string, unknown>).accessSensitivity;
+    const result = submitSchema.safeParse(input);
+    expect(result.success).toBe(true);
+    if (result.success) {
+      expect(result.data.accessSensitivity).toBe(false);
+    }
+  });
+
+  it('accepts accessSensitivity true', () => {
+    const result = submitSchema.safeParse(validInput({ accessSensitivity: true }));
+    expect(result.success).toBe(true);
+    if (result.success) {
+      expect(result.data.accessSensitivity).toBe(true);
+    }
+  });
+
+  it('rejects a name over 120 characters', () => {
+    const result = submitSchema.safeParse(validInput({ name: 'a'.repeat(121) }));
+    expect(result.success).toBe(false);
+  });
+
+  it('rejects an address over 200 characters', () => {
+    const result = submitSchema.safeParse(validInput({ address: 'a'.repeat(201) }));
+    expect(result.success).toBe(false);
+  });
+
+  it('accepts address omitted (label-only, optional per D-05)', () => {
+    const result = submitSchema.safeParse(validInput({ address: undefined }));
+    expect(result.success).toBe(true);
+  });
+
+  it('rejects a timingTip over 280 characters', () => {
+    const result = submitSchema.safeParse(validInput({ timingTip: 'a'.repeat(281) }));
+    expect(result.success).toBe(false);
+  });
+
+  it('accepts a timingTip within the limit', () => {
+    const result = submitSchema.safeParse(validInput({ timingTip: 'Busiest around lunch' }));
+    expect(result.success).toBe(true);
+  });
+
+  it('rejects an accessCode over 100 characters (D-20 generous but bounded)', () => {
+    const result = submitSchema.safeParse(
+      validInput({ policyTag: 'code_required', accessCode: 'a'.repeat(101) })
+    );
+    expect(result.success).toBe(false);
+  });
+
+  it('accepts an hours description', () => {
+    const result = submitSchema.safeParse(validInput({ hours: 'Open 7am-10pm' }));
+    expect(result.success).toBe(true);
+  });
+
+  it('rejects an hours description over 200 characters', () => {
+    const result = submitSchema.safeParse(validInput({ hours: 'a'.repeat(201) }));
+    expect(result.success).toBe(false);
+  });
+
+  it('accepts hours omitted', () => {
+    const result = submitSchema.safeParse(validInput({ hours: undefined }));
+    expect(result.success).toBe(true);
+  });
+});
diff --git a/app/src/features/submit/__tests__/updateAccessCode.test.ts b/app/src/features/submit/__tests__/updateAccessCode.test.ts
new file mode 100644
index 0000000..e9ceac8
--- /dev/null
+++ b/app/src/features/submit/__tests__/updateAccessCode.test.ts
@@ -0,0 +1,82 @@
+// Mock the supabase singleton so rpc() calls can be intercepted
+jest.mock('../../../lib/supabase', () => ({
+  supabase: {
+    rpc: jest.fn(),
+    auth: {
+      getSession: jest.fn(),
+      onAuthStateChange: jest.fn(() => ({
+        data: { subscription: { unsubscribe: jest.fn() } },
+      })),
+      signOut: jest.fn(),
+    },
+  },
+}));
+
+import { updateAccessCode, confirmAccessCode, getAccessCode } from '../updateAccessCode';
+
+const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
+  rpc: jest.Mock;
+};
+
+beforeEach(() => {
+  jest.clearAllMocks();
+});
+
+describe('updateAccessCode', () => {
+  it('calls the update_access_code RPC with { p_location_id, p_code } (stage only)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
+
+    await updateAccessCode('loc-1', '1234');
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_access_code', {
+      p_location_id: 'loc-1',
+      p_code: '1234',
+    });
+  });
+
+  it('rethrows the raw RPC error unchanged', async () => {
+    const rpcError = new Error('update failed');
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });
+
+    await expect(updateAccessCode('loc-1', '1234')).rejects.toBe(rpcError);
+  });
+});
+
+describe('confirmAccessCode', () => {
+  it('calls the confirm_access_code RPC with { p_location_id }', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
+
+    await confirmAccessCode('loc-1');
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith('confirm_access_code', {
+      p_location_id: 'loc-1',
+    });
+  });
+
+  it('rethrows the raw RPC error unchanged', async () => {
+    const rpcError = new Error('confirm failed');
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });
+
+    await expect(confirmAccessCode('loc-1')).rejects.toBe(rpcError);
+  });
+});
+
+describe('getAccessCode', () => {
+  it('calls the get_access_code RPC with { p_location_id } and returns the code string', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: '4821', error: null });
+
+    const code = await getAccessCode('loc-1');
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_access_code', {
+      p_location_id: 'loc-1',
+    });
+    expect(code).toBe('4821');
+  });
+
+  it('rethrows the raw RPC error unchanged', async () => {
+    const rpcError = new Error('get failed');
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });
+
+    await expect(getAccessCode('loc-1')).rejects.toBe(rpcError);
+  });
+});
diff --git a/app/src/features/submit/__tests__/useGpsSample.test.ts b/app/src/features/submit/__tests__/useGpsSample.test.ts
new file mode 100644
index 0000000..685c32a
--- /dev/null
+++ b/app/src/features/submit/__tests__/useGpsSample.test.ts
@@ -0,0 +1,108 @@
+// expo-location is mocked in jest.setup.ts (getCurrentPositionAsync +
+// requestForegroundPermissionsAsync are jest.fn(); Accuracy is a value map).
+// getGpsSample is the high-accuracy submission GPS reader the SubmitFlow Step 3
+// consumes — it returns the full {coord, accuracy, mocked, timestamp} sample or a
+// {denied:true} sentinel (never throws) so the wizard maps denial to friendly copy.
+import * as Location from 'expo-location';
+import { getGpsSample } from '../useGpsSample';
+
+const mockPerm = Location.requestForegroundPermissionsAsync as jest.Mock;
+const mockPos = Location.getCurrentPositionAsync as jest.Mock;
+
+beforeEach(() => {
+  jest.clearAllMocks();
+});
+
+describe('getGpsSample', () => {
+  it('returns the full sample in high-accuracy mode for a granted permission + fix', async () => {
+    mockPerm.mockResolvedValue({ status: 'granted' });
+    mockPos.mockResolvedValue({
+      coords: { latitude: 44.05, longitude: -123.09, accuracy: 8 },
+      mocked: false,
+      timestamp: 1_700_000_000_000,
+    });
+
+    const result = await getGpsSample();
+
+    expect(result).toEqual({
+      coord: { lat: 44.05, lng: -123.09 },
+      accuracy: 8,
+      mocked: false,
+      timestamp: 1_700_000_000_000,
+    });
+    // High-accuracy mode (SC1): must request BestForNavigation, not Balanced.
+    expect(mockPos).toHaveBeenCalledWith({
+      accuracy: Location.Accuracy.BestForNavigation,
+    });
+  });
+
+  it('surfaces mocked:true when the OS reports a mock provider (Android)', async () => {
+    mockPerm.mockResolvedValue({ status: 'granted' });
+    mockPos.mockResolvedValue({
+      coords: { latitude: 1, longitude: 2, accuracy: 5 },
+      mocked: true,
+      timestamp: 1,
+    });
+
+    const result = await getGpsSample();
+
+    expect(result).toEqual(expect.objectContaining({ mocked: true }));
+  });
+
+  it('normalizes an undefined mocked flag (iOS) to mocked:false', async () => {
+    mockPerm.mockResolvedValue({ status: 'granted' });
+    mockPos.mockResolvedValue({
+      coords: { latitude: 1, longitude: 2, accuracy: 5 },
+      mocked: undefined, // iOS: LocationObject.mocked is Android-only
+      timestamp: 1,
+    });
+
+    const result = await getGpsSample();
+
+    expect(result).toEqual(expect.objectContaining({ mocked: false }));
+  });
+
+  it('surfaces a low-accuracy fix as-is (the hook is advisory; the server rejects)', async () => {
+    mockPerm.mockResolvedValue({ status: 'granted' });
+    mockPos.mockResolvedValue({
+      coords: { latitude: 1, longitude: 2, accuracy: 200 },
+      mocked: false,
+      timestamp: 1,
+    });
+
+    const result = await getGpsSample();
+
+    expect(result).toEqual(expect.objectContaining({ accuracy: 200 }));
+  });
+
+  it('surfaces a null accuracy when the OS provides none', async () => {
+    mockPerm.mockResolvedValue({ status: 'granted' });
+    mockPos.mockResolvedValue({
+      coords: { latitude: 1, longitude: 2, accuracy: null },
+      mocked: false,
+      timestamp: 1,
+    });
+
+    const result = await getGpsSample();
+
+    expect(result).toEqual(expect.objectContaining({ accuracy: null }));
+  });
+
+  it('returns the {denied:true} sentinel without throwing when permission is denied', async () => {
+    mockPerm.mockResolvedValue({ status: 'denied' });
+
+    const result = await getGpsSample();
+
+    expect(result).toEqual({ denied: true });
+    expect(mockPos).not.toHaveBeenCalled();
+  });
+
+  it('returns {denied:true} for an undetermined permission (any non-granted status)', async () => {
+    mockPerm.mockResolvedValue({ status: 'undetermined' });
+
+    const result = await getGpsSample();
+
+    expect(result).toEqual({ denied: true });
+    expect(mockPos).not.toHaveBeenCalled();
+  });
+});
diff --git a/app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts b/app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts
new file mode 100644
index 0000000..760ecfa
--- /dev/null
+++ b/app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts
@@ -0,0 +1,97 @@
+// Mock the supabase singleton so rpc() calls can be intercepted
+jest.mock('../../../lib/supabase', () => ({
+  supabase: {
+    rpc: jest.fn(),
+    auth: {
+      getSession: jest.fn(),
+      onAuthStateChange: jest.fn(() => ({
+        data: { subscription: { unsubscribe: jest.fn() } },
+      })),
+      signOut: jest.fn(),
+    },
+  },
+}));
+
+import { useMyPendingSubmissions } from '../useMyPendingSubmissions';
+
+const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
+  rpc: jest.Mock;
+};
+
+beforeEach(() => {
+  jest.clearAllMocks();
+});
+
+function pendingRow(overrides: Record<string, unknown> = {}) {
+  return {
+    id: 'sub-1',
+    name: 'Alton Baker Park restroom',
+    lat: 44.05,
+    lng: -123.08,
+    policy_tag: 'public_facility',
+    confirmation_count: 1,
+    expires_at: '2026-08-01T00:00:00.000Z',
+    ...overrides,
+  };
+}
+
+describe('useMyPendingSubmissions', () => {
+  it('calls the get_my_pending_submissions RPC with no argument', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
+
+    await useMyPendingSubmissions();
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_my_pending_submissions');
+    // No second argument object — the RPC takes no params (authed-only, server-scoped).
+    expect(mockSupabase.rpc.mock.calls[0]).toHaveLength(1);
+  });
+
+  it('maps each row to a GeoJSON Point feature with [lng, lat] coordinates', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: [pendingRow()], error: null });
+
+    const result = await useMyPendingSubmissions();
+
+    expect(result.type).toBe('FeatureCollection');
+    expect(result.features).toHaveLength(1);
+    const feature = result.features[0];
+    expect(feature.type).toBe('Feature');
+    expect(feature.geometry).toEqual({ type: 'Point', coordinates: [-123.08, 44.05] });
+  });
+
+  it('carries id, name, policyTag, confirmationCount and expiresAt in feature properties (D-27, no refetch)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: [pendingRow()], error: null });
+
+    const result = await useMyPendingSubmissions();
+
+    expect(result.features[0].properties).toEqual({
+      id: 'sub-1',
+      name: 'Alton Baker Park restroom',
+      policyTag: 'public_facility',
+      confirmationCount: 1,
+      expiresAt: '2026-08-01T00:00:00.000Z',
+    });
+  });
+
+  it('returns an empty FeatureCollection when data is an empty array', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
+
+    const result = await useMyPendingSubmissions();
+
+    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
+  });
+
+  it('returns an empty FeatureCollection when data is null (no crash)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
+
+    const result = await useMyPendingSubmissions();
+
+    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
+  });
+
+  it('throws when the RPC returns an error', async () => {
+    const rpcError = new Error('rpc failed');
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });
+
+    await expect(useMyPendingSubmissions()).rejects.toBe(rpcError);
+  });
+});
diff --git a/app/src/features/submit/__tests__/withdrawSubmission.test.ts b/app/src/features/submit/__tests__/withdrawSubmission.test.ts
new file mode 100644
index 0000000..fb1e634
--- /dev/null
+++ b/app/src/features/submit/__tests__/withdrawSubmission.test.ts
@@ -0,0 +1,48 @@
+// Mock the supabase singleton so rpc() calls can be intercepted
+jest.mock('../../../lib/supabase', () => ({
+  supabase: {
+    rpc: jest.fn(),
+    auth: {
+      getSession: jest.fn(),
+      onAuthStateChange: jest.fn(() => ({
+        data: { subscription: { unsubscribe: jest.fn() } },
+      })),
+      signOut: jest.fn(),
+    },
+  },
+}));
+
+import { withdrawSubmission } from '../withdrawSubmission';
+
+const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
+  rpc: jest.Mock;
+};
+
+beforeEach(() => {
+  jest.clearAllMocks();
+});
+
+describe('withdrawSubmission', () => {
+  it('calls the withdraw_submission RPC with the p_submission_id arg', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
+
+    await withdrawSubmission('sub-123');
+
+    expect(mockSupabase.rpc).toHaveBeenCalledWith('withdraw_submission', {
+      p_submission_id: 'sub-123',
+    });
+  });
+
+  it('resolves void on success (does not navigate or refetch)', async () => {
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
+
+    await expect(withdrawSubmission('sub-123')).resolves.toBeUndefined();
+  });
+
+  it('rethrows the raw RPC error unchanged', async () => {
+    const rpcError = new Error('withdraw failed');
+    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });
+
+    await expect(withdrawSubmission('sub-123')).rejects.toBe(rpcError);
+  });
+});
diff --git a/app/src/features/submit/submitLocation.ts b/app/src/features/submit/submitLocation.ts
new file mode 100644
index 0000000..5269ce2
--- /dev/null
+++ b/app/src/features/submit/submitLocation.ts
@@ -0,0 +1,39 @@
+import { supabase } from '../../lib/supabase';
+import type { Database } from '../../lib/database.types';
+import type { SubmitInput } from './types';
+
+type SubmitLocationArgs = Database['public']['Functions']['submit_location']['Args'];
+
+/**
+ * Submits a new bathroom location via the `submit_location` SECURITY DEFINER RPC.
+ *
+ * Maps `sensitive` to `p_access_sensitivity` ('sensitive' | null, D-09) and forwards
+ * `accessCode` only when `policyTag === 'code_required'` (D-17). The server independently
+ * re-validates GPS accuracy/freshness/mock-detection (Pitfall 1) — any rejection error
+ * (including the generic 'gps rejected') is rethrown unchanged; the wizard maps it to
+ * locked friendly copy (SC7), not this layer.
+ */
+export async function submitLocation(input: SubmitInput): Promise<string> {
+  // p_accuracy_m has no SQL DEFAULT (required arg) but the column/param IS nullable at
+  // the Postgres level — the RPC explicitly checks `p_accuracy_m is null` (SC2/SC7).
+  // The generated Args type omits `| null` for required args, so a targeted cast is
+  // needed here; every other field below is truly optional (has a SQL DEFAULT NULL)
+  // and uses `?? undefined` so omitting the key triggers that same default.
+  const args: SubmitLocationArgs = {
+    p_name: input.name,
+    p_lat: input.lat,
+    p_lng: input.lng,
+    p_accuracy_m: input.accuracy as SubmitLocationArgs['p_accuracy_m'],
+    p_mocked: input.mocked,
+    p_captured_at: new Date(input.timestamp).toISOString(),
+    p_policy_tag: input.policyTag,
+    p_address: input.address ?? undefined,
+    p_access_sensitivity: input.sensitive ? 'sensitive' : undefined,
+    p_hours: input.hours ?? undefined,
+    p_access_code: input.policyTag === 'code_required' ? (input.accessCode ?? undefined) : undefined,
+    p_timing_tip: input.timingTip ?? undefined,
+  };
+  const { data, error } = await supabase.rpc('submit_location', args);
+  if (error) throw error;
+  return data as string;
+}
diff --git a/app/src/features/submit/submitSchema.ts b/app/src/features/submit/submitSchema.ts
new file mode 100644
index 0000000..9e1616a
--- /dev/null
+++ b/app/src/features/submit/submitSchema.ts
@@ -0,0 +1,37 @@
+import { z } from 'zod';
+
+/**
+ * Zod schema for the SubmitFlow wizard (RESEARCH §Pattern 7).
+ *
+ * - `name`/`policyTag` are required; everything else is optional.
+ * - `address` is a label only (D-05) — never geocoded, coordinates always come from GPS.
+ * - `accessSensitivity` defaults to `false` (D-08) and maps to `'sensitive' | null` (D-09)
+ *   at the `submitLocation` layer, not here.
+ * - `accessCode` is optional even when `policyTag === 'code_required'` (D-19) — the field
+ *   only ever renders in that case (D-17), so a value present under any other tag indicates
+ *   a client bug, flagged via `superRefine`.
+ * - `hours` is a single free-text description (matches the Step 2 "Hours" input, e.g.
+ *   "Open 7am–10pm") — not structured per-day data. Staged as-is in the `submissions.hours`
+ *   jsonb column; Phase 5/8 owns any structured parsing at publish/display time.
+ */
+export const submitSchema = z
+  .object({
+    name: z.string().min(1, 'Name is required.').max(120, 'Name is too long.'),
+    address: z.string().max(200, 'Description is too long.').optional(),
+    policyTag: z.enum(['chill_spot', 'purchase_required', 'code_required', 'public_facility']),
+    accessSensitivity: z.boolean().default(false),
+    hours: z.string().max(200, 'Hours description is too long.').optional(),
+    accessCode: z.string().max(100, 'Door code is too long.').optional(),
+    timingTip: z.string().max(280, 'Timing tip is too long.').optional(),
+  })
+  .superRefine((val, ctx) => {
+    if (val.policyTag !== 'code_required' && val.accessCode) {
+      ctx.addIssue({
+        code: 'custom',
+        path: ['accessCode'],
+        message: 'Door code only applies to Code Required.',
+      });
+    }
+  });
+
+export type SubmitSchema = z.infer<typeof submitSchema>;
diff --git a/app/src/features/submit/types.ts b/app/src/features/submit/types.ts
new file mode 100644
index 0000000..fc6415a
--- /dev/null
+++ b/app/src/features/submit/types.ts
@@ -0,0 +1,105 @@
+/**
+ * Phase 4 submission service-layer types.
+ *
+ * These shapes back the client-side SubmitFlow building blocks:
+ *   - `GpsSample` — the high-accuracy GPS reading produced by `getGpsSample`
+ *     (canonical coordinate source per D-05; the server re-validates it).
+ *   - `SubmitInput` — the flattened wizard payload `submitLocation` maps into the
+ *     `submit_location` RPC's `p_*` arguments.
+ *
+ * The coordinate is carried as a plain `{lat, lng}` here; the RPC converts it to a
+ * PostGIS `geography(Point,4326)` server-side (schema-contract Coordinate Handling).
+ */
+
+/**
+ * A single high-accuracy GPS sample. `accuracy` is the OS-reported radius in meters
+ * (may be `null`). `mocked` is the Android mock-provider flag normalized to `false`
+ * on iOS (where `LocationObject.mocked` is `undefined`). `timestamp` is ms since epoch.
+ */
+export interface GpsSample {
+  coord: { lat: number; lng: number };
+  accuracy: number | null;
+  mocked: boolean;
+  timestamp: number;
+}
+
+/** Returned by `getGpsSample` when foreground-location permission is not granted. */
+export interface GpsDenied {
+  denied: true;
+}
+
+/**
+ * The flattened SubmitFlow payload consumed by `submitLocation`.
+ *
+ * `sensitive` maps to `p_access_sensitivity` = `'sensitive' | null` (D-09).
+ * `accessCode` is forwarded only when `policyTag === 'code_required'` (D-17).
+ * `timestamp` (ms since epoch, from the GPS sample) is serialized to an ISO string
+ * for the RPC's `p_captured_at` freshness check.
+ */
+export interface SubmitInput {
+  name: string;
+  lat: number;
+  lng: number;
+  accuracy: number | null;
+  mocked: boolean;
+  timestamp: number;
+  policyTag: string;
+  address?: string | null;
+  sensitive: boolean;
+  hours?: string | null;
+  accessCode?: string | null;
+  timingTip?: string | null;
+}
+
+// ---------------------------------------------------------------------------
+// Pending-submission GeoJSON transform (get_my_pending_submissions → map)
+// ---------------------------------------------------------------------------
+
+/**
+ * A single row from `get_my_pending_submissions` (authed-only; the server scopes
+ * to `submitter_id = auth.uid() and status = 'pending'`, D-27 / T-04-14 — there is
+ * NO client-side "my submissions" filter). `lat`/`lng` are the st_y/st_x extraction,
+ * identical to the published-path readers.
+ */
+export interface PendingSubmissionRpcRow {
+  id: string;
+  name: string;
+  lat: number;
+  lng: number;
+  policy_tag: string | null;
+  confirmation_count: number;
+  expires_at: string;
+}
+
+/**
+ * Properties carried on each pending-pin GeoJSON feature. Unlike the published
+ * `LocationFeatureProperties`, these carry verification progress
+ * (`confirmationCount` / `expiresAt`) so the pending-status sheet (D-27) reads
+ * them without a second fetch.
+ */
+export interface PendingSubmissionProperties {
+  id: string;
+  name: string;
+  policyTag: string | null;
+  confirmationCount: number;
+  expiresAt: string;
+}
+
+/** A single GeoJSON Point feature for one pending submission. Coordinates are [lng, lat]. */
+export interface PendingSubmissionFeature {
+  type: 'Feature';
+  geometry: {
+    type: 'Point';
+    coordinates: [number, number];
+  };
+  properties: PendingSubmissionProperties;
+}
+
+/**
+ * The FeatureCollection fed to the map's separate pending `ShapeSource`. Mirrors
+ * `LocationFeatureCollection`'s shape but with pending-specific properties.
+ */
+export interface PendingSubmissionFeatureCollection {
+  type: 'FeatureCollection';
+  features: PendingSubmissionFeature[];
+}
diff --git a/app/src/features/submit/updateAccessCode.ts b/app/src/features/submit/updateAccessCode.ts
new file mode 100644
index 0000000..6b80254
--- /dev/null
+++ b/app/src/features/submit/updateAccessCode.ts
@@ -0,0 +1,47 @@
+import { supabase } from '../../lib/supabase';
+
+/**
+ * Access-code (PIN) client wrappers for the D-21 / D-24 stage-then-confirm flow.
+ *
+ * These are thin `supabase.rpc` wrappers — they carry NO business logic. In particular
+ * `updateAccessCode` only STAGES a new code; it does NOT make it live. The
+ * different-user promotion gate (D-24) is enforced server-side (04-02) and cannot be
+ * bypassed from the client (T-04-15). No code value is ever logged (T-04-16).
+ */
+
+/**
+ * Stages a new access code for `locationId` via `update_access_code`. The code is not
+ * live until `confirmAccessCode` promotes it (subject to the server-side gate). Any RPC
+ * error is rethrown raw.
+ */
+export async function updateAccessCode(locationId: string, code: string): Promise<void> {
+  const { error } = await supabase.rpc('update_access_code', {
+    p_location_id: locationId,
+    p_code: code,
+  });
+  if (error) throw error;
+}
+
+/**
+ * Promotes the staged access code for `locationId` via `confirm_access_code`. The
+ * different-user gate is server-side. Any RPC error is rethrown raw.
+ */
+export async function confirmAccessCode(locationId: string): Promise<void> {
+  const { error } = await supabase.rpc('confirm_access_code', {
+    p_location_id: locationId,
+  });
+  if (error) throw error;
+}
+
+/**
+ * Reads the current access code for `locationId` via the authed-only `get_access_code`
+ * RPC, returning it as a string for the signed-in UI only (never logged, T-04-16). Any
+ * RPC error is rethrown raw.
+ */
+export async function getAccessCode(locationId: string): Promise<string> {
+  const { data, error } = await supabase.rpc('get_access_code', {
+    p_location_id: locationId,
+  });
+  if (error) throw error;
+  return data as string;
+}
diff --git a/app/src/features/submit/useGpsSample.ts b/app/src/features/submit/useGpsSample.ts
new file mode 100644
index 0000000..c3bf025
--- /dev/null
+++ b/app/src/features/submit/useGpsSample.ts
@@ -0,0 +1,36 @@
+import * as Location from 'expo-location';
+import type { GpsDenied, GpsSample } from './types';
+
+/**
+ * Reads a single high-accuracy GPS sample for the SubmitFlow GPS-confirm step (SC1).
+ *
+ * Requests foreground-location permission and, on grant, takes one fix in
+ * `Accuracy.BestForNavigation` mode (higher precision than the `Balanced` mode the
+ * Phase 3 map uses — submission coordinates are the canonical location source, D-05).
+ *
+ * Returns the raw sample so the wizard can pre-check accuracy/freshness (advisory
+ * only — the `submit_location` RPC re-validates and is the authority, RESEARCH
+ * Pattern 2 / Pitfall 1). `mocked` is normalized with `?? false` because
+ * `LocationObject.mocked` is Android-only (`undefined` on iOS, which does not permit
+ * mock locations without a jailbreak).
+ *
+ * Never throws on a non-granted permission — it returns a `{denied:true}` sentinel so
+ * the caller renders the ERR-01 "use search instead" state rather than a dead end.
+ */
+export async function getGpsSample(): Promise<GpsSample | GpsDenied> {
+  const perm = await Location.requestForegroundPermissionsAsync();
+  if (perm.status !== 'granted') {
+    return { denied: true };
+  }
+
+  const pos = await Location.getCurrentPositionAsync({
+    accuracy: Location.Accuracy.BestForNavigation,
+  });
+
+  return {
+    coord: { lat: pos.coords.latitude, lng: pos.coords.longitude },
+    accuracy: pos.coords.accuracy,
+    mocked: pos.mocked ?? false,
+    timestamp: pos.timestamp,
+  };
+}
diff --git a/app/src/features/submit/useMyPendingSubmissions.ts b/app/src/features/submit/useMyPendingSubmissions.ts
new file mode 100644
index 0000000..e7e82a1
--- /dev/null
+++ b/app/src/features/submit/useMyPendingSubmissions.ts
@@ -0,0 +1,42 @@
+import { supabase } from '../../lib/supabase';
+import type {
+  PendingSubmissionFeatureCollection,
+  PendingSubmissionRpcRow,
+} from './types';
+
+/**
+ * Fetches the signed-in user's pending submissions via the authed-only
+ * `get_my_pending_submissions` RPC and transforms the rows into a GeoJSON
+ * FeatureCollection for the map's separate pending `ShapeSource`.
+ *
+ * Scoping is entirely server-side (`submitter_id = auth.uid()`, 04-01 / T-04-14):
+ * this call takes NO arguments and applies no client-side "my submissions" filter,
+ * which would leak. Point coordinates are `[lng, lat]` (GeoJSON order), matching the
+ * published bbox layer. Each feature carries `confirmationCount` + `expiresAt` in its
+ * properties so the pending-status sheet (D-27) needs no second fetch. Throws when the
+ * RPC errors.
+ */
+export async function useMyPendingSubmissions(): Promise<PendingSubmissionFeatureCollection> {
+  const { data, error } = await supabase.rpc('get_my_pending_submissions');
+  if (error) throw error;
+
+  const rows = (data ?? []) as unknown as PendingSubmissionRpcRow[];
+
+  return {
+    type: 'FeatureCollection',
+    features: rows.map((row) => ({
+      type: 'Feature',
+      geometry: {
+        type: 'Point',
+        coordinates: [row.lng, row.lat],
+      },
+      properties: {
+        id: row.id,
+        name: row.name,
+        policyTag: row.policy_tag,
+        confirmationCount: row.confirmation_count,
+        expiresAt: row.expires_at,
+      },
+    })),
+  };
+}
diff --git a/app/src/features/submit/withdrawSubmission.ts b/app/src/features/submit/withdrawSubmission.ts
new file mode 100644
index 0000000..6e4182a
--- /dev/null
+++ b/app/src/features/submit/withdrawSubmission.ts
@@ -0,0 +1,17 @@
+import { supabase } from '../../lib/supabase';
+
+/**
+ * Withdraws one of the signed-in user's pending submissions via the
+ * `withdraw_submission` SECURITY DEFINER RPC (D-28 / D-29). The server DELETEs the
+ * row only when it is the caller's own pending submission (`submitter_id = auth.uid()`,
+ * 04-01) — this wrapper cannot bypass that scoping.
+ *
+ * This module does NOT navigate or refetch on success — the caller invalidates the
+ * `['pendingSubmissions', uid]` query (04-06). Any RPC error is rethrown raw.
+ */
+export async function withdrawSubmission(submissionId: string): Promise<void> {
+  const { error } = await supabase.rpc('withdraw_submission', {
+    p_submission_id: submissionId,
+  });
+  if (error) throw error;
+}
diff --git a/app/src/lib/database.types.ts b/app/src/lib/database.types.ts
index 34f03d9..0062189 100644
--- a/app/src/lib/database.types.ts
+++ b/app/src/lib/database.types.ts
@@ -172,6 +172,7 @@ export type Database = {
       }
       locations: {
         Row: {
+          access_code_confirmed_at: string | null
           access_instructions: string | null
           access_sensitivity: string | null
           address: string | null
@@ -189,6 +190,8 @@ export type Database = {
           is_open_now: boolean | null
           last_verified_at: string | null
           name: string
+          pending_access_code: string | null
+          pending_code_proposed_by: string | null
           policy_tag: string | null
           respect_signal_score: number | null
           shadowban_status: boolean
@@ -198,6 +201,7 @@ export type Database = {
           verification_count: number | null
         }
         Insert: {
+          access_code_confirmed_at?: string | null
           access_instructions?: string | null
           access_sensitivity?: string | null
           address?: string | null
@@ -215,6 +219,8 @@ export type Database = {
           is_open_now?: boolean | null
           last_verified_at?: string | null
           name: string
+          pending_access_code?: string | null
+          pending_code_proposed_by?: string | null
           policy_tag?: string | null
           respect_signal_score?: number | null
           shadowban_status?: boolean
@@ -224,6 +230,7 @@ export type Database = {
           verification_count?: number | null
         }
         Update: {
+          access_code_confirmed_at?: string | null
           access_instructions?: string | null
           access_sensitivity?: string | null
           address?: string | null
@@ -241,6 +248,8 @@ export type Database = {
           is_open_now?: boolean | null
           last_verified_at?: string | null
           name?: string
+          pending_access_code?: string | null
+          pending_code_proposed_by?: string | null
           policy_tag?: string | null
           respect_signal_score?: number | null
           shadowban_status?: boolean
@@ -384,33 +393,60 @@ export type Database = {
       }
       submissions: {
         Row: {
+          access_code_confirmed_at: string | null
+          access_instructions: string | null
+          access_sensitivity: string | null
+          address: string | null
           confirmation_count: number | null
+          coordinates: unknown
           created_at: string | null
           expires_at: string
+          hours: Json | null
           id: string
           location_id: string | null
+          name: string | null
+          policy_tag: string | null
           status: string
           submitter_id: string | null
+          timing_tip: string | null
           updated_at: string | null
         }
         Insert: {
+          access_code_confirmed_at?: string | null
+          access_instructions?: string | null
+          access_sensitivity?: string | null
+          address?: string | null
           confirmation_count?: number | null
+          coordinates?: unknown
           created_at?: string | null
           expires_at?: string
+          hours?: Json | null
           id?: string
           location_id?: string | null
+          name?: string | null
+          policy_tag?: string | null
           status?: string
           submitter_id?: string | null
+          timing_tip?: string | null
           updated_at?: string | null
         }
         Update: {
+          access_code_confirmed_at?: string | null
+          access_instructions?: string | null
+          access_sensitivity?: string | null
+          address?: string | null
           confirmation_count?: number | null
+          coordinates?: unknown
           created_at?: string | null
           expires_at?: string
+          hours?: Json | null
           id?: string
           location_id?: string | null
+          name?: string | null
+          policy_tag?: string | null
           status?: string
           submitter_id?: string | null
+          timing_tip?: string | null
           updated_at?: string | null
         }
         Relationships: [
@@ -693,6 +729,10 @@ export type Database = {
     }
     Functions: {
       check_display_name_available: { Args: { name: string }; Returns: boolean }
+      confirm_access_code: {
+        Args: { p_location_id: string }
+        Returns: undefined
+      }
       count_locations_within:
         | {
             Args: { p_lat: number; p_lon: number; p_radius_m?: number }
@@ -703,6 +743,7 @@ export type Database = {
             Returns: number
           }
       delete_account: { Args: never; Returns: undefined }
+      get_access_code: { Args: { p_location_id: string }; Returns: string }
       get_location_detail: {
         Args: { location_id: string; user_lat?: number; user_lng?: number }
         Returns: {
@@ -736,6 +777,7 @@ export type Database = {
               user_lng: number
             }
             Returns: {
+              access_code_confirmed_at: string | null
               access_instructions: string | null
               access_sensitivity: string | null
               address: string | null
@@ -753,6 +795,8 @@ export type Database = {
               is_open_now: boolean | null
               last_verified_at: string | null
               name: string
+              pending_access_code: string | null
+              pending_code_proposed_by: string | null
               policy_tag: string | null
               respect_signal_score: number | null
               shadowban_status: boolean
@@ -782,6 +826,7 @@ export type Database = {
               user_lng: number
             }
             Returns: {
+              access_code_confirmed_at: string | null
               access_instructions: string | null
               access_sensitivity: string | null
               address: string | null
@@ -799,6 +844,8 @@ export type Database = {
               is_open_now: boolean | null
               last_verified_at: string | null
               name: string
+              pending_access_code: string | null
+              pending_code_proposed_by: string | null
               policy_tag: string | null
               respect_signal_score: number | null
               shadowban_status: boolean
@@ -814,6 +861,18 @@ export type Database = {
               isSetofReturn: true
             }
           }
+      get_my_pending_submissions: {
+        Args: never
+        Returns: {
+          confirmation_count: number
+          expires_at: string
+          id: string
+          lat: number
+          lng: number
+          name: string
+          policy_tag: string
+        }[]
+      }
       get_profile_stats: { Args: never; Returns: Json }
       search_locations_bbox: {
         Args: {
@@ -867,10 +926,35 @@ export type Database = {
         }[]
       }
       set_gps_consent: { Args: never; Returns: undefined }
+      submit_location: {
+        Args: {
+          p_access_code?: string
+          p_access_sensitivity?: string
+          p_accuracy_m: number
+          p_address?: string
+          p_captured_at: string
+          p_hours?: Json
+          p_lat: number
+          p_lng: number
+          p_mocked: boolean
+          p_name: string
+          p_policy_tag: string
+          p_timing_tip?: string
+        }
+        Returns: string
+      }
+      update_access_code: {
+        Args: { p_code: string; p_location_id: string }
+        Returns: undefined
+      }
       update_profile: {
         Args: { new_display_name?: string; new_family_mode?: boolean }
         Returns: undefined
       }
+      withdraw_submission: {
+        Args: { p_submission_id: string }
+        Returns: undefined
+      }
     }
     Enums: {
       [_ in never]: never
diff --git a/supabase/migrations/20260707020000_phase4_submission_staging.sql b/supabase/migrations/20260707020000_phase4_submission_staging.sql
new file mode 100644
index 0000000..a016ea0
--- /dev/null
+++ b/supabase/migrations/20260707020000_phase4_submission_staging.sql
@@ -0,0 +1,186 @@
+-- Phase 4 (04-01 Task 2) — submission staging columns + submission-lifecycle RPCs
+-- (2026-07-07)
+--
+-- Resolves the phase's central storage question as OPTION A (RESEARCH §Pattern 1):
+-- pending bathroom data lives ONLY on the `submissions` row — no `locations` row is
+-- created until Phase 5's publish gate. Phase 3's five shipped readers are untouched
+-- and cannot leak pending data by construction.
+--
+-- Section 1 — typed staging columns on `submissions` (all nullable; zero prod rows).
+-- Section 2 — submit_location   (write; server-side GPS validation + pending insert).
+-- Section 3 — get_my_pending_submissions (read; auth.uid()-scoped pending pins).
+-- Section 4 — withdraw_submission (write; owner-only DELETE of a pending row).
+--
+-- Conventions mirrored verbatim:
+--   * auth-gate header + revoke/grant triple: 20260627000004_profile_rpcs.sql
+--   * app_config read + coalesce fallback:    20260704010002_phase3_search_rpcs.sql
+--   * PostGIS coordinate handling (lng first): st_setsrid(st_makepoint(lng,lat),4326)::geography
+-- Write RPCs are NOT `stable`; the read RPC keeps `stable`.
+-- All three are authed-only: revoke from public AND anon, grant to authenticated
+-- (get_my_pending_submissions is NOT granted to anon, unlike the Phase 3 search RPCs).
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- Section 1 — staging columns on public.submissions (mirror the eventual
+--             `locations` types for a clean Phase 5 publish copy). All nullable.
+-- Per OQ-4: the submission-time timing tip is staged on `timing_tip` ONLY this
+-- phase — the dedicated `timing_tips` table is deferred to Phase 5's publish gate.
+-- ═══════════════════════════════════════════════════════════════════════════════
+alter table public.submissions
+  add column if not exists name                     text,
+  add column if not exists coordinates              extensions.geography(Point, 4326),
+  add column if not exists address                  text,
+  add column if not exists policy_tag               text,
+  add column if not exists access_sensitivity       text,
+  add column if not exists hours                    jsonb,
+  add column if not exists access_instructions      text,
+  add column if not exists access_code_confirmed_at timestamptz,
+  add column if not exists timing_tip               text;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- Section 2 — submit_location (write, server-authoritative GPS validation)
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- The client passes the RAW GPS sample (lat/lng/accuracy/mocked/captured_at). The
+-- RPC re-validates against app_config thresholds and raises a SINGLE generic
+-- 'gps rejected' error on failure (SC7 — the specific failing check is never echoed).
+-- On success it stages a pending submissions row with confirmation_count=1
+-- (creator-initial event, OQ-2) and coordinates as geography. It NEVER touches
+-- `locations`. `expires_at` keeps its existing 14-day column default.
+create or replace function public.submit_location(
+  p_name                 text,
+  p_lat                  numeric,
+  p_lng                  numeric,
+  p_accuracy_m           numeric,
+  p_mocked               boolean,
+  p_captured_at          timestamptz,
+  p_policy_tag           text,
+  p_address              text        default null,
+  p_access_sensitivity   text        default null,   -- 'sensitive' or null (D-09)
+  p_hours                jsonb       default null,
+  p_access_code          text        default null,   -- only when policy_tag='code_required' (D-17)
+  p_timing_tip           text        default null
+)
+returns uuid
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  v_max_accuracy numeric;
+  v_max_age_s    numeric;
+  v_id           uuid;
+begin
+  if auth.uid() is null then
+    raise exception 'not authenticated';                 -- D-18
+  end if;
+
+  -- Config-driven thresholds (admin-tunable; never hardcoded in client).
+  select value::numeric into v_max_accuracy from public.app_config where key = 'max_accuracy_m';
+  select value::numeric into v_max_age_s    from public.app_config where key = 'max_gps_age_s';
+  v_max_accuracy := coalesce(v_max_accuracy, 50);
+  v_max_age_s    := coalesce(v_max_age_s, 60);
+
+  -- SC2/SC7 — server-side rejection. Single generic error; no PII/coords/reason echoed.
+  if p_mocked is true then
+    raise exception 'gps rejected';                      -- mock provider (Pitfall 1 trust boundary)
+  end if;
+  if p_accuracy_m is null or p_accuracy_m > v_max_accuracy then
+    raise exception 'gps rejected';                      -- accuracy
+  end if;
+  if p_captured_at is null or (now() - p_captured_at) > make_interval(secs => v_max_age_s) then
+    raise exception 'gps rejected';                      -- freshness
+  end if;
+
+  insert into public.submissions
+    (submitter_id, status, confirmation_count,
+     name, coordinates, address, policy_tag, access_sensitivity, hours,
+     access_instructions, access_code_confirmed_at, timing_tip)
+  values
+    (auth.uid(), 'pending', 1,                           -- confirmation_count=1 = creator-initial (SC3)
+     p_name,
+     extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,   -- lng FIRST
+     p_address, p_policy_tag, p_access_sensitivity, p_hours,
+     p_access_code, now(), p_timing_tip)                 -- D-22: code_confirmed_at defaults to created_at
+  returning id into v_id;
+
+  return v_id;
+end;
+$$;
+
+revoke execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text) from public;
+revoke execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text) from anon;
+grant  execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text) to authenticated;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- Section 3 — get_my_pending_submissions (read, auth.uid()-scoped)
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- The SOLE "visible only to submitter" enforcement point (RESEARCH §Pattern 4):
+-- scopes to the caller's own pending rows. Phase 3's five readers are untouched.
+-- Anonymous callers get zero rows (return early). Authed-only grant.
+create or replace function public.get_my_pending_submissions()
+returns table (
+  id                 uuid,
+  name               text,
+  lat                double precision,
+  lng                double precision,
+  policy_tag         text,
+  confirmation_count integer,
+  expires_at         timestamptz
+)
+language plpgsql
+security definer
+stable
+set search_path = public
+as $$
+begin
+  if auth.uid() is null then
+    return;                                              -- anon → no pending pins
+  end if;
+
+  return query
+  select s.id,
+         s.name,
+         extensions.st_y(s.coordinates::extensions.geometry)::double precision as lat,
+         extensions.st_x(s.coordinates::extensions.geometry)::double precision as lng,
+         s.policy_tag,
+         s.confirmation_count,
+         s.expires_at
+  from public.submissions s
+  where s.submitter_id = auth.uid()
+    and s.status = 'pending';
+end;
+$$;
+
+revoke execute on function public.get_my_pending_submissions() from public;
+revoke execute on function public.get_my_pending_submissions() from anon;
+grant  execute on function public.get_my_pending_submissions() to authenticated;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- Section 4 — withdraw_submission (write, owner-only)
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- D-29 "as if never submitted" → DELETE the pending row (never a withdrawn status
+-- value, which the submissions.status CHECK forbids). Guarded by submitter_id = auth.uid()
+-- AND status='pending' so a caller can only remove their OWN pending submission
+-- (Pitfall 6). Confirm dialog is client-side (D-30).
+create or replace function public.withdraw_submission(p_submission_id uuid)
+returns void
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  uid uuid := auth.uid();
+begin
+  if uid is null then
+    raise exception 'not authenticated';
+  end if;
+
+  delete from public.submissions
+  where id = p_submission_id
+    and submitter_id = uid
+    and status = 'pending';
+end;
+$$;
+
+revoke execute on function public.withdraw_submission(uuid) from public;
+revoke execute on function public.withdraw_submission(uuid) from anon;
+grant  execute on function public.withdraw_submission(uuid) to authenticated;
diff --git a/supabase/migrations/20260707030000_phase4_access_code_update.sql b/supabase/migrations/20260707030000_phase4_access_code_update.sql
new file mode 100644
index 0000000..537aa37
--- /dev/null
+++ b/supabase/migrations/20260707030000_phase4_access_code_update.sql
@@ -0,0 +1,175 @@
+-- Phase 4 (04-02 Task 2) — access-code UPDATE path (D-21/D-22/D-24/D-25)
+-- (2026-07-07; applied after 04-01's 20260707020000_phase4_submission_staging.sql)
+--
+-- Implements the "submit/update the bathroom access code" requirement as an
+-- abuse-resistant, two-party STAGE-THEN-CONFIRM gate on public.locations — the
+-- same shape that gates location publishing, so a single malicious update cannot
+-- silently break a working door code for everyone (RESEARCH §Pattern 5, OQ-3).
+--
+-- Section 1 — code-freshness + pending-code columns on `locations` (all nullable).
+-- Section 2 — update_access_code   (write; stages a proposed code, NO overwrite).
+-- Section 3 — confirm_access_code  (write; a DIFFERENT authed user promotes it).
+-- Section 4 — get_access_code      (read; authed-only current-code read, SC6).
+--
+-- Conventions mirrored verbatim:
+--   * auth-gate header + revoke/grant triple: 20260627000004_profile_rpcs.sql
+--   * stable read-RPC header + moderation filter: 20260704010002_phase3_search_rpcs.sql
+-- Write RPCs are NOT `stable`; the read RPC (get_access_code) keeps `stable`.
+-- All three are authed-only: revoke from public AND anon, grant to authenticated.
+-- The Phase 3 public detail read RPC is DELIBERATELY untouched (Pitfall 4):
+-- this migration adds the ONLY code-returning read path.
+--
+-- NOTE: this migration references no PostGIS types/functions, so no
+-- extensions.* schema-qualification is required here (unlike 04-01's migration).
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- Section 1 — code-freshness + staged-code columns on public.locations.
+-- All nullable, no backfill. access_code_confirmed_at (D-22 freshness) is set at a
+-- confirmed update; the two pending_* columns hold a proposed code awaiting a
+-- second-party confirmation (D-24) and are NULL when nothing is pending.
+-- ═══════════════════════════════════════════════════════════════════════════════
+alter table public.locations
+  add column if not exists access_code_confirmed_at timestamptz,
+  add column if not exists pending_access_code       text,
+  add column if not exists pending_code_proposed_by  uuid;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- Section 2 — update_access_code (write, stages only — D-24 no instant overwrite)
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- Stages the proposed code in pending_access_code + records the proposer. It NEVER
+-- touches access_instructions or access_code_confirmed_at — the live code only
+-- changes once a DIFFERENT authed user calls confirm_access_code. The target must
+-- be a real PUBLISHED location; otherwise a single generic error is raised.
+create or replace function public.update_access_code(
+  p_location_id uuid,
+  p_code        text
+)
+returns void
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  v_uid uuid := auth.uid();
+begin
+  if v_uid is null then
+    raise exception 'not authenticated';
+  end if;
+
+  if not exists (
+    select 1 from public.locations
+     where id = p_location_id
+       and deleted_at is null
+       and shadowban_status is not true
+       and suppressed_at is null
+  ) then
+    raise exception 'location not available';            -- generic; no detail echoed
+  end if;
+
+  -- Stage only. access_instructions + access_code_confirmed_at are left untouched.
+  update public.locations
+     set pending_access_code      = p_code,
+         pending_code_proposed_by = v_uid
+   where id = p_location_id;
+end;
+$$;
+
+revoke execute on function public.update_access_code(uuid,text) from public;
+revoke execute on function public.update_access_code(uuid,text) from anon;
+grant  execute on function public.update_access_code(uuid,text) to authenticated;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- Section 3 — confirm_access_code (write, second-party promotion — D-24/D-25)
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- A staged code is promoted to the live access_instructions ONLY when the confirmer
+-- is a DIFFERENT authenticated user than the proposer. On success it overwrites the
+-- old code with no history kept (D-25) and resets access_code_confirmed_at = now()
+-- (D-22 freshness), then clears both pending columns.
+create or replace function public.confirm_access_code(
+  p_location_id uuid
+)
+returns void
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  v_uid         uuid := auth.uid();
+  v_pending     text;
+  v_proposed_by uuid;
+begin
+  if v_uid is null then
+    raise exception 'not authenticated';
+  end if;
+
+  select pending_access_code, pending_code_proposed_by
+    into v_pending, v_proposed_by
+    from public.locations
+   where id = p_location_id
+     and deleted_at is null
+     and shadowban_status is not true
+     and suppressed_at is null;
+
+  if v_pending is null or v_proposed_by is null then
+    raise exception 'no pending code to confirm';        -- generic; nothing staged
+  end if;
+
+  -- D-24: the confirmer MUST differ from the proposer — no self-confirmation.
+  if v_proposed_by = v_uid then
+    raise exception 'cannot confirm own code';
+  end if;
+
+  -- D-25 overwrite (no history) + D-22 freshness reset + clear the staged code.
+  -- The `pending_code_proposed_by <> auth.uid()` predicate is defense-in-depth so
+  -- the promotion can never occur under a self-confirming caller.
+  update public.locations
+     set access_instructions      = v_pending,
+         access_code_confirmed_at = now(),
+         pending_access_code      = null,
+         pending_code_proposed_by = null
+   where id = p_location_id
+     and pending_code_proposed_by <> auth.uid();
+end;
+$$;
+
+revoke execute on function public.confirm_access_code(uuid) from public;
+revoke execute on function public.confirm_access_code(uuid) from anon;
+grant  execute on function public.confirm_access_code(uuid) to authenticated;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- Section 4 — get_access_code (read, authed-only — SC6)
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- The ONLY read path that returns a door code, for the "Update door code" UI.
+-- Authed-only: anon callers are rejected. The Phase 3 public detail RPC is NOT
+-- modified, so the public search/detail contract never widens to the code (Pitfall 4).
+create or replace function public.get_access_code(
+  p_location_id uuid
+)
+returns text
+language plpgsql
+security definer
+stable
+set search_path = public
+as $$
+declare
+  v_code text;
+begin
+  if auth.uid() is null then
+    raise exception 'not authenticated';
+  end if;
+
+  select access_instructions
+    into v_code
+    from public.locations
+   where id = p_location_id
+     and deleted_at is null
+     and shadowban_status is not true
+     and suppressed_at is null;
+
+  return v_code;
+end;
+$$;
+
+revoke execute on function public.get_access_code(uuid) from public;
+revoke execute on function public.get_access_code(uuid) from anon;
+grant  execute on function public.get_access_code(uuid) to authenticated;
diff --git a/supabase/migrations/20260708000000_phase4_code_review_fixes.sql b/supabase/migrations/20260708000000_phase4_code_review_fixes.sql
new file mode 100644
index 0000000..0e6fc58
--- /dev/null
+++ b/supabase/migrations/20260708000000_phase4_code_review_fixes.sql
@@ -0,0 +1,289 @@
+-- Phase 4 code-review fixes (04-REVIEW.md, 2026-07-08)
+--
+-- Fixes CR-02 (critical) and WR-01/WR-02/WR-03/WR-04/WR-05/IN-01 found during the
+-- phase's end-of-execution code review. Each function is `create or replace` — no
+-- new tables, no data migration. Applied after 20260707020000 and 20260707030000.
+--
+-- CR-02: update_access_code unconditionally overwrote ANY existing pending proposal
+--        from a different user, defeating the two-party stage-then-confirm gate's
+--        own stated abuse-resistance goal (an attacker's second account could stage
+--        a malicious code over a legitimate pending one, then confirm from account 2).
+-- WR-01: get_access_code returned a bare NULL typed as non-nullable `text` when no
+--        code was set or the location wasn't visible — now raises the same generic
+--        error the write RPCs use.
+-- WR-02: submit_location's freshness check didn't reject a future-dated p_captured_at
+--        (negative age always passes the staleness bound).
+-- WR-03: confirm_access_code's promoting UPDATE didn't re-apply the visibility
+--        filters (deleted_at/shadowban_status/suppressed_at) used by its initial SELECT.
+-- WR-04: withdraw_submission silently no-op'd on a non-matching id instead of
+--        signaling failure, indistinguishable from a real success to the caller.
+-- WR-05 (partial): pending_access_code now has a length CHECK matching the client's
+--        100-char bound (submitSchema.accessCode) for defense in depth.
+-- IN-01: submissions.policy_tag / access_sensitivity now have CHECK constraints
+--        matching the 4-value enum / 'sensitive'-or-null contract enforced only
+--        client-side before this fix.
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- CR-02 fix — update_access_code rejects staging over a DIFFERENT user's pending
+-- proposal. The proposer may re-stage their own proposal (e.g. fixing a typo)
+-- freely; only a different user's in-flight proposal is protected.
+-- ═══════════════════════════════════════════════════════════════════════════════
+create or replace function public.update_access_code(
+  p_location_id uuid,
+  p_code        text
+)
+returns void
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  v_uid uuid := auth.uid();
+  v_existing_proposer uuid;
+begin
+  if v_uid is null then
+    raise exception 'not authenticated';
+  end if;
+
+  if not exists (
+    select 1 from public.locations
+     where id = p_location_id
+       and deleted_at is null
+       and shadowban_status is not true
+       and suppressed_at is null
+  ) then
+    raise exception 'location not available';            -- generic; no detail echoed
+  end if;
+
+  select pending_code_proposed_by into v_existing_proposer
+    from public.locations
+   where id = p_location_id;
+
+  -- CR-02: refuse to clobber a DIFFERENT user's in-flight proposal. The same user
+  -- re-staging (e.g. correcting a typo before anyone confirms) is still allowed.
+  if v_existing_proposer is not null and v_existing_proposer <> v_uid then
+    raise exception 'code update already pending';
+  end if;
+
+  -- Stage only. access_instructions + access_code_confirmed_at are left untouched.
+  update public.locations
+     set pending_access_code      = p_code,
+         pending_code_proposed_by = v_uid
+   where id = p_location_id;
+end;
+$$;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- WR-03 fix — confirm_access_code's promoting UPDATE re-applies the same
+-- visibility filters used by its initial SELECT, closing the TOCTOU-style gap
+-- where a location could be soft-deleted/shadowbanned/suppressed between the two.
+-- ═══════════════════════════════════════════════════════════════════════════════
+create or replace function public.confirm_access_code(
+  p_location_id uuid
+)
+returns void
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  v_uid         uuid := auth.uid();
+  v_pending     text;
+  v_proposed_by uuid;
+begin
+  if v_uid is null then
+    raise exception 'not authenticated';
+  end if;
+
+  select pending_access_code, pending_code_proposed_by
+    into v_pending, v_proposed_by
+    from public.locations
+   where id = p_location_id
+     and deleted_at is null
+     and shadowban_status is not true
+     and suppressed_at is null;
+
+  if v_pending is null or v_proposed_by is null then
+    raise exception 'no pending code to confirm';        -- generic; nothing staged
+  end if;
+
+  -- D-24: the confirmer MUST differ from the proposer — no self-confirmation.
+  if v_proposed_by = v_uid then
+    raise exception 'cannot confirm own code';
+  end if;
+
+  -- D-25 overwrite (no history) + D-22 freshness reset + clear the staged code.
+  -- WR-03: re-apply the same visibility predicates as the initial SELECT so a
+  -- location that became invisible between the read and this write is not promoted.
+  update public.locations
+     set access_instructions      = v_pending,
+         access_code_confirmed_at = now(),
+         pending_access_code      = null,
+         pending_code_proposed_by = null
+   where id = p_location_id
+     and pending_code_proposed_by <> auth.uid()
+     and deleted_at is null
+     and shadowban_status is not true
+     and suppressed_at is null;
+end;
+$$;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- WR-01 fix — get_access_code raises the same generic error as the write RPCs
+-- instead of silently returning NULL typed as non-nullable `text`.
+-- ═══════════════════════════════════════════════════════════════════════════════
+create or replace function public.get_access_code(
+  p_location_id uuid
+)
+returns text
+language plpgsql
+security definer
+stable
+set search_path = public
+as $$
+declare
+  v_code text;
+begin
+  if auth.uid() is null then
+    raise exception 'not authenticated';
+  end if;
+
+  select access_instructions
+    into v_code
+    from public.locations
+   where id = p_location_id
+     and deleted_at is null
+     and shadowban_status is not true
+     and suppressed_at is null;
+
+  if v_code is null then
+    raise exception 'location not available';            -- generic; matches update/confirm
+  end if;
+
+  return v_code;
+end;
+$$;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- WR-04 fix — withdraw_submission raises when the caller's id/ownership/status
+-- guard matches zero rows, instead of a silent, indistinguishable-from-success no-op.
+-- ═══════════════════════════════════════════════════════════════════════════════
+create or replace function public.withdraw_submission(p_submission_id uuid)
+returns void
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  uid uuid := auth.uid();
+  v_deleted_id uuid;
+begin
+  if uid is null then
+    raise exception 'not authenticated';
+  end if;
+
+  delete from public.submissions
+  where id = p_submission_id
+    and submitter_id = uid
+    and status = 'pending'
+  returning id into v_deleted_id;
+
+  if v_deleted_id is null then
+    raise exception 'submission not available';
+  end if;
+end;
+$$;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- WR-02 fix — submit_location rejects a p_captured_at set in the future, not just
+-- a stale one. A small allowance (5s) absorbs clock skew between device and server.
+-- ═══════════════════════════════════════════════════════════════════════════════
+create or replace function public.submit_location(
+  p_name                 text,
+  p_lat                  numeric,
+  p_lng                  numeric,
+  p_accuracy_m           numeric,
+  p_mocked               boolean,
+  p_captured_at          timestamptz,
+  p_policy_tag           text,
+  p_address              text        default null,
+  p_access_sensitivity   text        default null,   -- 'sensitive' or null (D-09)
+  p_hours                jsonb       default null,
+  p_access_code          text        default null,   -- only when policy_tag='code_required' (D-17)
+  p_timing_tip           text        default null
+)
+returns uuid
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  v_max_accuracy numeric;
+  v_max_age_s    numeric;
+  v_id           uuid;
+begin
+  if auth.uid() is null then
+    raise exception 'not authenticated';                 -- D-18
+  end if;
+
+  -- Config-driven thresholds (admin-tunable; never hardcoded in client).
+  select value::numeric into v_max_accuracy from public.app_config where key = 'max_accuracy_m';
+  select value::numeric into v_max_age_s    from public.app_config where key = 'max_gps_age_s';
+  v_max_accuracy := coalesce(v_max_accuracy, 50);
+  v_max_age_s    := coalesce(v_max_age_s, 60);
+
+  -- SC2/SC7 — server-side rejection. Single generic error; no PII/coords/reason echoed.
+  if p_mocked is true then
+    raise exception 'gps rejected';                      -- mock provider (Pitfall 1 trust boundary)
+  end if;
+  if p_accuracy_m is null or p_accuracy_m > v_max_accuracy then
+    raise exception 'gps rejected';                      -- accuracy
+  end if;
+  if p_captured_at is null
+     or (now() - p_captured_at) > make_interval(secs => v_max_age_s)
+     or p_captured_at > now() + interval '5 seconds' then  -- WR-02: reject future-dated fixes too
+    raise exception 'gps rejected';                      -- freshness
+  end if;
+
+  insert into public.submissions
+    (submitter_id, status, confirmation_count,
+     name, coordinates, address, policy_tag, access_sensitivity, hours,
+     access_instructions, access_code_confirmed_at, timing_tip)
+  values
+    (auth.uid(), 'pending', 1,                           -- confirmation_count=1 = creator-initial (SC3)
+     p_name,
+     extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,   -- lng FIRST
+     p_address, p_policy_tag, p_access_sensitivity, p_hours,
+     p_access_code, now(), p_timing_tip)                 -- D-22: code_confirmed_at defaults to created_at
+  returning id into v_id;
+
+  return v_id;
+end;
+$$;
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- WR-05 (partial) — bound pending_access_code to the same 100-char limit
+-- submitSchema.accessCode already enforces client-side, for defense in depth.
+-- ═══════════════════════════════════════════════════════════════════════════════
+alter table public.locations
+  drop constraint if exists locations_pending_access_code_length_chk;
+alter table public.locations
+  add constraint locations_pending_access_code_length_chk
+  check (char_length(pending_access_code) <= 100);
+
+-- ═══════════════════════════════════════════════════════════════════════════════
+-- IN-01 — server-side enum/value validation on submissions.policy_tag and
+-- access_sensitivity, matching the client's zod enum and the 'sensitive'-or-null
+-- contract (previously enforced client-side only).
+-- ═══════════════════════════════════════════════════════════════════════════════
+alter table public.submissions
+  drop constraint if exists submissions_policy_tag_chk;
+alter table public.submissions
+  add constraint submissions_policy_tag_chk
+  check (policy_tag is null or policy_tag in ('chill_spot', 'purchase_required', 'code_required', 'public_facility'));
+
+alter table public.submissions
+  drop constraint if exists submissions_access_sensitivity_chk;
+alter table public.submissions
+  add constraint submissions_access_sensitivity_chk
+  check (access_sensitivity is null or access_sensitivity = 'sensitive');
diff --git a/supabase/migrations/20260708010000_phase4_drop_direct_submission_insert.sql b/supabase/migrations/20260708010000_phase4_drop_direct_submission_insert.sql
new file mode 100644
index 0000000..4ebec50
--- /dev/null
+++ b/supabase/migrations/20260708010000_phase4_drop_direct_submission_insert.sql
@@ -0,0 +1,27 @@
+-- Phase 4 security fix — close the direct-INSERT bypass of submit_location's
+-- server-side GPS validation (discovered while preparing cross-AI review packets,
+-- 2026-07-08, not part of the earlier 04-REVIEW.md findings).
+--
+-- The pre-existing `submissions_insert_auth` RLS policy
+--   (INSERT, WITH CHECK (auth.uid() = submitter_id))
+-- predates Phase 4 and let any signed-in user POST directly to
+-- /rest/v1/submissions, bypassing `submit_location` entirely: no accuracy check,
+-- no freshness check, no mock-detection check, and an attacker-controlled
+-- confirmation_count/coordinates/access_sensitivity. This directly undermined
+-- ROADMAP Phase 4 SC2 ("Mocked locations are rejected at the RPC layer") and
+-- SC7 ("GPS accuracy/staleness rejected server-side") — both trivially bypassed
+-- by not calling the RPC at all.
+--
+-- Safe to drop: `submissions` and `submit_location` are both owned by `postgres`
+-- (verified live); `relforcerowsecurity=false` means the table owner bypasses
+-- RLS for its own operations, so `submit_location`'s internal INSERT does not
+-- depend on this policy and is unaffected by dropping it. No client code
+-- reads/writes `submissions` directly (`grep -rn "from('submissions')" app/src`
+-- returns zero matches) — every access goes through the SECURITY DEFINER RPCs
+-- (submit_location, get_my_pending_submissions, withdraw_submission), all of
+-- which run as the table owner and are unaffected.
+--
+-- `submissions_select_published` (SELECT) and `submissions_service_all` (ALL,
+-- service_role) are left untouched — this migration removes ONLY the direct
+-- client INSERT bypass.
+drop policy if exists submissions_insert_auth on public.submissions;
diff --git a/supabase/tests/phase4_access_code.test.sql b/supabase/tests/phase4_access_code.test.sql
new file mode 100644
index 0000000..cc81e4e
--- /dev/null
+++ b/supabase/tests/phase4_access_code.test.sql
@@ -0,0 +1,166 @@
+-- Phase 4 (04-02 Task 1) — pgTAP correctness suite for the access-code UPDATE path
+-- Run locally with:  supabase test db   (requires Docker — tracked override this env)
+--
+-- Covers the three access-code SECURITY DEFINER RPCs added in
+-- 20260707030000_phase4_access_code_update.sql:
+--   update_access_code   — stages a proposed door code (D-24: no instant overwrite)
+--   confirm_access_code  — a SECOND, DIFFERENT authed user promotes the staged code
+--   get_access_code      — authed-only read of the current code (SC6; the ONLY code
+--                          read path — get_location_detail stays untouched, Pitfall 4)
+--
+-- Asserts (RESEARCH §Pattern 5 + OQ-3 → the D-24 stage-then-confirm mechanism):
+--   (a) update_access_code by the PROPOSER stages pending_access_code +
+--       pending_code_proposed_by but leaves access_instructions = 'OLD-CODE'
+--   (b) confirm_access_code by the SAME user (proposer) does NOT promote — it raises
+--       a generic error and access_instructions is still 'OLD-CODE' (D-24: confirmer
+--       must differ from proposer)
+--   (c) confirm_access_code by a DIFFERENT authed user copies pending_access_code into
+--       access_instructions, clears both pending columns, and sets a fresh
+--       access_code_confirmed_at (D-25 overwrite, code freshness reset)
+--   (d) get_access_code returns the current code for an authenticated caller
+--   (e/f) get_access_code / update_access_code / confirm_access_code with empty jwt
+--       claims each raise 'not authenticated' (SC6 — reads + writes are authed-only)
+--
+-- Two auth.users fixtures (proposer A / confirmer B) fire handle_new_user → provision
+-- public.users so the different-user confirmation gate is directly testable.
+
+begin;
+create extension if not exists pgtap with schema extensions;
+select plan(16);
+
+-- ─── Fixtures: two authenticated test users (proposer A + confirmer B) ────────
+insert into auth.users (instance_id, id, aud, role, email)
+values ('00000000-0000-0000-0000-000000000000',
+        'a0000000-0000-0000-0000-000000000001',
+        'authenticated', 'authenticated', 'phase4-code-proposer@example.com'),
+       ('00000000-0000-0000-0000-000000000000',
+        'a0000000-0000-0000-0000-000000000002',
+        'authenticated', 'authenticated', 'phase4-code-confirmer@example.com');
+
+-- ─── Fixture: one PUBLISHED location with a known live code 'OLD-CODE' ─────────
+-- Published = deleted_at null, shadowban_status default false, suppressed_at null.
+insert into public.locations (id, name, coordinates, policy_tag, access_instructions)
+values ('c0000000-0000-0000-0000-000000000001',
+        'Code Locked Cafe',
+        extensions.st_setsrid(extensions.st_makepoint(-123.09, 44.05), 4326)::extensions.geography,
+        'code_required',
+        'OLD-CODE');
+
+-- ═══ Section 1. update_access_code STAGES without overwriting (proposer A) ════
+select set_config('request.jwt.claims',
+  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
+
+select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, 'NEW-CODE');
+
+select is(
+  (select access_instructions from public.locations
+     where id = 'c0000000-0000-0000-0000-000000000001'),
+  'OLD-CODE',
+  'update_access_code leaves the live access_instructions unchanged (D-24 — stage, not overwrite)');
+
+select is(
+  (select pending_access_code from public.locations
+     where id = 'c0000000-0000-0000-0000-000000000001'),
+  'NEW-CODE',
+  'update_access_code stages the proposed code in pending_access_code');
+
+select is(
+  (select pending_code_proposed_by from public.locations
+     where id = 'c0000000-0000-0000-0000-000000000001'),
+  'a0000000-0000-0000-0000-000000000001'::uuid,
+  'update_access_code records the proposer in pending_code_proposed_by');
+
+-- ═══ Section 1b. A DIFFERENT user cannot clobber A's pending proposal (CR-02) ══
+select set_config('request.jwt.claims',
+  json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
+
+select throws_ok(
+  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, 'ATTACKER-CODE') $$,
+  'P0001', 'code update already pending',
+  'update_access_code rejects a different user overwriting an already-pending proposal (CR-02)');
+
+select is(
+  (select pending_access_code from public.locations
+     where id = 'c0000000-0000-0000-0000-000000000001'),
+  'NEW-CODE',
+  'the rejected overwrite attempt leaves A''s original pending_access_code unchanged');
+
+-- The ORIGINAL proposer may still re-stage their own proposal (e.g. fixing a typo).
+select set_config('request.jwt.claims',
+  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
+
+select lives_ok(
+  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, 'NEW-CODE') $$,
+  'the original proposer may re-stage their own pending proposal without the CR-02 guard firing');
+
+-- ═══ Section 2. Same-user confirm does NOT promote (D-24) ═════════════════════
+-- Still impersonating proposer A — confirming your own proposal must be refused.
+select throws_ok(
+  $$ select public.confirm_access_code('c0000000-0000-0000-0000-000000000001'::uuid) $$,
+  'P0001',
+  'cannot confirm own code',
+  'confirm_access_code refuses when the confirmer is the proposer (D-24 second-party gate)');
+
+select is(
+  (select access_instructions from public.locations
+     where id = 'c0000000-0000-0000-0000-000000000001'),
+  'OLD-CODE',
+  'a rejected same-user confirm leaves the live code as OLD-CODE (no promotion)');
+
+-- ═══ Section 3. Different-user confirm PROMOTES the staged code ═══════════════
+select set_config('request.jwt.claims',
+  json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
+
+select public.confirm_access_code('c0000000-0000-0000-0000-000000000001'::uuid);
+
+select is(
+  (select access_instructions from public.locations
+     where id = 'c0000000-0000-0000-0000-000000000001'),
+  'NEW-CODE',
+  'confirm_access_code by a DIFFERENT authed user promotes pending → access_instructions (D-25)');
+
+select is(
+  (select pending_access_code from public.locations
+     where id = 'c0000000-0000-0000-0000-000000000001'),
+  null::text,
+  'confirm_access_code clears pending_access_code after promotion');
+
+select is(
+  (select pending_code_proposed_by from public.locations
+     where id = 'c0000000-0000-0000-0000-000000000001'),
+  null::uuid,
+  'confirm_access_code clears pending_code_proposed_by after promotion');
+
+select ok(
+  (select access_code_confirmed_at is not null
+          and access_code_confirmed_at > now() - interval '1 minute'
+     from public.locations
+     where id = 'c0000000-0000-0000-0000-000000000001'),
+  'confirm_access_code sets a fresh access_code_confirmed_at (D-22 code freshness reset)');
+
+-- ═══ Section 4. get_access_code returns the current code to an authed caller ══
+select is(
+  public.get_access_code('c0000000-0000-0000-0000-000000000001'::uuid),
+  'NEW-CODE',
+  'get_access_code returns the current live code to an authenticated caller');
+
+-- ═══ Section 5. All three RPCs reject anonymous callers (SC6) ═════════════════
+select set_config('request.jwt.claims', '', true);
+
+select throws_ok(
+  $$ select public.get_access_code('c0000000-0000-0000-0000-000000000001'::uuid) $$,
+  'P0001', 'not authenticated',
+  'get_access_code rejects an anonymous caller (code never leaks to anon — SC6)');
+
+select throws_ok(
+  $$ select public.update_access_code('c0000000-0000-0000-0000-000000000001'::uuid, 'ANON-CODE') $$,
+  'P0001', 'not authenticated',
+  'update_access_code rejects an anonymous caller');
+
+select throws_ok(
+  $$ select public.confirm_access_code('c0000000-0000-0000-0000-000000000001'::uuid) $$,
+  'P0001', 'not authenticated',
+  'confirm_access_code rejects an anonymous caller');
+
+select * from finish();
+rollback;
diff --git a/supabase/tests/phase4_submit.test.sql b/supabase/tests/phase4_submit.test.sql
new file mode 100644
index 0000000..ab01a9d
--- /dev/null
+++ b/supabase/tests/phase4_submit.test.sql
@@ -0,0 +1,194 @@
+-- Phase 4 (04-01 Task 1) — pgTAP correctness suite for the submission write path
+-- Run locally with:  supabase test db   (requires Docker — tracked override this env)
+--
+-- Covers the three submission-lifecycle SECURITY DEFINER RPCs added in
+-- 20260707020000_phase4_submission_staging.sql:
+--   submit_location             — server-side GPS validation + pending staging insert
+--   get_my_pending_submissions  — auth.uid()-scoped pending pins
+--   withdraw_submission         — owner-only DELETE of a pending row
+--
+-- Asserts (RESEARCH §Validation Architecture → Test Map):
+--   (a) submit_location stages exactly one submissions row: status='pending',
+--       confirmation_count=1, coordinates NOT NULL, and NO locations row is linked
+--   (b/c/d) mocked=true / accuracy>50 / age>60 each raise the SAME generic
+--       'gps rejected' error (SC7 — reason never echoed)
+--   (e) access_sensitivity stages the literal 'sensitive' when passed, NULL by default
+--   (f) anonymous submit_location / withdraw_submission raise 'not authenticated';
+--       anonymous get_my_pending_submissions returns zero rows
+--   (g) get_my_pending_submissions is caller-scoped: user A sees their own pending
+--       rows, user B sees none of user A's
+--   (i) withdraw_submission deletes ONLY the caller's own pending row (non-owner no-op)
+--   (j) withdraw never introduces a status='withdrawn' value (DELETE, not status flip)
+--
+-- Two auth.users fixtures (A/B) fire handle_new_user → provision public.users.
+-- The suite never writes a locations row — pending data must be provable in
+-- `submissions` alone (Option A, RESEARCH §Pattern 1).
+
+begin;
+create extension if not exists pgtap with schema extensions;
+select plan(21);
+
+-- ─── Fixtures: two authenticated test users ──────────────────────────────────
+insert into auth.users (instance_id, id, aud, role, email)
+values ('00000000-0000-0000-0000-000000000000',
+        'a0000000-0000-0000-0000-000000000001',
+        'authenticated', 'authenticated', 'phase4-userA@example.com'),
+       ('00000000-0000-0000-0000-000000000000',
+        'a0000000-0000-0000-0000-000000000002',
+        'authenticated', 'authenticated', 'phase4-userB@example.com');
+
+-- ═══ Section 1. submit_location stages a pending submission (User A) ══════════
+select set_config('request.jwt.claims',
+  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
+
+-- Submit #1: valid sample, access_sensitivity = 'sensitive'
+create temp table sub_a1 as
+  select public.submit_location(
+    'Test Cafe', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot',
+    p_access_sensitivity => 'sensitive') as id;
+
+select is(
+  (select status from public.submissions where id = (select id from sub_a1)),
+  'pending',
+  'submit_location stages status=pending');
+
+select is(
+  (select confirmation_count from public.submissions where id = (select id from sub_a1)),
+  1,
+  'submit_location stages confirmation_count=1 (creator-initial event)');
+
+select ok(
+  (select coordinates is not null from public.submissions where id = (select id from sub_a1)),
+  'submit_location stages a non-null geography coordinate');
+
+select is(
+  (select count(*) from public.submissions
+     where id = (select id from sub_a1) and location_id is not null),
+  0::bigint,
+  'submit_location creates NO linked locations row (pending stays off locations)');
+
+select is(
+  (select access_sensitivity from public.submissions where id = (select id from sub_a1)),
+  'sensitive',
+  'submit_location stages the literal access_sensitivity = sensitive');
+
+-- Submit #2: valid sample, access_sensitivity omitted → must stage NULL
+create temp table sub_a2 as
+  select public.submit_location(
+    'No Sensitivity Spot', 44.06, -123.10, 15::numeric, false, now(), 'public_facility') as id;
+
+select is(
+  (select access_sensitivity from public.submissions where id = (select id from sub_a2)),
+  null::text,
+  'submit_location stages NULL access_sensitivity by default (never a made-up value)');
+
+-- ═══ Section 2. GPS validation — single generic 'gps rejected' error (SC7) ════
+select throws_ok(
+  $$ select public.submit_location('Mock', 44.05, -123.09, 10::numeric, true, now(), 'chill_spot') $$,
+  'P0001', 'gps rejected',
+  'submit_location rejects mocked=true with the generic gps rejected error');
+
+select throws_ok(
+  $$ select public.submit_location('Inaccurate', 44.05, -123.09, 51::numeric, false, now(), 'chill_spot') $$,
+  'P0001', 'gps rejected',
+  'submit_location rejects accuracy > max_accuracy_m (51 > 50) with the same generic error');
+
+select throws_ok(
+  $$ select public.submit_location('Stale', 44.05, -123.09, 10::numeric, false, now() - interval '61 seconds', 'chill_spot') $$,
+  'P0001', 'gps rejected',
+  'submit_location rejects a fix older than max_gps_age_s (61s > 60s) with the same generic error');
+
+select throws_ok(
+  $$ select public.submit_location('FutureDated', 44.05, -123.09, 10::numeric, false, now() + interval '10 seconds', 'chill_spot') $$,
+  'P0001', 'gps rejected',
+  'submit_location rejects a p_captured_at set in the future beyond the 5s clock-skew allowance (WR-02)');
+
+-- ═══ Section 3. Anonymous callers are rejected (auth gate) ════════════════════
+select set_config('request.jwt.claims', '', true);
+
+select throws_ok(
+  $$ select public.submit_location('Anon', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
+  'P0001', 'not authenticated',
+  'submit_location rejects an anonymous caller with not authenticated');
+
+select is(
+  (select count(*) from public.get_my_pending_submissions()),
+  0::bigint,
+  'get_my_pending_submissions returns zero rows for an anonymous caller');
+
+select throws_ok(
+  $$ select public.withdraw_submission('00000000-0000-0000-0000-000000000000'::uuid) $$,
+  'P0001', 'not authenticated',
+  'withdraw_submission rejects an anonymous caller with not authenticated');
+
+-- ═══ Section 4. get_my_pending_submissions is caller-scoped ═══════════════════
+select set_config('request.jwt.claims',
+  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
+
+select is(
+  (select count(*) from public.get_my_pending_submissions()),
+  2::bigint,
+  'get_my_pending_submissions returns only user A''s own two pending rows');
+
+select is(
+  (select count(*) from public.get_my_pending_submissions() where id = (select id from sub_a1)),
+  1::bigint,
+  'get_my_pending_submissions includes the caller''s own pending submission');
+
+select set_config('request.jwt.claims',
+  json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
+
+select is(
+  (select count(*) from public.get_my_pending_submissions()
+     where id in ((select id from sub_a1), (select id from sub_a2))),
+  0::bigint,
+  'get_my_pending_submissions never returns another user''s pending rows');
+
+-- ═══ Section 5. withdraw_submission is owner-scoped ═══════════════════════════
+-- User B (still impersonated) attempts to withdraw user A's row → raises (WR-04 fix:
+-- a zero-row match now raises 'submission not available' instead of a silent no-op).
+select throws_ok(
+  $$ select public.withdraw_submission((select id from sub_a1)) $$,
+  'P0001', 'submission not available',
+  'withdraw_submission by a non-owner raises submission not available');
+select is(
+  (select count(*) from public.submissions where id = (select id from sub_a1)),
+  1::bigint,
+  'withdraw_submission by a non-owner leaves the row intact');
+
+-- User A withdraws their own row → deleted
+select set_config('request.jwt.claims',
+  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
+select public.withdraw_submission((select id from sub_a1));
+select is(
+  (select count(*) from public.submissions where id = (select id from sub_a1)),
+  0::bigint,
+  'withdraw_submission by the owner deletes the pending row (as if never submitted)');
+
+-- ═══ Section 6. No 'withdrawn' status is ever introduced ══════════════════════
+select is(
+  (select count(*) from public.submissions where status = 'withdrawn'),
+  0::bigint,
+  'withdraw never introduces a status=withdrawn value (DELETE, not a status flip)');
+
+-- ═══ Section 7. Direct client INSERT on submissions is denied (2026-07-08 fix) ═
+-- The pre-existing `submissions_insert_auth` RLS policy let a signed-in user
+-- bypass submit_location's GPS validation entirely via a raw INSERT. Dropped in
+-- 20260708010000_phase4_drop_direct_submission_insert.sql. This asserts a real
+-- RLS denial under the `authenticated` role (not the SECURITY DEFINER function,
+-- which runs as the table owner and is unaffected) — mirrors the existing
+-- phase3_read_rpcs.test.sql "base-table access denied" role-switching pattern.
+select set_config('request.jwt.claims',
+  json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
+set local role authenticated;
+select throws_ok(
+  $$ insert into public.submissions (submitter_id, status, confirmation_count, name)
+     values ('a0000000-0000-0000-0000-000000000001'::uuid, 'pending', 1, 'Bypass Attempt') $$,
+  '42501',
+  null,
+  'authenticated role cannot INSERT into submissions directly, even self-attributed (RPC-only write path, submit_location is the sole gate)');
+reset role;
+
+select set_config('request.jwt.claims', '', true);
+select * from finish();
+rollback;

```

## Focused Re-review Addendum (2026-07-09)

The queue now also includes `supabase/migrations/20260708020000_phase4_codex_review_fixes.sql`, created after the original packet to resolve Codex REQUEST CHANGES findings. Review this file from disk with the changed app/test files named above.

Codex fix scope to verify:

1. `update_access_code` server-side validation:
   - new migration rejects `p_code is null`, `btrim(p_code) = ''`, and trimmed values over 100 characters before staging
   - stages only `v_trimmed`, preserving the CR-02 different-proposer guard
   - `phase4_access_code.test.sql` updates `plan(21)` and adds null, empty string, whitespace-only, overlong, no-staging, and trim-before-stage assertions
2. Submit Step 2 validation:
   - `submit.tsx` gates Step 2 with `await trigger(['hours', 'accessCode', 'timingTip'])`
   - Step 2 renders field errors and adds UI `maxLength` bounds for hours, access code, and timing tip
   - `submit.test.tsx` proves an overlong timing tip blocks Step 3 and does not call `submitLocation`
3. Final submit re-entrancy:
   - `submit.tsx` adds `submittingRef` and resets it in mutation `onSettled`
   - `submit.test.tsx` proves a fast double press calls `submitLocation` once

Focused verification evidence:

- `cd app && npx.cmd tsc --noEmit` - exit 0 on 2026-07-09 after the Codex fixes.
- `cd app && npm.cmd test -- --runInBand --runTestsByPath "src/app/__tests__/(tabs)/submit.test.tsx"` - all 14 focused submit component tests reported PASS, then Jest did not exit before timeout because of open handles.
- `cd app && npm.cmd test -- --runInBand --detectOpenHandles --runTestsByPath "src/app/__tests__/(tabs)/submit.test.tsx"` - all 14 focused submit component tests reported PASS, then timed out with no actionable open-handle detail before timeout.
- `cd app && npm.cmd test -- --runInBand --runTestsByPath "src/app/__tests__/(tabs)/submit.test.tsx" --forceExit` - exit 0, all 14 focused submit component tests PASS, with Jest's expected force-exit warning.
- Static pgTAP plan count check: `phase4_access_code.test.sql` has `plan(21)` and 21 assertions; `phase4_submit.test.sql` has `plan(21)` and 21 assertions.
- `git diff --check -- 'app/src/app/(tabs)/submit.tsx' 'app/src/app/__tests__/(tabs)/submit.test.tsx' supabase/migrations/20260708020000_phase4_codex_review_fixes.sql supabase/tests/phase4_access_code.test.sql .claude/review-queue.txt` - exit 0.

Full new migration contents:

```sql
create or replace function public.update_access_code(
  p_location_id uuid,
  p_code        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_proposer uuid;
  v_trimmed text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_code is null or btrim(p_code) = '' then
    raise exception 'code cannot be blank';
  end if;
  v_trimmed := btrim(p_code);
  if char_length(v_trimmed) > 100 then
    raise exception 'code is too long';
  end if;

  if not exists (
    select 1 from public.locations
     where id = p_location_id
       and deleted_at is null
       and shadowban_status is not true
       and suppressed_at is null
  ) then
    raise exception 'location not available';
  end if;

  select pending_code_proposed_by into v_existing_proposer
    from public.locations
   where id = p_location_id;

  if v_existing_proposer is not null and v_existing_proposer <> v_uid then
    raise exception 'code update already pending';
  end if;

  update public.locations
     set pending_access_code      = v_trimmed,
         pending_code_proposed_by = v_uid
   where id = p_location_id;
end;
$$;
```
