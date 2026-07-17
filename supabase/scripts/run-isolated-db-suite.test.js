'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { rewriteConfig, resolveCliJsEntry, resolveJsEntryFromShimPath, validateTargets, runLifecycle, PORT_KEY_PATTERN } = require('./run-isolated-db-suite.js');

// --- rewriteConfig / PORT_KEY_PATTERN ---------------------------------------

test('rewriteConfig shifts port, shadow_port, AND inspector_port', () => {
  const toml = [
    'project_id = "Gotta_Go"',
    '',
    '[api]',
    'port = 54321',
    '',
    '[db]',
    'port = 54322',
    'shadow_port = 54320',
    '',
    '[edge_runtime]',
    'enabled = true',
    'inspector_port = 8083',
  ].join('\n');

  const rewritten = rewriteConfig(toml, 'gotta_go_isol_test', 1000);

  assert.match(rewritten, /project_id = "gotta_go_isol_test"/);
  assert.match(rewritten, /^port = 55321$/m);
  assert.match(rewritten, /^port = 55322$/m);
  assert.match(rewritten, /^shadow_port = 55320$/m);
  assert.match(rewritten, /^inspector_port = 9083$/m, 'inspector_port must be shifted like every other host-facing port key, not silently left at its original value');
});

test('PORT_KEY_PATTERN does not match unrelated keys containing "port" as a substring', () => {
  const toml = 'important_port_note = 54321\nreport_something = 1\nport = 54321';
  const matches = [...toml.matchAll(PORT_KEY_PATTERN)];
  assert.equal(matches.length, 1, 'only the exact "port" key should match, not keys that merely contain "port" as a substring');
  assert.equal(matches[0][2], 'port');
});

// --- resolveCliJsEntry / direct-node invocation, REAL round-trip tests ------
//
// Codex's round-14 review found the PREVIOUS approach here (cmd.exe /d /s /c
// plus manual argv quoting) was still exploitable: cmd.exe performs %VAR%
// environment-variable expansion as a raw text pass over the whole command
// line, before it even tokenizes quotes, so no client-side escaping of the
// string handed to cmd.exe can prevent it. It also flagged that the OLD
// tests only inspected the *string* the quoting function produced — they
// never invoked a real shim and never asserted what argv actually arrived on
// the other side, so the injection was never actually exercised by a test.
//
// These tests fix both problems with three layers of coverage, none of them
// a copy of the quoting logic under test: (1) a synthetic JavaScript
// argv-echo fixture driven through the exact production primitive —
// `spawnSync(process.execPath, [jsEntry, ...args], {shell:false})` — to
// prove the underlying invocation mechanism is injection-proof in isolation;
// (2) a synthetic on-disk npm-style `.cmd` shim (parser-relevant lines only,
// not a byte-for-byte copy of the real npm-generated shim — see the
// `writeSyntheticNpmShim()` note below) that exercises the REAL exported
// `resolveJsEntryFromShimPath()` parser, not a reimplementation of its
// regex; (3) a genuine round-trip against the ACTUAL installed `supabase`
// CLI shim when present on PATH, resolved via the real production
// `resolveCliJsEntry()`. All three assert on the ACTUAL received argv/output,
// not on the shape of an intermediate string.

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-isolated-cli-probe-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('direct-node invocation: a %VAR%-style payload is never expanded by the OS, even with a crafted environment variable (the exact injection Codex demonstrated against the old cmd.exe pattern)', { skip: process.platform !== 'win32' && 'argv-echo fixture below targets Windows shell-expansion specifically' }, () => {
  withTempDir((dir) => {
    const echoScript = path.join(dir, 'echo-argv.js');
    fs.writeFileSync(echoScript, 'console.log("ARGV:" + JSON.stringify(process.argv.slice(2)));\n');

    const r = spawnSync(process.execPath, [echoScript, '%INJECTION_PAYLOAD%'], {
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, INJECTION_PAYLOAD: 'CLOSE" & echo INJECTED & rem "' },
    });

    assert.equal(r.status, 0);
    assert.ok(!r.stdout.includes('INJECTED'), `expected no expansion/execution, got: ${r.stdout}`);
    assert.match(r.stdout, /ARGV:\["%INJECTION_PAYLOAD%"\]/, 'the literal %VAR% token must arrive unexpanded — direct spawnSync with shell:false performs no environment substitution at all');
  });
});

