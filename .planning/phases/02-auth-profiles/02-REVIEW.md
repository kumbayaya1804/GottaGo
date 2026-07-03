---
phase: 02-auth-profiles
reviewed: 2026-07-03T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - app/src/features/profile/__tests__/profileTrigger.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: fixed
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** fixed — both warnings resolved pre-reviewer-handoff (see Post-Review Fixes below); full suite re-run 200/200 passing

## Summary

Reviewed `app/src/features/profile/__tests__/profileTrigger.test.ts` (70 lines, current on-disk version) fresh. The prior `02-REVIEW.md` on disk described an earlier draft (it referenced a "Test 1" mocked signUp round-trip, a bare `.insert(`-only regex, and lines 85-96 for the migration path) — none of that exists in the current 70-line file. That draft's two real findings (a tautological mocked test with no production-code path, and an `.upsert()` blind spot in the regex) have already been fixed: the tautological test was removed entirely, and the write-detection regex is now `/\.from\(\s*['"]users['"]\s*\)\s*\.(insert|upsert)\(/`. This review supersedes that stale content and evaluates only what is currently on disk.

This is a test-only file locking the T-02-PROV / SC-3 contract: (1) no client source file writes to `users` via `.insert`/`.upsert`, and (2) the `handle_new_user` trigger migration sets only `id`+`email`, never `display_name`. Both assertions were independently verified against the live tree and the referenced migration (`supabase/migrations/20260627000000_handle_new_user_trigger.sql`): the only `.from('users')` call anywhere under `app/src` is a `.select()` in `getMyProfile.ts` (no `.insert`/`.upsert` calls exist in the codebase today), and the migration's function body matches both SQL assertions and contains no `display_name` reference. No crashes, no tautologies, no dead code, no production code touched.

The two issues below are latent robustness gaps in the test's own detection logic. Both currently produce correct (passing) results against the present codebase/migration, but each has a plausible future-edit scenario in which the test would stay green while the exact contract it exists to guard was actually broken. Given the file's stated purpose ("a future change can't silently break provisioning"), these gaps are worth closing before relying on this test long-term as the sole guard against provisioning regressions.

## Warnings

### WR-01: `functionBody` extraction can silently truncate on a nested BEGIN/END block, masking a future `display_name` regression

**File:** `app/src/features/profile/__tests__/profileTrigger.test.ts:64-68`
**Issue:** The display_name guard extracts the function body with:
```ts
const functionBody = sql.match(
  /create or replace function public\.handle_new_user\(\)[\s\S]*?begin([\s\S]*?)end;/i
)?.[1];
```
This is non-greedy and stops at the *first* literal `end;` encountered after `begin`. Today the function contains exactly one `begin ... end;` block, so the capture is correct. But if the trigger is ever refactored to include a nested sub-block that itself closes with a literal `end;` — e.g. exception handling:
```sql
begin
  begin
    insert into public.users (id, email) values (new.id, new.email);
  exception when unique_violation then null;
  end;
  update public.users set display_name = new.raw_user_meta_data->>'name' where id = new.id;
  return new;
end;
```
the regex would capture only the *inner* block (up through the first `end;`) and truncate before reaching the later `display_name` assignment. `functionBody` would then not contain `display_name`, and `expect(functionBody!.toLowerCase()).not.toContain('display_name')` would pass — a false negative — even though the real, outer function body now sets it. This is exactly the failure mode this test exists to prevent, and it would fail silently (green test) rather than loudly.

**Fix:** Anchor the capture to the `$$ ... $$` dollar-quote delimiters that bound the whole function body, rather than a bare `begin`/first-`end;` pair, since those are far less likely to be ambiguous under nesting:
```ts
const functionBody = sql.match(
  /create or replace function public\.handle_new_user\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i
)?.[1];
```
This captures the entire function body between the dollar-quoted delimiters regardless of internal nested blocks, eliminating the truncation risk.

### WR-02: `srcRoot` path derivation has no sanity check — a future file move would silently narrow the scan instead of failing loudly

**File:** `app/src/features/profile/__tests__/profileTrigger.test.ts:19`
**Issue:** `const srcRoot = path.join(__dirname, '../../..');` relies on this test file staying at exactly `app/src/features/profile/__tests__/`. Contrast this with the second test's migration path (lines 49-55), which is explicitly commented as intentionally fragile because a wrong path "throws ENOENT here rather than silently passing." `srcRoot` has the identical fragility (a fixed-depth `__dirname` traversal) but the opposite, worse failure mode: if this file is ever relocated one directory level differently (e.g. moved under a new `contracts/` subfolder, or the `__tests__` dir is nested one level deeper), `srcRoot` would resolve to some *other* real directory (e.g. `app/src/features/` instead of `app/src/`), `fs.readdirSync` would succeed there without error, and the walk would simply scan a narrower or entirely wrong subtree. The test would keep passing — while most of `app/src` (e.g. `app/src/lib/**`, `app/src/app/**`) silently stopped being checked for the exact `.insert`/`.upsert` pattern this test exists to catch.

**Fix:** Add an explicit sanity assertion before walking, so a future file move fails loudly instead of silently narrowing scope:
```ts
// Fail loudly (not silently narrow the scan) if this file ever moves relative to src/.
expect(fs.existsSync(path.join(srcRoot, 'features'))).toBe(true);
expect(fs.existsSync(path.join(srcRoot, 'lib'))).toBe(true);
```

## Info

### IN-01: Documented detection blind spot (template literals / variable table names) — accepted risk, no action required

**File:** `app/src/features/profile/__tests__/profileTrigger.test.ts:20-22`
**Issue:** The inline comment already discloses that `writePattern` won't catch `.from(\`users\`)` (template literal) or a table name held in a variable (e.g. `.from(USERS_TABLE)`). This is a real detection gap, but it is explicitly acknowledged in the file as an accepted tradeoff given the project's single-quote convention. Recorded here for visibility only — not a new finding requiring a fix in this work unit.
**Fix:** None required now. If the codebase ever adopts dynamic table-name constants for `users`, revisit this regex (or replace the presence-check with an AST-based scan) at that time.

## Post-Review Fixes

Both warnings were fixed before reviewer handoff:

- **WR-01 fixed:** `functionBody` extraction now anchors to the `$$ ... $$` dollar-quote delimiters (`as \$\$([\s\S]*?)\$\$;`) instead of the first literal `begin`/`end;` pair, eliminating the nested-block truncation risk. Verified against the live migration, which does use `as $$ ... $$;` dollar-quoting.
- **WR-02 fixed:** Added two `expect(fs.existsSync(...)).toBe(true)` sanity assertions (`features`, `lib` subdirectories) before the `srcRoot` walk, so a future file move fails loudly (test failure) instead of silently narrowing the scan.

Full suite re-run after fixes: `npx jest` — 25 suites, 200 tests, 0 failures (was 25/200 before this file existed at all; T6 added no new test count change since the tautological test removed in the prior round was replaced 1:1 by the two remaining tests).

IN-01 requires no action (documented, accepted tradeoff).

---

_Reviewed: 2026-07-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
