#!/usr/bin/env node
/**
 * Runs a pgTAP suite against a disposable, single-use local Supabase/Postgres
 * instance instead of the shared dev stack in supabase/config.toml.
 *
 * Required for any suite invocation that includes a test committing a real,
 * globally-visible mutation mid-test (e.g. a two-session race that changes
 * app_config and must be invisible to any other concurrent run). Plain
 * `supabase test db` against the fixed `Gotta_Go` project/ports cannot prove
 * exclusive ownership: two invocations sharing that stack can interleave a
 * committed global mutation and its restore.
 *
 * Mechanism: copies supabase/migrations, supabase/tests, supabase/seed.sql
 * and a rewritten supabase/config.toml (unique project_id, every host-facing
 * port shifted by a random per-invocation offset) into a fresh OS temp
 * directory, then drives that copy via `supabase --workdir <tmp>`. Teardown
 * (`supabase stop --no-backup`) is attempted after every start attempt that
 * could have created containers/volumes — including a failed or partial
 * start — never only after a fully successful one, and a teardown failure
 * fails the whole run rather than being downgraded to a warning.
 *
 * Usage:
 *   node supabase/scripts/run-isolated-db-suite.js [test-path...]
 * Defaults to the full supabase/tests directory when no path is given. Every
 * positional argument must be an existing path inside supabase/tests/ in
 * this checkout (resolved, symlink-free, checked before any temp directory
 * is created) — this is a path allowlist, not a general argument passthrough.
 */

'use strict';

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SUPABASE_DIR = path.join(REPO_ROOT, 'supabase');
const TESTS_DIR = path.join(SUPABASE_DIR, 'tests');

// Rewrites every host-facing port key this repo's config.toml actually
// defines, not just `port`/`shadow_port` — confirmed by grepping config.toml
// for every `*port*` key: api, db, db.pooler, studio, inbucket, analytics use
// `port`/`shadow_port`; edge_runtime uses the differently-named
// `inspector_port`, which a naive port|shadow_port-only regex silently skips
// (confirmed: a dry-run rewrite left inspector_port=8083 unchanged while
// shifting every other port), leaving two "isolated" instances able to
// collide on that one port.
const PORT_KEYS = ['port', 'shadow_port', 'inspector_port'];
const PORT_KEY_PATTERN = new RegExp(`^(\\s*)(${PORT_KEYS.join('|')})(\\s*=\\s*)(\\d+)(\\s*)$`, 'gm');

function rewriteConfig(originalToml, projectId, portOffset) {
  let rewritten = originalToml.replace(
    /^project_id = ".*"$/m,
    `project_id = "${projectId}"`
  );
  rewritten = rewritten.replace(
    PORT_KEY_PATTERN,
    (full, indent, key, sep, value, trail) => `${indent}${key}${sep}${Number(value) + portOffset}${trail}`
  );
  return rewritten;
}

