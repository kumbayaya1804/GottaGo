# Codex Review Request - Gotta Go (WU-02-T6, Plan 02-02 final task)

<context>
This is the review-gate request for WU-02-T6, the last work unit in Plan 02-02 (Phase 2, auth/profiles). It is a **test-only** addition — no production code created or modified. The queued file (from `.claude/review-queue.txt`) is:

- `app/src/features/profile/__tests__/profileTrigger.test.ts`

It locks the "profile provisioning is trigger-only" contract (T-02-PROV / ROADMAP SC-3): `public.users` has no client-facing INSERT policy, so the only legitimate way a row appears is the `handle_new_user` SECURITY DEFINER trigger firing on `auth.users` insert.
</context>

<role>
Read `CODEX.md` for your standing review priorities (security/privacy first, then data integrity, then test coverage/quality). This change touches none of the security/privacy/RLS/GPS/trust surface directly — it is a regression-guard test for an existing, already-migrated trigger contract. Your primary job here is judging test quality and whether the guard actually protects the invariant it claims to.
</role>

<what_the_file_does>
Two tests:
1. A source-scan of every non-test `.ts`/`.tsx` file under `app/src` for `.from('users').insert(` or `.from('users').upsert(` — asserts zero matches.
2. A read of the real migration `supabase/migrations/20260627000000_handle_new_user_trigger.sql`, asserting the `handle_new_user()` function body inserts only `id`+`email` and never sets `display_name`.
</what_the_file_does>

<prior_reviews>
GSD (Claude) self-review ran twice on this file across two drafts:

**Round 1 (earlier draft, already fixed on disk):**
1. Removed a tautological "Test 1" that drove a fully-mocked Supabase client and asserted only about its own mock's inputs — no application code was exercised, so it could never catch a real regression.
2. Widened the write-detection regex from `.insert(`-only to `/\.from\(\s*['"]users['"]\s*\)\s*\.(insert|upsert)\(/` (line 26) — `.upsert()` creates rows exactly like `.insert()` does when no row exists, and was previously an undetected bypass of this exact guard.

**Round 2 (current file, already fixed on disk):**
3. `functionBody` extraction (line 67-69) previously matched `begin([\s\S]*?)end;` non-greedily — a future nested `BEGIN...END` block (e.g. exception handling) would truncate the capture at the first inner `end;` and could silently mask a real `display_name` regression in the outer block. Fixed by anchoring to the dollar-quote delimiters instead: `/create or replace function public\.handle_new_user\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i`. Confirmed the live migration uses `as $$ ... $$;` dollar-quoting, so this still matches correctly today.
4. `srcRoot` (line 19) had no sanity check — a future file move would silently narrow the scan rather than fail loudly, unlike the migration-path test which is documented to throw ENOENT on a mismatch. Fixed by adding `expect(fs.existsSync(path.join(srcRoot, 'features'))).toBe(true)` and the same check for `lib` before the walk begins.

Full findings are in `.planning/phases/02-auth-profiles/02-REVIEW.md` (status: fixed).
</prior_reviews>

<verification_focus>
1. Are the two structural detection techniques (regex source-scan, migration-SQL parse) sound as "presence check, not exhaustive" guards, given their documented and accepted blind spots (template-literal table names, variable table names — see the in-file comment on line 23-25)?
2. Does the dollar-quote anchoring fix in test 2 actually eliminate the truncation risk, or is there a remaining edge case (e.g. a `$$` appearing inside a string literal within the function body)?
3. Does the `srcRoot` sanity check in test 1 meaningfully reduce the silent-narrowing risk, or is there a stronger/simpler check you'd want instead?
4. Is there any client code path this source-scan structurally cannot see (e.g. a Supabase Edge Function, a server action, dynamic `require()`) that would still let something insert into `users` without this test noticing?
</verification_focus>

## Runtime Boundary And Mock Audit

<runtime_boundary_and_mock_audit>
Dependency call chain: none — this test does not import or call any application module, hook, provider, route guard, or Supabase client. It reads real files from disk via Node's `fs` module: the actual `app/src` tree (for the source scan) and the actual committed migration SQL (for the trigger-body assertion). There is nothing mocked in this file, so there is no mock boundary that could hide production behavior — the "boundary" under test is the real, on-disk source tree and the real, committed migration, not a test double standing in for either.
</runtime_boundary_and_mock_audit>

<verification_already_run>
- `npx jest --testPathPattern=profileTrigger` — 2/2 tests passing (isolated run, post-fix)
- Full suite: `npx jest` — 25 suites, 200 tests, 0 failures (post-fix, includes this file)
- Manually confirmed: no file under `app/src` other than `getMyProfile.ts` calls `.from('users')`, and that call is a `.select()`, not a write
- Confirmed via `docs/schema-contract.md` that `public.users` has no direct INSERT/UPDATE policy, consistent with this test's premise
</verification_already_run>

<output_format>
```md
## Codex Review - WU-02-T6 (profileTrigger.test.ts)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, and required fix.

### Open Questions
...

### Verification
...

### Runtime Boundary Check
...

### Approved
...
```

Save your verdict to `.claude/codex-review-latest.md`.
</output_format>