test('direct-node invocation: a literal metacharacter payload arrives as one inert argv element, not as separate commands', () => {
  withTempDir((dir) => {
    const echoScript = path.join(dir, 'echo-argv.js');
    // Deliberately write MORE than one line so a real command-injection would
    // print a SECOND, distinct output line — the earlier bug this replaces
    // (asserting `!stdout.includes('INJECTED')`) was wrong because the
    // literal payload text below legitimately contains "INJECTED" as
    // ordinary characters; the correct check is that exactly one JSON-shaped
    // ARGV line comes out, matching the original string byte for byte.
    fs.writeFileSync(echoScript, 'console.log("ARGV:" + JSON.stringify(process.argv.slice(2)));\n');

    const payload = 'foo & echo REAL_INJECTION_MARKER & echo bar';
    const r = spawnSync(process.execPath, [echoScript, payload], { encoding: 'utf8', shell: false });

    assert.equal(r.status, 0);
    const lines = r.stdout.trim().split(/\r?\n/).filter(Boolean);
    assert.equal(lines.length, 1, `expected exactly one output line (proving no second command executed), got ${lines.length}: ${JSON.stringify(lines)}`);
    const parsed = JSON.parse(lines[0].replace('ARGV:', ''));
    assert.deepEqual(parsed, [payload], 'the exact original string must arrive as a single argv element, byte for byte, with no shell reinterpretation');
  });
});

// Codex's round-16 review found a real test-integrity bug in the two tests
// below: a bare `return` when `resolveCliJsEntry()` returns `null` (CLI not
// discoverable on PATH) reports as an ordinary PASS in node:test, not a
// skip — confirmed by simulating a restricted PATH where `where.exe
// supabase` fails: the suite still reported `pass 19`/`skipped 0` with
// these two tests having exercised zero real assertions. Fixed by calling
// `t.skip(...)` explicitly so an environment without the CLI installed is
// visibly reported as skipped, not silently counted as a verified pass.

test('resolveCliJsEntry: on Windows, resolves an npm .cmd shim to its real underlying supabase.js entry, not the shim itself', { skip: process.platform !== 'win32' && 'npm .cmd shim format is Windows-specific' }, (t) => {
  const entry = resolveCliJsEntry();
  if (entry === null) {
    t.skip('supabase CLI is not discoverable on PATH in this environment');
    return;
  }
  assert.match(entry, /supabase\.js$/i, `expected resolution to the real .js entry point, got: ${entry}`);
  assert.ok(fs.existsSync(entry), `resolved entry must actually exist on disk: ${entry}`);
});

test('resolveCliJsEntry + direct spawn: full round-trip against the REAL installed supabase CLI proves no shell/cmd.exe boundary remains in the production path', (t) => {
  const entry = resolveCliJsEntry();
  if (entry === null) {
    t.skip('supabase CLI is not discoverable on PATH in this environment — no real CLI to round-trip against');
    return;
  }
  const payload = '%SUPABASE_ROUNDTRIP_PAYLOAD%';
  const r = spawnSync(process.execPath, [entry, payload], {
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, SUPABASE_ROUNDTRIP_PAYLOAD: 'CLOSE" & echo INJECTED & rem "' },
  });
  const combined = (r.stdout || '') + (r.stderr || '');
  assert.ok(!combined.includes('INJECTED'), `the real installed CLI must never see an expanded/executed payload, got: ${combined.slice(0, 300)}`);
  assert.ok(combined.includes(payload) || combined.includes('UnknownSubcommand'), `expected the literal payload string (or an UnknownSubcommand rejection naming it) to appear verbatim, got: ${combined.slice(0, 300)}`);
});