// --- Safe, non-shell CLI invocation ----------------------------------------
// An EARLIER version of this file drove the Windows `.cmd` shim through
// `cmd.exe /d /s /c "<manually quoted command line>"` with caret-escaped
// metacharacters. Codex's round-14 review demonstrated this was still
// exploitable: `cmd.exe` performs `%VAR%` environment-variable expansion as
// a raw text substitution pass over the ENTIRE command line before it even
// tokenizes quotes — no client-side quoting/escaping of the string handed to
// `cmd.exe` can prevent that expansion, because the dangerous content isn't
// literally present in the string being quoted, it's substituted in by
// `cmd.exe` itself afterward from the process environment. Reproduced
// empirically: a `.cmd` helper that echoes its literal argv, invoked through
// that exact pattern, received `"CLOSE"` as its argument and then a SECOND,
// fully executed `echo INJECTED` command — actual code execution — when
// handed `%SOME_ENV_VAR%` as an argument with a crafted environment variable
// value. No caret-escaping scheme fixes this, because `cmd.exe`'s
// percent-expansion pass runs before caret-escaping is ever interpreted.
//
// The correct fix is to remove the `cmd.exe` command-string boundary
// entirely rather than trying to out-escape it. The installed `supabase`
// CLI is an npm package whose `.cmd`/`.exe` platform shim is itself nothing
// but `"<node.exe>" "<dp0>\node_modules\supabase\dist\supabase.js" %*`
// (confirmed by reading the actual installed shim on this host) — a thin
// launcher for a real JavaScript entry point. Resolving that JS entry path
// and invoking it directly via `spawnSync(process.execPath, [jsEntry,
// ...args], { shell: false })` bypasses `cmd.exe`/the shim entirely: Node's
// non-shell spawn passes the argument array to the OS process-creation API
// verbatim, with no command-line re-parsing, re-tokenizing, or environment
// expansion of any kind. Re-ran the exact same two payloads that broke the
// `cmd.exe` pattern (the `%VAR%`-expansion payload and a literal
// `foo & echo INJECTED & echo bar` argument) against this direct-node
// invocation: both arrived as a single inert literal argument (the CLI
// itself reported `UnknownSubcommand "%ROUND14_PAYLOAD%"` and
// `UnknownSubcommand "foo & echo INJECTED & echo bar"` respectively) with no
// expansion and no second command executing. This works identically on
// every platform, so there is no more platform-specific branch at all.
// Pure shim-parsing step, split out from PATH discovery below so it can be
// driven deterministically in tests against a synthetic on-disk shim
// without requiring the real supabase CLI to be installed on the test host.
function resolveJsEntryFromShimPath(shimPath, { readFile = (p) => fs.readFileSync(p, 'utf8'), fileExists = (p) => fs.existsSync(p) } = {}) {
  if (!shimPath) return null;

  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(shimPath)) {
    // npm's generated .cmd shim launches "<shim-dir>\node_modules\supabase\dist\supabase.js".
    // Read the shim itself rather than hardcoding that relative path, so a
    // different npm/install layout is discovered correctly instead of
    // silently resolving to a stale or wrong file.
    const shimContents = readFile(shimPath);
    const match = shimContents.match(/"%dp0%\\(node_modules\\supabase\\dist\\supabase\.js)"/i);
    if (!match) return null;
    const jsEntry = path.join(path.dirname(shimPath), match[1]);
    return fileExists(jsEntry) ? jsEntry : null;
  }

  // Non-Windows, or a Windows .exe shim: the resolved binary is typically
  // already a real executable (or a symlink to one), not a further-indirected
  // shim requiring text parsing.
  return shimPath;
}

function resolveCliJsEntry() {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(finder, ['supabase'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) {
    return null;
  }
  const candidates = result.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const shimPath = process.platform === 'win32'
    ? candidates.find((c) => /\.(cmd|bat)$/i.test(c)) || candidates.find((c) => /\.exe$/i.test(c))
    : candidates[0];
  return resolveJsEntryFromShimPath(shimPath);
}

function makeRunSupabase(jsEntryOrBinPath) {
  const isJsEntry = jsEntryOrBinPath.toLowerCase().endsWith('.js');
  return function runSupabase(args) {
    console.error(`[run-isolated-db-suite] supabase ${args.join(' ')}`);
    if (isJsEntry) {
      return spawnSync(process.execPath, [jsEntryOrBinPath, ...args], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        shell: false,
      });
    }
    return spawnSync(jsEntryOrBinPath, args, { cwd: REPO_ROOT, stdio: 'inherit', shell: false });
  };
}

// --- Strict argument validation ---------------------------------------------
// Every positional argument must resolve (after following symlinks) to a
// path inside supabase/tests/. No option-like tokens (anything starting
// with "-") are accepted at all — this is an allowlist of real test paths,
// not a general command passthrough with a denylist of known-bad flags.
function validateTargets(rawArgs, testsDir) {
  for (const arg of rawArgs) {
    if (arg.startsWith('-')) {
      throw new Error(`refusing option-like argument "${arg}" — this runner only accepts test file/directory paths under supabase/tests/, never flags.`);
    }
  }
  const relativeTargets = rawArgs.length > 0 ? rawArgs : [testsDir];
  const realTestsDir = fs.realpathSync(testsDir);
  return relativeTargets.map((target) => {
    const asGiven = path.isAbsolute(target) ? target : path.join(REPO_ROOT, target);
    if (!fs.existsSync(asGiven)) {
      throw new Error(`refusing "${target}" — does not exist.`);
    }
    const real = fs.realpathSync(asGiven);
    if (real !== realTestsDir && !real.startsWith(realTestsDir + path.sep)) {
      throw new Error(`refusing "${target}" — resolves to ${real}, which is outside supabase/tests/ (${realTestsDir}). Only paths inside supabase/tests/ are accepted.`);
    }
    return real;
  });
}

