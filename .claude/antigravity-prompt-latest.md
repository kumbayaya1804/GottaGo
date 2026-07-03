You are Antigravity for the "Gotta Go" project. This is the review-gate request for **WU-02-T6**, the last work unit in Plan 02-02 (Phase 2, auth/profiles). Read your operating instructions from `ANTIGRAVITY.md` and `docs/agent-harness.md` if you need to refresh context, then read this file fresh from disk:

- `app/src/features/profile/__tests__/profileTrigger.test.ts`

## What This Is

A **test-only** addition — no production code created or modified. It locks the "profile provisioning is trigger-only" contract (T-02-PROV / ROADMAP SC-3): `public.users` has no client-facing INSERT policy, so the only legitimate way a row appears is the `handle_new_user` SECURITY DEFINER trigger firing on `auth.users` insert. Two tests enforce this:

1. A source-scan of all non-test `.ts`/`.tsx` files under `app/src` for any `.from('users').insert(` or `.from('users').upsert(` call — asserts none exist.
2. A read of the real migration file `supabase/migrations/20260627000000_handle_new_user_trigger.sql`, asserting its `handle_new_user()` function body inserts only `id`+`email` and never sets `display_name` (locked per `02-CONTEXT.md` §10).

## Prior Review Round (GSD self-review, already fixed — please verify)

An earlier draft of this file had two issues, both already fixed in the version now on disk:
1. **Tautological test removed:** an earlier "Test 1" drove a fully-mocked Supabase client and asserted only about its own mock inputs — it exercised no application code and was deleted entirely.
2. **Regex blind spot on `.upsert()` closed:** the write-detection pattern now matches both `.insert(` and `.upsert(` — `line 26`: `/\.from\(\s*['"]users['"]\s*\)\s*\.(insert|upsert)\(/`.

A second, fresh GSD review pass on the current file found two more (now fixed) issues:
3. **`functionBody` extraction truncation risk (line 67-69):** the old regex stopped at the first literal `end;`, which would silently truncate on a future nested `BEGIN...END` block (e.g. exception handling) and mask a real `display_name` regression. Fixed by anchoring to the `$$ ... $$` dollar-quote delimiters instead: `/create or replace function public\.handle_new_user\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i`. Verified against the live migration, which does use `as $$ ... $$;` dollar-quoting.
4. **`srcRoot` had no sanity check (line 19-22):** a future file move would have silently narrowed the scan instead of failing loudly. Fixed by adding `expect(fs.existsSync(path.join(srcRoot, 'features'))).toBe(true)` and the same for `lib` before the walk begins.

## Dependency Call Chains

This test does not exercise any application module, provider, hook, route guard, RPC, or Supabase client call — it reads directly from the filesystem (`fs.readdirSync`/`fs.readFileSync`) against the real `app/src` tree and the real migration SQL file. There is no call chain through `sign-up.tsx`, `getMyProfile.ts`, `_layout.tsx`, or any Supabase-mocked boundary. The only "runtime" involved is Node's `fs` module operating on the actual repo tree at test time.

## Runtime Boundary And Mock Audit

Nothing is mocked in this file — that is the point. Instead of testing behavior through a mocked Supabase client (which could hide a real client-side `.insert()`/`.upsert()` call behind a mock that always returns success), this test statically scans real source files and reads the real, committed migration SQL as the source of truth. The boundary that matters here — "does any client code path attempt to write to `users`, and does the trigger migration only set `id`+`email`" — is checked against the actual on-disk artifacts, not a test double, so there is no mock to audit for hiding production behavior.

## Verification Already Run

- `npx jest --testPathPattern=profileTrigger` — 2/2 tests passing (isolated run, post-fix)
- Full suite: `npx jest` — 25 suites, 200 tests, 0 failures (post-fix, includes this file)
- Manually confirmed: no file under `app/src` other than `getMyProfile.ts` calls `.from('users')`, and that call is a `.select()`, not a write
- Confirmed the migration uses `as $$ ... $$;` dollar-quoting, so the new `functionBody` regex captures correctly

## Please Verify

- Whether the two fixes (dollar-quote anchoring, `srcRoot` sanity check) are correct and sufficient
- Whether there is any other latent blind spot in a presence-check/source-scan test of this kind that would matter for provisioning-contract enforcement
- Whether the "no mock to audit" framing above is accurate, or whether you see a boundary this reasoning missed

Return your verdict in the Antigravity format from `ANTIGRAVITY.md`, including a Runtime Boundary Check section per that file's instructions. Save your verdict to `.claude/antigravity-review-latest.md`.