// Deterministic coverage that does NOT depend on a real supabase install:
// builds a synthetic npm-style .cmd shim on disk and a fake node_modules
// layout, then points resolution at it directly. This fixture matches the
// real npm-generated shim's PARSER-RELEVANT launch line exactly (the
// `"%dp0%\...\supabase.js" %*` invocation `resolveJsEntryFromShimPath()`'s
// regex actually matches against) but is NOT a byte-for-byte copy of the
// real shim — it deliberately omits the unrelated `SET PATHEXT=...` line
// from the real shim's ELSE branch, since that line has no bearing on the
// parser under test. This exercises the shim regex and safe-null fallback
// on every host regardless of whether the real CLI happens to be installed
// — closing the gap where the two tests above silently skip and coverage of
// the parsing logic itself would otherwise be zero on such a host.
function writeSyntheticNpmShim(root, { relativeJsEntry = 'node_modules\\supabase\\dist\\supabase.js', jsEntryExists = true } = {}) {
  const shimPath = path.join(root, 'supabase.cmd');
  fs.writeFileSync(
    shimPath,
    [
      '@ECHO off',
      'GOTO start',
      ':find_dp0',
      'SET dp0=%~dp0',
      'EXIT /b',
      ':start',
      'SETLOCAL',
      'CALL :find_dp0',
      '',
      'IF EXIST "%dp0%\\node.exe" (',
      '  SET "_prog=%dp0%\\node.exe"',
      ') ELSE (',
      '  SET "_prog=node"',
      ')',
      '',
      `endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\${relativeJsEntry}" %*`,
      '',
    ].join('\r\n'),
    'utf8'
  );
  if (jsEntryExists) {
    const jsEntryPath = path.join(root, relativeJsEntry);
    fs.mkdirSync(path.dirname(jsEntryPath), { recursive: true });
    fs.writeFileSync(jsEntryPath, 'console.log("synthetic supabase.js");\n', 'utf8');
  }
  return shimPath;
}

test('resolveJsEntryFromShimPath: parses the REAL exported shim-parsing function against a synthetic npm .cmd shim, resolving to an existing file (no real CLI required)', { skip: process.platform !== 'win32' && 'npm .cmd shim format is Windows-specific' }, () => {
  withTempDir((dir) => {
    const shimPath = writeSyntheticNpmShim(dir);
    const resolved = resolveJsEntryFromShimPath(shimPath);
    assert.notEqual(resolved, null, 'the production shim-parsing function must successfully match this synthetic fixture, which mirrors the real npm-generated shim template\'s parser-relevant launch line (not a byte-for-byte copy — see writeSyntheticNpmShim() comment)');
    assert.match(resolved, /supabase\.js$/i);
    assert.ok(fs.existsSync(resolved), 'the resolved path must point at a real file on disk');
  });
});

test('resolveJsEntryFromShimPath: fails closed (returns null) when the shim references a JS entry that does not exist on disk', { skip: process.platform !== 'win32' && 'npm .cmd shim format is Windows-specific' }, () => {
  withTempDir((dir) => {
    const shimPath = writeSyntheticNpmShim(dir, { jsEntryExists: false });
    const resolved = resolveJsEntryFromShimPath(shimPath);
    assert.equal(resolved, null, 'a shim whose target JS file is missing must resolve to null, not a path to a nonexistent file that a later spawn would fail on unpredictably');
  });
});

test('resolveJsEntryFromShimPath: fails closed (returns null) when the shim text does not match the expected npm template at all', { skip: process.platform !== 'win32' && 'npm .cmd shim format is Windows-specific' }, () => {
  withTempDir((dir) => {
    const shimPath = path.join(dir, 'supabase.cmd');
    fs.writeFileSync(shimPath, '@ECHO off\r\necho this is not an npm-style shim\r\n', 'utf8');
    const resolved = resolveJsEntryFromShimPath(shimPath);
    assert.equal(resolved, null, 'an unrecognized shim format must fail closed to null, never fall back to treating the shim itself as directly executable via a shell');
  });
});

test('resolveJsEntryFromShimPath: a resolved .exe path is returned directly without text parsing', () => {
  const resolved = resolveJsEntryFromShimPath('C:\\some\\path\\supabase.exe');
  assert.equal(resolved, 'C:\\some\\path\\supabase.exe');
});

test('resolveJsEntryFromShimPath: a null/empty shim path resolves to null', () => {
  assert.equal(resolveJsEntryFromShimPath(null), null);
  assert.equal(resolveJsEntryFromShimPath(''), null);
});

// --- validateTargets ---------------------------------------------------------