function defaultPortInUse(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(true));
    srv.once('listening', () => srv.close(() => resolve(false)));
    srv.listen(port, '127.0.0.1');
  });
}

/**
 * Core lifecycle, isolated from CLI/argv/process.exit so it can be driven
 * deterministically in tests with a fake runSupabase/portInUse/prepare.
 *
 * `prepare()` does everything up through writing the rewritten config.toml
 * into the temp dir and returns `{ targets, portsToCheck }` — the resolved
 * test target paths inside the temp dir, and the list of ports the rewritten
 * config actually uses (computed from the same rewrite `prepare` performed,
 * not a value threaded in ahead of time, so tests exercise the real
 * dependency: ports are only known once `prepare()` has run). Throwing from
 * `prepare()` simulates a pre-start failure (copy/config-rewrite/directory
 * setup), which must be cleaned up immediately since no `supabase start`
 * could have run yet.
 *
 * Returns `{ exitCode, message }`. Never touches process.exit itself.
 */
async function runLifecycle({ tmpRoot, prepare, runSupabase, portInUse, projectId, portOffset, removeDir }) {
  let startAttempted = false;
  let testResult = { status: 1 };
  let runError = null;

  // `return` inside this try block (see the prepare() failure case below) is
  // safe HERE because runLifecycle's own try/finally is the last work this
  // function does — `return` inside `try` still runs `finally` first, then
  // returns. That is NOT the same as an earlier version of this file, where
  // process.exit() was called inside a try nested in a larger function with
  // MORE code after its finally: exit() does not run finally at all, and
  // even a plain `return` there would have skipped exit-code handling that
  // lived after the try/finally in that outer function. Here there is
  // nothing after the try/finally except the two `return` statements at the
  // bottom, so early-returning from inside try cannot skip anything.
  // Non-throwing failures (port-in-use, start failure) still use the
  // `!runError` guard pattern instead of `return`, purely to keep the
  // start/test/teardown sequence linear and readable.
  try {
    let tmpTargets;
    let portsToCheck;
    try {
      const prepared = await prepare();
      tmpTargets = prepared.targets;
      portsToCheck = prepared.portsToCheck;
    } catch (err) {
      runError = `setup failed before any instance was started: ${err.message}`;
      return { exitCode: 1, message: runError, startAttempted: false };
    }

    for (const port of portsToCheck) {
      // eslint-disable-next-line no-await-in-loop
      if (await portInUse(port)) {
        runError = `port ${port} (offset +${portOffset}) is already bound — cannot prove exclusive ownership of a disposable instance. Re-run (a fresh random offset is chosen each invocation).`;
        break;
      }
    }

    if (!runError) {
      startAttempted = true;
      const startResult = runSupabase(['start', '--workdir', tmpRoot, '--yes']);
      if (startResult.status !== 0) {
        runError = `supabase start failed (exit ${startResult.status}) against the disposable instance — see output above. Attempting teardown in case partial resources were created.`;
      } else {
        testResult = runSupabase(['test', 'db', '--local', '--workdir', tmpRoot, ...tmpTargets]);
      }
    }
  } finally {
    if (startAttempted) {
      // Teardown is attempted whenever `supabase start` was invoked at all —
      // including when it returned nonzero — because a failed start can
      // still have created containers or volumes before the failure. A
      // teardown that itself fails is NOT downgraded to a warning: it
      // forces a nonzero runner exit below and the temp workdir is kept
      // (not deleted) so its path is available as a manual recovery
      // reference, since deleting it would discard the only record of
      // which disposable project_id/workdir needs manual cleanup.
      const stopResult = runSupabase(['stop', '--no-backup', '--workdir', tmpRoot]);
      if (stopResult.status !== 0) {
        runError = `teardown ("supabase stop --no-backup") exited ${stopResult.status} for project_id=${projectId} — containers/volumes may remain. Workdir NOT deleted, inspect/clean up manually: ${tmpRoot} (e.g. "supabase stop --no-backup --project-id ${projectId}" or "docker ps --filter name=${projectId}").`;
      } else {
        removeDir(tmpRoot);
      }
    } else {
      // Nothing was ever started (failed before reaching `supabase start`,
      // e.g. port-preflight failure) — safe to delete immediately, no
      // containers/volumes could exist yet.
      removeDir(tmpRoot);
    }
  }

  if (runError) return { exitCode: 1, message: runError, startAttempted };
  return { exitCode: testResult.status ?? 1, message: null, startAttempted };
}

