/**
 * T-02-PROV / ROADMAP SC-3: profile-provisioning contract.
 *
 * public.users has no INSERT policy (see docs/schema-contract.md) — the ONLY way a
 * row can appear is the SECURITY DEFINER `handle_new_user` trigger firing on
 * `auth.users` insert. This locks two things so a future change can't silently
 * break provisioning:
 *   1. No client code path ever writes to `users` via `.insert(`/`.upsert(`
 *      (both create rows; `users` has no policy permitting either from the client).
 *   2. The trigger's own committed migration only sets `id`+`email` — display_name
 *      stays null until `update_profile` is called (02-CONTEXT.md §10, locked).
 */

import fs from 'fs';
import path from 'path';

describe('profile provisioning contract (T-02-PROV, SC-3)', () => {
  it('no client-side source file performs a direct INSERT/UPSERT into users (provisioning is trigger-only)', () => {
    const srcRoot = path.join(__dirname, '../../..');
    // Fail loudly (not silently narrow the scan) if this file ever moves relative to src/.
    expect(fs.existsSync(path.join(srcRoot, 'features'))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, 'lib'))).toBe(true);
    // Presence check only — does not catch template-literal table names (e.g.
    // `.from(\`users\`)`) or table names held in a variable. Acceptable given the
    // project's single-quote convention; not an exhaustive guarantee.
    const writePattern = /\.from\(\s*['"]users['"]\s*\)\s*\.(insert|upsert)\(/;
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (
          /\.(ts|tsx)$/.test(entry.name) &&
          !entry.name.endsWith('.test.ts') &&
          !entry.name.endsWith('.test.tsx')
        ) {
          const contents = fs.readFileSync(fullPath, 'utf8');
          if (writePattern.test(contents)) {
            offenders.push(fullPath);
          }
        }
      }
    }
    walk(srcRoot);

    expect(offenders).toEqual([]);
  });

  it('handle_new_user migration inserts id+email only — display_name is not set by the trigger', () => {
    // Hardcoded path/filename: this is the first test reaching from app/src into the
    // sibling supabase/ directory. If this migration is ever renamed/squashed, this
    // throws ENOENT here rather than silently passing — update the path below.
    const migrationPath = path.join(
      __dirname,
      '../../../../../supabase/migrations/20260627000000_handle_new_user_trigger.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/insert into public\.users\s*\(id, email\)/i);
    expect(sql).toMatch(/values\s*\(new\.id, new\.email\)/i);

    // Scope the display_name check to the handle_new_user function body specifically
    // (not the file's explanatory header comments, which mention "no display_name"
    // by design, and not any other function that might be added to this file later).
    const functionBody = sql.match(
      /create or replace function public\.handle_new_user\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i
    )?.[1];
    expect(functionBody).toBeDefined();
    expect(functionBody!.toLowerCase()).not.toContain('display_name');
  });
});