function withFixtureTestsDir(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-isolated-validate-'));
  const testsDir = path.join(root, 'supabase', 'tests');
  fs.mkdirSync(testsDir, { recursive: true });
  fs.writeFileSync(path.join(testsDir, 'phase_x.test.sql'), '-- fixture\n');
  fs.mkdirSync(path.join(root, 'supabase', 'migrations'), { recursive: true });
  try {
    return fn(root, testsDir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('validateTargets rejects any option-like token', () => {
  withFixtureTestsDir((root, testsDir) => {
    assert.throws(() => validateTargets(['--linked'], testsDir), /option-like argument/);
    assert.throws(() => validateTargets(['--db-url=postgres://x'], testsDir), /option-like argument/);
  });
});

test('validateTargets rejects a path outside supabase/tests (e.g. supabase/migrations)', () => {
  withFixtureTestsDir((root, testsDir) => {
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    assert.throws(() => validateTargets([migrationsDir], testsDir), /outside supabase\/tests/);
  });
});

test('validateTargets rejects a nonexistent path', () => {
  withFixtureTestsDir((root, testsDir) => {
    assert.throws(() => validateTargets([path.join(testsDir, 'does_not_exist.test.sql')], testsDir), /does not exist/);
  });
});

test('validateTargets rejects a shell-metacharacter payload because it does not exist as a real path', () => {
  withFixtureTestsDir((root, testsDir) => {
    assert.throws(() => validateTargets(['foo & echo INJECTED & echo bar'], testsDir), /does not exist/);
  });
});

test('validateTargets accepts a real file inside supabase/tests', () => {
  withFixtureTestsDir((root, testsDir) => {
    const real = validateTargets([path.join(testsDir, 'phase_x.test.sql')], testsDir);
    assert.equal(real.length, 1);
    assert.equal(fs.realpathSync(real[0]), fs.realpathSync(path.join(testsDir, 'phase_x.test.sql')));
  });
});

test('validateTargets defaults to the whole tests dir when no args given', () => {
  withFixtureTestsDir((root, testsDir) => {
    const real = validateTargets([], testsDir);
    assert.equal(real.length, 1);
    assert.equal(fs.realpathSync(real[0]), fs.realpathSync(testsDir));
  });
});

// --- runLifecycle: deterministic fake-runner coverage of the exact failure
// modes Codex's round-13 review asked for -------------------------------------

function fakeRunSupabase(script) {
  // `script` maps a subcommand ('start' | 'test' | 'stop') to a canned
  // { status } result, or a function(args) => { status } for cases that
  // need to see the exact args (e.g. to assert on invocation order).
  const calls = [];
  const fn = (args) => {
    calls.push(args);
    const key = args[0];
    const outcome = typeof script[key] === 'function' ? script[key](args) : script[key];
    return outcome || { status: 0 };
  };
  fn.calls = calls;
  return fn;
}

function makePrepare({ targets = ['/tmp/fake/target.test.sql'], portsToCheck = [12345], fails = false } = {}) {
  return async () => {
    if (fails) throw new Error('simulated pre-start setup failure');
    return { targets, portsToCheck };
  };
}

test('runLifecycle: happy path — start ok, tests pass, stop ok, dir removed, exit 0', async () => {
  const removed = [];
  const runSupabase = fakeRunSupabase({ start: { status: 0 }, test: { status: 0 }, stop: { status: 0 } });
  const result = await runLifecycle({
    tmpRoot: '/tmp/fake-root',
    prepare: makePrepare(),
    runSupabase,
    portInUse: async () => false,
    projectId: 'fake_project',
    portOffset: 1000,
    removeDir: (dir) => removed.push(dir),
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.message, null);
  assert.deepEqual(removed, ['/tmp/fake-root'], 'temp dir must be removed after a clean successful run');
  assert.deepEqual(runSupabase.calls.map((c) => c[0]), ['start', 'test', 'stop']);
});

test('runLifecycle: pre-start setup failure — prepare() throws, no start attempted, dir removed immediately, exit 1', async () => {
  const removed = [];
  const runSupabase = fakeRunSupabase({});
  const result = await runLifecycle({
    tmpRoot: '/tmp/fake-root',
    prepare: makePrepare({ fails: true }),
    runSupabase,
    portInUse: async () => false,
    projectId: 'fake_project',
    portOffset: 1000,
    removeDir: (dir) => removed.push(dir),
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.message, /setup failed before any instance was started/);
  assert.deepEqual(runSupabase.calls, [], 'supabase must never be invoked if prepare() failed');
  assert.deepEqual(removed, ['/tmp/fake-root'], 'a pre-start failure must still clean up the temp dir since nothing could have been started');
});

test('runLifecycle: port preflight collision — no start attempted, dir removed, exit 1', async () => {
  const removed = [];
  const runSupabase = fakeRunSupabase({});
  const result = await runLifecycle({
    tmpRoot: '/tmp/fake-root',
    prepare: makePrepare({ portsToCheck: [12345] }),
    runSupabase,
    portInUse: async (port) => port === 12345,
    projectId: 'fake_project',
    portOffset: 1000,
    removeDir: (dir) => removed.push(dir),
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.message, /already bound/);
  assert.deepEqual(runSupabase.calls, [], 'supabase must never be invoked if a required port is already bound');
  assert.deepEqual(removed, ['/tmp/fake-root']);
});

test('runLifecycle: start fails after possibly creating partial resources — teardown IS still attempted (the round-13 MAJOR finding)', async () => {
  const removed = [];
  const runSupabase = fakeRunSupabase({ start: { status: 1 }, stop: { status: 0 } });
  const result = await runLifecycle({
    tmpRoot: '/tmp/fake-root',
    prepare: makePrepare(),
    runSupabase,
    portInUse: async () => false,
    projectId: 'fake_project',
    portOffset: 1000,
    removeDir: (dir) => removed.push(dir),
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.message, /supabase start failed/);
  assert.deepEqual(runSupabase.calls.map((c) => c[0]), ['start', 'stop'], 'stop MUST run even though start itself failed, in case start created partial resources before failing');
  assert.deepEqual(removed, ['/tmp/fake-root'], 'a successful teardown after a failed start must still remove the temp dir');
});

test('runLifecycle: suite fails but teardown succeeds — exit reflects the SUITE failure, dir removed', async () => {
  const removed = [];
  const runSupabase = fakeRunSupabase({ start: { status: 0 }, test: { status: 1 }, stop: { status: 0 } });
  const result = await runLifecycle({
    tmpRoot: '/tmp/fake-root',
    prepare: makePrepare(),
    runSupabase,
    portInUse: async () => false,
    projectId: 'fake_project',
    portOffset: 1000,
    removeDir: (dir) => removed.push(dir),
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.message, null, 'a suite failure with clean teardown is reported via exit code alone, not a runner-level error message');
  assert.deepEqual(runSupabase.calls.map((c) => c[0]), ['start', 'test', 'stop']);
  assert.deepEqual(removed, ['/tmp/fake-root']);
});

test('runLifecycle: suite PASSES but teardown FAILS — must NOT report success, dir must NOT be deleted (the round-13 false-success MAJOR finding)', async () => {
  const removed = [];
  const runSupabase = fakeRunSupabase({ start: { status: 0 }, test: { status: 0 }, stop: { status: 1 } });
  const result = await runLifecycle({
    tmpRoot: '/tmp/fake-root',
    prepare: makePrepare(),
    runSupabase,
    portInUse: async () => false,
    projectId: 'fake_project',
    portOffset: 1000,
    removeDir: (dir) => removed.push(dir),
  });
  assert.equal(result.exitCode, 1, 'teardown failure must force a nonzero exit even though the suite itself passed');
  assert.match(result.message, /teardown \(.supabase stop --no-backup.\) exited 1/);
  assert.match(result.message, /Workdir NOT deleted/);
  assert.deepEqual(removed, [], 'the temp workdir must be preserved as a manual-recovery reference when teardown fails, never silently deleted');
});

test('runLifecycle: start AND stop both fail — exit 1, dir preserved, message reflects teardown (the more actionable failure)', async () => {
  const removed = [];
  const runSupabase = fakeRunSupabase({ start: { status: 1 }, stop: { status: 1 } });
  const result = await runLifecycle({
    tmpRoot: '/tmp/fake-root',
    prepare: makePrepare(),
    runSupabase,
    portInUse: async () => false,
    projectId: 'fake_project',
    portOffset: 1000,
    removeDir: (dir) => removed.push(dir),
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.message, /teardown/);
  assert.deepEqual(removed, []);
});
