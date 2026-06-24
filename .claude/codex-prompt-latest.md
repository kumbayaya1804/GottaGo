# Codex Review Prompt — Phase 1 Final Fix (2026-06-24)

## Scope

Two findings from the prior Codex REQUEST CHANGES verdict have been fixed. This is a targeted re-review of those two fixes only. Return APPROVE if both are correct and no new issues were introduced.

Files in scope:
- `app/tsconfig.test.json`
- `app/src/lib/database.types.ts`

---

## What Was Fixed

### MAJOR (resolved) — `tsconfig.test.json` TS18003: No inputs were found

**Prior finding:** `tsconfig.test.json` extended root tsconfig whose `exclude` list included `__tests__` and `src/**/__tests__`, which overrode the `include` globs, leaving no files for the compiler to find.

**Fix applied:** `app/tsconfig.test.json`
1. Added `"exclude": ["node_modules", "components", "constants"]` — overrides the inherited exclude, making test dirs visible
2. Added `"node"` to the `types` array — explicit `types` list blocked auto-inclusion of `@types/node`, causing `process`/`require` errors in test files

**Verification:**
- `tsc -p tsconfig.test.json --noEmit` → exit 0 (previously exit 2 with TS18003)
- `tsc --noEmit` (root) → exit 0, no regressions
- `npm test` → 7/7 pass

### MINOR (resolved) — `database.types.ts` stale after NOT NULL migrations

**Prior finding:** `locations.shadowban_status` and `users.shadowban_status` were typed as `boolean | null` in Row, but migration 000001 added NOT NULL constraints.

**Fix applied:** `app/src/lib/database.types.ts` — regenerated from live Supabase schema via MCP. Both fields now correctly typed as `boolean` (non-null) in Row. Insert/Update retain `shadowban_status?: boolean` (optional with server default).

---

## Verification Evidence

- `tsc -p tsconfig.test.json --noEmit` → exit 0
- `tsc --noEmit` → exit 0
- `npm test` → 7/7 pass
- Committed at: `33c951b`

---

## Review Instructions

1. Read `app/tsconfig.test.json` from disk — confirm exclude override and types array
2. Read `app/src/lib/database.types.ts` — spot-check `locations.shadowban_status` and `users.shadowban_status` in Row types
3. Run `tsc -p tsconfig.test.json --noEmit` to confirm no TS18003 and no new errors
4. Run `npm test` to confirm 7/7 still pass
5. Return APPROVE if both fixes are correct and no new issues found

## Expected Output Format

```md
## Codex Review - Phase 1 Final Fix (2026-06-24)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, required fix.

### Verification
- Commands run and results.

### Approved
- What is correct and ready.
```

Save your completed review to `.claude/codex-review-latest.md`.