async function main() {
  const migrationsDir = path.join(SUPABASE_DIR, 'migrations');
  const seedFile = path.join(SUPABASE_DIR, 'seed.sql');
  const configFile = path.join(SUPABASE_DIR, 'config.toml');
  if (!fs.existsSync(configFile)) {
    console.error(`[run-isolated-db-suite] expected ${configFile} to exist — run from a checkout with a real supabase/ directory.`);
    process.exit(1);
  }

  let resolvedTargets;
  try {
    resolvedTargets = validateTargets(process.argv.slice(2), TESTS_DIR);
  } catch (err) {
    console.error(`[run-isolated-db-suite] ${err.message}`);
    process.exit(1);
  }

  const cliTarget = resolveCliJsEntry();
  if (!cliTarget) {
    console.error('[run-isolated-db-suite] could not resolve the "supabase" CLI\'s real executable/JS entry on PATH.');
    process.exit(1);
  }
  const runSupabase = makeRunSupabase(cliTarget);

  const suffix = crypto.randomBytes(4).toString('hex');
  const projectId = `gotta_go_isol_${suffix}`;
  // Keep every rewritten port under 65535 even for the highest base port (54329) with headroom to spare.
  const portOffset = 1000 + crypto.randomInt(0, 1000) * 10;
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gotta-go-db-suite-'));

  const prepare = async () => {
    const tmpSupabase = path.join(tmpRoot, 'supabase');
    fs.mkdirSync(tmpSupabase, { recursive: true });
    fs.cpSync(migrationsDir, path.join(tmpSupabase, 'migrations'), { recursive: true });
    fs.cpSync(TESTS_DIR, path.join(tmpSupabase, 'tests'), { recursive: true });
    if (fs.existsSync(seedFile)) fs.copyFileSync(seedFile, path.join(tmpSupabase, 'seed.sql'));

    const originalToml = fs.readFileSync(configFile, 'utf8');
    const rewrittenToml = rewriteConfig(originalToml, projectId, portOffset);
    fs.writeFileSync(path.join(tmpSupabase, 'config.toml'), rewrittenToml, 'utf8');

    const realTestsDir = fs.realpathSync(TESTS_DIR);
    const tmpTargets = resolvedTargets.map((real) => {
      const relative = path.relative(realTestsDir, real);
      return relative === '' ? path.join(tmpSupabase, 'tests') : path.join(tmpSupabase, 'tests', relative);
    });

    console.error(`[run-isolated-db-suite] disposable instance: project_id=${projectId} port_offset=+${portOffset} workdir=${tmpRoot}`);
    const portsToCheck = [...rewrittenToml.matchAll(PORT_KEY_PATTERN)].map((m) => Number(m[4]));
    return { targets: tmpTargets, portsToCheck };
  };

  const result = await runLifecycle({
    tmpRoot,
    prepare,
    runSupabase,
    portInUse: defaultPortInUse,
    projectId,
    portOffset,
    removeDir: (dir) => fs.rmSync(dir, { recursive: true, force: true }),
  });

  if (result.message) console.error(`[run-isolated-db-suite] ${result.message}`);
  process.exit(result.exitCode);
}

module.exports = { rewriteConfig, resolveCliJsEntry, resolveJsEntryFromShimPath, validateTargets, runLifecycle, PORT_KEY_PATTERN };

if (require.main === module) {
  main();
}
