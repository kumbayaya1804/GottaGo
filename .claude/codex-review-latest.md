# Codex Review - Phase 4: GPS Service & Submission Fix Re-review

**VERDICT: APPROVE**

### Reviewed Queue
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
- supabase/migrations/20260708010000_phase4_drop_direct_submission_insert.sql
- supabase/tests/phase4_access_code.test.sql
- supabase/tests/phase4_submit.test.sql
- supabase/migrations/20260708020000_phase4_codex_review_fixes.sql

### Findings
- None.

### Open Questions
- None affecting merge safety.

### Verification
- `npx.cmd tsc --noEmit` from `app` - exit 0.
- `npm.cmd test -- --runInBand --runTestsByPath "src/app/__tests__/(tabs)/submit.test.tsx"` from `app` - all 14 focused submit component tests reported PASS, then the command timed out because Jest did not exit after printing the open-handle warning.
- `npm.cmd test -- --runInBand --detectOpenHandles --runTestsByPath "src/app/__tests__/(tabs)/submit.test.tsx"` from `app` - all 14 focused submit component tests reported PASS, then the command timed out with no actionable open-handle detail before timeout.
- `npm.cmd test -- --runInBand --runTestsByPath "src/app/__tests__/(tabs)/submit.test.tsx" --forceExit` from `app` - exit 0, all 14 focused submit component tests PASS, with Jest's expected force-exit warning.
- Static pgTAP plan count check: `supabase/tests/phase4_access_code.test.sql` has `plan(21)` and 21 pgTAP assertions; `supabase/tests/phase4_submit.test.sql` has `plan(21)` and 21 pgTAP assertions.
- `git diff --check -- 'app/src/app/(tabs)/submit.tsx' 'app/src/app/__tests__/(tabs)/submit.test.tsx' supabase/migrations/20260708020000_phase4_codex_review_fixes.sql supabase/tests/phase4_access_code.test.sql .claude/review-queue.txt` - exit 0.
- `supabase test db` / pgTAP was not run here; this environment does not currently provide the Docker-backed Supabase test runner evidence.
- Live Supabase policy/RPC state was not independently queried from this Codex run; this approval is based on queued migration/test/application code review plus the verification above.

### Runtime Boundary Check
- Door-code RPC: `20260708020000_phase4_codex_review_fixes.sql` replaces `update_access_code` so it rejects `p_code is null`, blank/whitespace-only values after `btrim`, and values longer than 100 characters before staging. It stages the trimmed value and keeps the different-proposer conflict guard. `phase4_access_code.test.sql` now covers null, empty string, whitespace-only, overlong input, no staging for rejected proposals, and trim-before-stage behavior.
- Submit wizard: `submit.tsx` now gates Step 2 with `trigger(['hours', 'accessCode', 'timingTip'])`, renders Step 2 field errors, applies UI `maxLength` bounds, and uses `submittingRef` as a synchronous final-submit guard. `submit.test.tsx` now proves an overlong timing tip does not advance to GPS/submit and a fast double press calls `submitLocation` once.
- Direct submission INSERT bypass: `20260708010000_phase4_drop_direct_submission_insert.sql` remains queued and drops the auth direct-insert policy. `phase4_submit.test.sql` remains aligned statically with the expected direct-insert denial coverage.
- Mock boundary: the focused React tests mock GPS/session/RPC wrappers and prove UI control flow. Database enforcement remains covered here by migration text plus static pgTAP inspection, not by executed pgTAP.

### Approved
- The previous MAJOR finding for `update_access_code` server-side null/blank/overlong validation is fixed by `20260708020000_phase4_codex_review_fixes.sql` and matching pgTAP additions.
- The previous MAJOR finding for Step 2 bypassing Zod validation is fixed in `submit.tsx` and covered by `submit.test.tsx`.
- The previous MAJOR finding for final-submit double tap re-entrancy is fixed in `submit.tsx` and covered by `submit.test.tsx`.
- No remaining Codex request-change findings were found in the inspected scope.

### Gate Notes
- `.claude/review-queue.txt` and both prompt packets now include the new Codex fix migration. The saved Antigravity verdict still predates that migration and must be refreshed before the full review gate can be treated as complete.
- The focused Jest assertions pass, but the normal Jest process still leaves open handles and needs `--forceExit` for a clean process exit in this environment. Treat that as a remaining test-harness caveat, not evidence of failing assertions.
