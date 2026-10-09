'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(__dirname, 'harness-hooks.js');
const hooks = require('./harness-hooks.js');
const fixtureRoots = [];

// A throwaway project root that looks like a real one to resolveProjectRoot:
// it contains `.claude/settings.json`.
function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hooks-'));
  fixtureRoots.push(root);
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude', 'settings.json'), '{}\n');
  return root;
}

test.after(() => {
  for (const root of fixtureRoots) fs.rmSync(root, { recursive: true, force: true });
});

// Runs the CLI the way Claude Code does: a command, JSON on stdin, cwd = wherever
// the session happens to be, and CLAUDE_PROJECT_DIR only when the caller sets it.
function run(command, { cwd, stdin = '', env = {} } = {}) {
  const childEnv = { ...process.env, ...env };
  if (!('CLAUDE_PROJECT_DIR' in env)) delete childEnv.CLAUDE_PROJECT_DIR;
  return spawnSync(process.execPath, [scriptPath, command], {
    cwd,
    input: stdin,
    encoding: 'utf8',
    env: childEnv,
  });
}

function queueLines(root) {
  const queue = path.join(root, '.claude', 'review-queue.txt');
  if (!fs.existsSync(queue)) return null;
  return fs.readFileSync(queue, 'utf8').split(/\r?\n/).filter(Boolean);
}

// ---------------------------------------------------------------- resolveProjectRoot

test('resolveProjectRoot: CLAUDE_PROJECT_DIR wins when it exists', () => {
  const root = makeRoot();
  assert.equal(hooks.resolveProjectRoot({ CLAUDE_PROJECT_DIR: root }, os.tmpdir()), root);
});

test('resolveProjectRoot: walks up from a subdirectory to the folder holding .claude/settings.json', () => {
  const root = makeRoot();
  const sub = path.join(root, 'app', 'src');
  fs.mkdirSync(sub, { recursive: true });
  assert.equal(hooks.resolveProjectRoot({}, sub), root);
});

test('resolveProjectRoot: inside a git repo, anchors on the repo top-level even when a subdirectory has its own .claude/settings.json (this repo has app/.claude/settings.json)', () => {
  const root = makeRoot();
  spawnSync('git', ['init', '-q'], { cwd: root });
  const nested = path.join(root, 'app');
  fs.mkdirSync(path.join(nested, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(nested, '.claude', 'settings.json'), '{}\n');
  const deeper = path.join(nested, 'src');
  fs.mkdirSync(deeper, { recursive: true });
  // .native on both sides: git reports the long path, os.tmpdir() may be a Windows 8.3 short name.
  assert.equal(fs.realpathSync.native(hooks.resolveProjectRoot({}, deeper)), fs.realpathSync.native(root));
});

test('queue-edit: from app/ (which has its own .claude/) with no CLAUDE_PROJECT_DIR, writes the ROOT queue, never app/.claude/review-queue.txt', () => {
  const root = makeRoot();
  spawnSync('git', ['init', '-q'], { cwd: root });
  const app = path.join(root, 'app');
  fs.mkdirSync(path.join(app, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(app, '.claude', 'settings.json'), '{}\n');
  const stdin = JSON.stringify({ tool_input: { file_path: path.join(root, 'app', 'src', 'x.ts') } });
  const result = run('queue-edit', { cwd: app, stdin });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(queueLines(root), ['app/src/x.ts']);
  assert.equal(fs.existsSync(path.join(app, '.claude', 'review-queue.txt')), false);
});

test('resolveProjectRoot: falls back to cwd when no project marker exists anywhere above it', () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-bare-'));
  fixtureRoots.push(bare);
  assert.equal(hooks.resolveProjectRoot({}, bare), bare);
});

// ---------------------------------------------------------------- toRepoRelative

test('toRepoRelative: relative paths pass through, backslashes normalized, leading ./ stripped', () => {
  const root = makeRoot();
  assert.equal(hooks.toRepoRelative('app/src/a.ts', root), 'app/src/a.ts');
  assert.equal(hooks.toRepoRelative('app\\src\\a.ts', root), 'app/src/a.ts');
  assert.equal(hooks.toRepoRelative('./docs/x.md', root), 'docs/x.md');
});

test('toRepoRelative: absolute paths inside the root become repo-relative (case-insensitive prefix on case-insensitive filesystems)', () => {
  const root = makeRoot();
  assert.equal(hooks.toRepoRelative(path.join(root, 'supabase', 'm.sql'), root), 'supabase/m.sql');
  assert.equal(
    hooks.toRepoRelative(path.join(root, 'docs', 'a.md').toUpperCase().replace(/\.MD$/, '.md'), root, { caseInsensitive: true }),
    'docs/a.md'.toUpperCase().replace(/\.MD$/, '.md'),
  );
});

test('toRepoRelative: on a case-sensitive filesystem (Linux), a directory differing from the root only by case is NOT inside the root', () => {
  assert.equal(hooks.toRepoRelative('/tmp/REVIEW-ROOT/other.txt', '/tmp/review-root', { caseInsensitive: false }), null);
  assert.equal(hooks.toRepoRelative('/tmp/review-root/other.txt', '/tmp/review-root', { caseInsensitive: false }), 'other.txt');
});

// Independent oracle: write a lowercase file, ask whether an uppercase spelling exists.
function probeCaseInsensitive(dir) {
  const probe = fs.mkdtempSync(path.join(dir, 'case-oracle-'));
  fs.writeFileSync(path.join(probe, 'oracle'), 'x');
  const insensitive = fs.existsSync(path.join(probe, 'ORACLE'));
  fs.rmSync(probe, { recursive: true, force: true });
  return insensitive;
}

test('isCaseInsensitiveFs: detects the actual filesystem, not the OS (case-sensitive APFS exists on macOS)', () => {
  const root = makeRoot();
  assert.equal(hooks.isCaseInsensitiveFs(root), probeCaseInsensitive(root));
});

test('toRepoRelative: by default, case folding follows the root filesystem (a case-only sibling is outside on case-sensitive volumes)', () => {
  const root = makeRoot();
  const sibling = path.join(path.dirname(root), path.basename(root).toUpperCase(), 'other.txt');
  const expected = probeCaseInsensitive(root) ? 'other.txt' : null;
  assert.equal(hooks.toRepoRelative(sibling, root), expected);
});

test('toRepoRelative: embedded .. segments are resolved before the containment check (relative and absolute)', () => {
  const root = makeRoot();
  assert.equal(hooks.toRepoRelative('a/../../outside.txt', root), null);
  assert.equal(hooks.toRepoRelative('a/../b.txt', root), 'b.txt');
  assert.equal(hooks.toRepoRelative(`${root}/a/../../outside.txt`, root), null);
  assert.equal(hooks.toRepoRelative(`${root}/a/../b.txt`, root), 'b.txt');
  assert.equal(hooks.toRepoRelative('app\\..\\..\\outside.txt', root), null);
});

test('toRepoRelative: absolute paths outside the root, and paths that escape via .., are never queued', () => {
  const root = makeRoot();
  assert.equal(hooks.toRepoRelative('/etc/hosts', root), null);
  assert.equal(hooks.toRepoRelative('C:\\Users\\someone\\else\\f.txt', root), null);
  assert.equal(hooks.toRepoRelative('../outside.md', root), null);
  assert.equal(hooks.toRepoRelative('', root), null);
});

test(
  'toRepoRelative: a symlinked spelling of the root (macOS /var -> /private/var, /tmp -> /private/tmp) still resolves inside the root, in either direction',
  { skip: process.platform === 'win32' && 'symlink creation needs privileges on Windows' },
  () => {
    const real = fs.realpathSync(makeRoot());
    const holder = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-alias-'));
    fixtureRoots.push(holder);
    const alias = path.join(holder, 'alias');
    fs.symlinkSync(real, alias);
    fs.mkdirSync(path.join(real, 'app'), { recursive: true });

    // root spelled as the real path, file spelled through the symlink
    assert.equal(hooks.toRepoRelative(path.join(alias, 'app', 'x.ts'), real), 'app/x.ts');
    // root spelled through the symlink, file spelled as the real path
    assert.equal(hooks.toRepoRelative(path.join(real, 'app', 'x.ts'), alias), 'app/x.ts');
    // a file that does not exist yet (Write creating a new file) resolves the same way
    assert.equal(hooks.toRepoRelative(path.join(alias, 'app', 'new-file.ts'), real), 'app/new-file.ts');
    // a symlinked spelling of an outside path is still outside
    assert.equal(hooks.toRepoRelative(path.join(alias, '..', 'elsewhere.txt'), real), null);
  },
);

test(
  'toRepoRelative: a symlink inside the root that points OUTSIDE it does not make the target look inside (resolved containment must also hold)',
  { skip: process.platform === 'win32' && 'symlink creation needs privileges on Windows' },
  () => {
    const holder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-escape-')));
    fixtureRoots.push(holder);
    const root = path.join(holder, 'repo');
    fs.mkdirSync(root);
    fs.mkdirSync(path.join(holder, 'outside'));
    fs.symlinkSync('../outside', path.join(root, 'link'));
    assert.equal(hooks.toRepoRelative(path.join(root, 'link', 'x.txt'), root), null);
    assert.equal(hooks.toRepoRelative('link/x.txt', root), null);
    // a symlink that stays inside the root is still fine
    fs.mkdirSync(path.join(root, 'real'));
    fs.symlinkSync('real', path.join(root, 'inner'));
    assert.equal(hooks.toRepoRelative(path.join(root, 'inner', 'y.txt'), root), 'inner/y.txt');
  },
);

// The OS can spell one directory two ways: Windows 8.3 short names (RUNNER~1 vs
// runneradmin, seen on the windows-latest CI runner) or, on case-insensitive volumes,
// a different letter case. Containment must resolve both sides to the OS's canonical
// spelling, not just follow symlinks, or the edit is silently not queued.
test(
  'toRepoRelative: a non-canonical spelling of the root (8.3 short name, or different case) still resolves inside it',
  { skip: !hooks.isCaseInsensitiveFs(os.tmpdir()) && 'needs a case-insensitive volume to create a second spelling' },
  () => {
    const root = fs.realpathSync.native(makeRoot());
    fs.mkdirSync(path.join(root, 'docs'));
    const respelled = path.join(path.dirname(root), path.basename(root).toUpperCase(), 'docs', 'a.md');
    assert.equal(hooks.toRepoRelative(respelled, root, { caseInsensitive: false }), 'docs/a.md');
  },
);

test('toRepoRelative: a sibling directory that merely shares the root as a name prefix is not inside the root', () => {
  const root = makeRoot();
  assert.equal(hooks.toRepoRelative(`${root}-other/file.md`, root), null);
});

// ---------------------------------------------------------------- queue-edit (CLI)

test('queue-edit: creates the queue file and appends the repo-relative path', () => {
  const root = makeRoot();
  const stdin = JSON.stringify({ tool_input: { file_path: path.join(root, 'app', 'src', 'a.ts') } });
  const result = run('queue-edit', { cwd: root, stdin, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(queueLines(root), ['app/src/a.ts']);
});

test('queue-edit: is idempotent, and dedupes against existing CRLF-terminated lines from a Windows-written queue', () => {
  const root = makeRoot();
  fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), 'docs/a.md\r\napp/b.ts\r\n');
  const stdin = JSON.stringify({ tool_input: { file_path: 'docs/a.md' } });
  run('queue-edit', { cwd: root, stdin, env: { CLAUDE_PROJECT_DIR: root } });
  run('queue-edit', { cwd: root, stdin, env: { CLAUDE_PROJECT_DIR: root } });
  assert.deepEqual(queueLines(root), ['docs/a.md', 'app/b.ts']);
});

test('queue-edit: appends a new path after an existing queue that lacks a trailing newline', () => {
  const root = makeRoot();
  fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), 'docs/a.md');
  const stdin = JSON.stringify({ tool_input: { file_path: 'docs/b.md' } });
  run('queue-edit', { cwd: root, stdin, env: { CLAUDE_PROJECT_DIR: root } });
  assert.deepEqual(queueLines(root), ['docs/a.md', 'docs/b.md']);
});

test('queue-edit: from a subdirectory cwd with no CLAUDE_PROJECT_DIR, still queues against the real project root', () => {
  const root = makeRoot();
  const sub = path.join(root, 'app');
  fs.mkdirSync(sub, { recursive: true });
  const stdin = JSON.stringify({ tool_input: { file_path: path.join(root, 'app', 'x.ts') } });
  const result = run('queue-edit', { cwd: sub, stdin });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(queueLines(root), ['app/x.ts']);
  assert.equal(fs.existsSync(path.join(sub, '.claude')), false, 'must not create a stray .claude/ in the subdirectory');
});

test('queue-edit: a NotebookEdit payload (tool_input.notebook_path) is queued', () => {
  const root = makeRoot();
  const stdin = JSON.stringify({ tool_name: 'NotebookEdit', tool_input: { notebook_path: path.join(root, 'notebooks', 'a.ipynb') } });
  const result = run('queue-edit', { cwd: root, stdin, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(queueLines(root), ['notebooks/a.ipynb']);
});

test('queue-edit: the per-task claims file (.claude/review-claims.md, gitignored packet input) is never queued', () => {
  const root = makeRoot();
  const stdin = JSON.stringify({ tool_input: { file_path: path.join(root, '.claude', 'review-claims.md') } });
  const result = run('queue-edit', { cwd: root, stdin, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(queueLines(root), null);
});

test('queue-edit: a payload with no file_path (e.g. a non-file tool) is a silent no-op', () => {
  const root = makeRoot();
  const result = run('queue-edit', { cwd: root, stdin: JSON.stringify({ tool_input: {} }), env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0);
  assert.equal(queueLines(root), null);
});

test('queue-edit: a file outside the project is not queued and does not fail', () => {
  const root = makeRoot();
  const result = run('queue-edit', { cwd: root, stdin: JSON.stringify({ tool_input: { file_path: '/etc/hosts' } }), env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0);
  assert.equal(queueLines(root), null);
});

test('queue-edit: an edit inside a git worktree of the project queues into THAT worktree (CLAUDE_PROJECT_DIR stays at the main checkout; hook input cwd follows the worktree)', () => {
  const { root, git } = makeGitRoot();
  const wt = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-wt-')), 'wt');
  fixtureRoots.push(path.dirname(wt));
  assert.equal(git('worktree', 'add', '-q', wt).status, 0);
  const stdin = JSON.stringify({ cwd: wt, tool_input: { file_path: path.join(wt, 'app', 'x.ts') } });
  const result = run('queue-edit', { cwd: wt, stdin, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(queueLines(wt), ['app/x.ts']);
  assert.equal(queueLines(root), null, 'must not queue a worktree path into the main checkout');
});

test('queue-edit: a worktree nested inside the main checkout (.claude/worktrees/<name>) queues into the worktree even when the hook cwd is still the main checkout', () => {
  const { root, git } = makeGitRoot();
  const wt = path.join(root, '.claude', 'worktrees', 'feature');
  assert.equal(git('worktree', 'add', '-q', wt).status, 0);
  const stdin = JSON.stringify({ cwd: root, tool_input: { file_path: path.join(wt, 'docs', 'new.md') } });
  const result = run('queue-edit', { cwd: root, stdin, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(queueLines(wt), ['docs/new.md']);
  assert.equal(queueLines(root), null);
});

test('queue-edit: a hook cwd inside an UNRELATED git repo is ignored; the project file is still queued in the project, and nothing is written to the foreign repo', () => {
  const { root } = makeGitRoot();
  const foreign = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-foreign-'));
  fixtureRoots.push(foreign);
  spawnSync('git', ['init', '-q'], { cwd: foreign });
  const stdin = JSON.stringify({ cwd: foreign, tool_input: { file_path: path.join(root, 'docs', 'a.md') } });
  const result = run('queue-edit', { cwd: foreign, stdin, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(queueLines(root), ['docs/a.md']);
  assert.equal(fs.existsSync(path.join(foreign, '.claude')), false);
});

test('queue-edit: invalid JSON fails LOUDLY (non-zero exit + stderr), never a silent skip that leaves edits unqueued', () => {
  const root = makeRoot();
  const result = run('queue-edit', { cwd: root, stdin: '{not json', env: { CLAUDE_PROJECT_DIR: root } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /harness-hooks/);
});

// ---------------------------------------------------------------- stop: review queue

test('stop-review-queue: silent when the queue is missing or holds only blank lines', () => {
  const root = makeRoot();
  assert.equal(run('stop-review-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } }).stdout, '');
  fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), '\n  \r\n');
  assert.equal(run('stop-review-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } }).stdout, '');
});

test('stop-review-queue: reminds when the pending queue is in the worktree Claude is working in (hook cwd), not the main checkout', () => {
  const { root, git } = makeGitRoot();
  const wt = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-wt-')), 'wt');
  fixtureRoots.push(path.dirname(wt));
  assert.equal(git('worktree', 'add', '-q', wt).status, 0);
  fs.mkdirSync(path.join(wt, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(wt, '.claude', 'review-queue.txt'), 'docs/a.md\n');
  const result = run('stop-review-queue', { cwd: wt, stdin: JSON.stringify({ cwd: wt }), env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).systemMessage, /Reviewers needed before committing/);
});

test('stop-review-queue: non-empty stdin that is not JSON fails loudly', () => {
  const root = makeRoot();
  const result = run('stop-review-queue', { cwd: root, stdin: '{not json', env: { CLAUDE_PROJECT_DIR: root } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /harness-hooks/);
});

test('stop-review-queue: emits the reviewer reminder as compact systemMessage JSON when files are pending', () => {
  const root = makeRoot();
  fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), 'docs/a.md\n');
  const result = run('stop-review-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.match(payload.systemMessage, /Reviewers needed before committing/);
  assert.match(payload.systemMessage, /\.claude\/review-queue\.txt/);
  assert.equal(result.stdout.trim().includes('\n'), false, 'compact single-line JSON');
});

// ---------------------------------------------------------------- stop: stale-info scan

test('stop-stale-scan: due when the scan file is missing', () => {
  const root = makeRoot();
  const payload = JSON.parse(run('stop-stale-scan', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } }).stdout);
  assert.match(payload.systemMessage, /Stale-information scan is due or missing/);
});

test('stop-stale-scan: silent when fresh, due at the 30-day boundary', () => {
  const root = makeRoot();
  const scan = path.join(root, '.planning', 'stale-info-scan-latest.md');
  fs.mkdirSync(path.dirname(scan), { recursive: true });
  fs.writeFileSync(scan, 'scan\n');

  const now = Date.now();
  fs.utimesSync(scan, new Date(now - 29 * 86400000), new Date(now - 29 * 86400000));
  assert.equal(hooks.staleScanMessage(root, now), null);

  fs.utimesSync(scan, new Date(now - 30 * 86400000), new Date(now - 30 * 86400000));
  assert.match(hooks.staleScanMessage(root, now).systemMessage, /Stale-information scan is due or missing/);
});

// ---------------------------------------------------------------- session-start / pre-compact

test('session-start: without bd on PATH, falls back to the execution-state pointer message', () => {
  const root = makeRoot();
  fs.mkdirSync(path.join(root, '.beads', 'context'), { recursive: true });
  fs.writeFileSync(path.join(root, '.beads', 'context', 'execution-state.md'), '# state\n');
  const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-nobin-'));
  fixtureRoots.push(emptyBin);
  const result = run('session-start', { cwd: root, env: { CLAUDE_PROJECT_DIR: root, PATH: emptyBin } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).systemMessage, /bd CLI not found\. Startup context is docs\/context-router\.md/);
});

test('pre-compact: without bd on PATH, falls back to the recovery pointer message', () => {
  const root = makeRoot();
  fs.mkdirSync(path.join(root, '.beads', 'context'), { recursive: true });
  fs.writeFileSync(path.join(root, '.beads', 'context', 'execution-state.md'), '# state\n');
  const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-nobin-'));
  fixtureRoots.push(emptyBin);
  const result = run('pre-compact', { cwd: root, env: { CLAUDE_PROJECT_DIR: root, PATH: emptyBin } });
  assert.match(JSON.parse(result.stdout).systemMessage, /For recovery, read \.beads\/context\/execution-state\.md/);
});

test('session-start: without bd AND without execution-state.md there is no output at all', () => {
  const root = makeRoot();
  const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-nobin-'));
  fixtureRoots.push(emptyBin);
  const result = run('session-start', { cwd: root, env: { CLAUDE_PROJECT_DIR: root, PATH: emptyBin } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test(
  'session-start / pre-compact: when bd IS on PATH, runs `bd prime` (with --work-type recovery for pre-compact) and emits no fallback message',
  { skip: process.platform === 'win32' && 'fake bd is a POSIX sh script' },
  () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, '.beads', 'context'), { recursive: true });
    fs.writeFileSync(path.join(root, '.beads', 'context', 'execution-state.md'), '# state\n');
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-bd-'));
    fixtureRoots.push(bin);
    fs.writeFileSync(path.join(bin, 'bd'), '#!/bin/sh\necho "BD-ARGS:$*"\n', { mode: 0o755 });
    const env = { CLAUDE_PROJECT_DIR: root, PATH: `${bin}${path.delimiter}${process.env.PATH}` };

    const start = run('session-start', { cwd: root, env });
    assert.match(start.stdout, /BD-ARGS:prime\s*$/m);
    assert.doesNotMatch(start.stdout, /systemMessage/);

    const compact = run('pre-compact', { cwd: root, env });
    assert.match(compact.stdout, /BD-ARGS:prime --work-type recovery/);
    assert.doesNotMatch(compact.stdout, /systemMessage/);
  },
);

test(
  'session-start / pre-compact: when bd is present but FAILS, still emits the fallback pointer, and bd never reads the hook stdin',
  { skip: process.platform === 'win32' && 'fake bd is a POSIX sh script' },
  () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, '.beads', 'context'), { recursive: true });
    fs.writeFileSync(path.join(root, '.beads', 'context', 'execution-state.md'), '# state\n');
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-bd-'));
    fixtureRoots.push(bin);
    fs.writeFileSync(path.join(bin, 'bd'), '#!/bin/sh\nread line\necho "GOT:$line"\nexit 3\n', { mode: 0o755 });
    const env = { CLAUDE_PROJECT_DIR: root, PATH: `${bin}${path.delimiter}${process.env.PATH}` };

    for (const [command, pattern] of [
      ['session-start', /Startup context is docs\/context-router\.md/],
      ['pre-compact', /For recovery, read \.beads\/context\/execution-state\.md/],
    ]) {
      const result = run(command, { cwd: root, env, stdin: '{"hook_event_name":"x"}\n' });
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(result.stdout, /GOT:\{/, 'bd must not consume the hook payload on stdin');
      const message = JSON.parse(result.stdout.trim().split('\n').pop()).systemMessage;
      assert.match(message, /bd prime failed \(exit 3\)/);
      assert.match(message, pattern);
    }
  },
);

// ---------------------------------------------------------------- stage-queue

function makeGitRoot() {
  const root = makeRoot();
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
  return { root, git };
}

test('stage-queue: glob characters and pathspec magic in a queued name are literal, never widening the staged scope', () => {
  const { root, git } = makeGitRoot();
  fs.writeFileSync(path.join(root, 'one.txt'), '1\n');
  fs.writeFileSync(path.join(root, 'two.txt'), '2\n');
  for (const entry of ['*.txt', '?ne.txt', ':(glob)*.txt', ':(top)one.txt']) {
    fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), `${entry}\n`);
    const result = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
    assert.notEqual(result.status, 0, `${entry} must not match other files`);
    assert.equal(git('diff', '--cached', '--name-only').stdout, '', `${entry} staged nothing`);
  }
});

test('stage-queue: stages exactly the queued paths (adds, edits, deletions), tolerating CRLF and blank lines, and nothing else', () => {
  const { root, git } = makeGitRoot();
  fs.writeFileSync(path.join(root, 'gone.txt'), 'x\n');
  git('add', 'gone.txt');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'g');
  fs.rmSync(path.join(root, 'gone.txt'));
  fs.writeFileSync(path.join(root, 'a.txt'), 'a\n');
  fs.writeFileSync(path.join(root, 'unqueued.txt'), 'u\n');
  fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), 'a.txt\r\n\r\n  \r\ngone.txt\r\n');

  const result = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  const staged = git('diff', '--cached', '--name-status').stdout.trim().split('\n').sort();
  assert.deepEqual(staged, ['A\ta.txt', 'D\tgone.txt']);
});

// The queue is a line format that the pre-commit gate reads with .trim(), so a name with
// leading/trailing whitespace (or a line break) cannot be represented. It must fail
// loudly, never be silently rewritten into a different path.
test(
  'stage-queue: a queued name with leading or trailing whitespace fails loudly and stages nothing (it would otherwise stage a DIFFERENT file)',
  { skip: process.platform === 'win32' && 'Windows cannot create names with trailing spaces' },
  () => {
    const { root, git } = makeGitRoot();
    fs.writeFileSync(path.join(root, 'spaced.txt '), 'a\n');
    fs.writeFileSync(path.join(root, ' spaced.txt'), 'b\n');
    fs.writeFileSync(path.join(root, 'spaced.txt'), 'c\n');
    for (const entry of ['spaced.txt ', ' spaced.txt', '\tspaced.txt']) {
      fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), `${entry}\n`);
      const result = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
      assert.notEqual(result.status, 0, JSON.stringify(entry));
      assert.match(result.stderr, /whitespace/);
      assert.equal(git('diff', '--cached', '--name-only').stdout, '', `${JSON.stringify(entry)} staged nothing`);
    }
  },
);

test('queue-edit: a path the queue format cannot represent (leading/trailing whitespace, line break) fails loudly and is not queued', () => {
  const root = makeRoot();
  for (const name of ['docs/a.md ', ' docs/a.md', 'docs/a\nb.md', 'docs/a\rb.md']) {
    const stdin = JSON.stringify({ tool_input: { file_path: path.join(root, name) } });
    const result = run('queue-edit', { cwd: root, stdin, env: { CLAUDE_PROJECT_DIR: root } });
    assert.notEqual(result.status, 0, JSON.stringify(name));
    assert.match(result.stderr, /cannot be represented in the review queue/);
    assert.equal(queueLines(root), null);
  }
});

// A deletion already staged with `git rm` leaves the path in neither the working tree nor
// the index, so `git add -A -- <path>` rejects it ("pathspec did not match"). Re-running
// stage-queue in a later review round must accept that state, not fail the whole batch.
test('stage-queue: a deletion already staged with git rm is accepted, alongside other queued paths', () => {
  const { root, git } = makeGitRoot();
  fs.writeFileSync(path.join(root, 'gone.txt'), 'x\n');
  git('add', 'gone.txt');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'g');
  git('rm', '-q', 'gone.txt');
  fs.writeFileSync(path.join(root, 'a.txt'), 'a\n');
  fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), 'gone.txt\na.txt\n');

  const result = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  const staged = git('diff', '--cached', '--name-status').stdout.trim().split('\n').sort();
  assert.deepEqual(staged, ['A\ta.txt', 'D\tgone.txt']);
});

// fs.existsSync follows symlinks, so a dangling symlink reads as absent. A staged deletion
// later replaced by a dangling symlink must be staged as the symlink, not skipped as an
// already-staged deletion (2026-09-27 Codex finding).
test(
  'stage-queue: a dangling symlink that replaces an already-staged deletion is staged, not skipped',
  { skip: process.platform === 'win32' && 'creating symlinks needs elevated rights on Windows' },
  () => {
    const { root, git } = makeGitRoot();
    fs.writeFileSync(path.join(root, 'gone.txt'), 'x\n');
    git('add', 'gone.txt');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'g');
    git('rm', '-q', 'gone.txt');
    fs.symlinkSync(path.join(root, 'no-such-target'), path.join(root, 'gone.txt'));
    fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), 'gone.txt\n');

    const result = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(git('diff', '--cached', '--name-status').stdout.trim(), 'T\tgone.txt');
  },
);

test('stage-queue: running it twice in a row gives the same staged result, for nested paths too (idempotent across review rounds)', () => {
  const { root, git } = makeGitRoot();
  fs.mkdirSync(path.join(root, 'sub', 'dir'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sub', 'dir', 'gone.md'), 'x\n');
  git('add', 'sub/dir/gone.md');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'g');
  fs.rmSync(path.join(root, 'sub', 'dir', 'gone.md'));
  fs.writeFileSync(path.join(root, 'a.txt'), 'a\n');
  fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), 'sub/dir/gone.md\na.txt\n');

  const first = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(first.status, 0, first.stderr);
  const second = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(second.status, 0, second.stderr);
  const staged = git('diff', '--cached', '--name-status').stdout.trim().split('\n').sort();
  assert.deepEqual(staged, ['A\ta.txt', 'D\tsub/dir/gone.md']);
});

test('stage-queue: an empty or missing queue fails loudly instead of staging nothing silently', () => {
  const { root } = makeGitRoot();
  const result = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /review queue is empty/);
});

test('stage-queue: a queued path that git rejects fails the command (non-zero), it is not swallowed', () => {
  const { root } = makeGitRoot();
  fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), 'never-existed.txt\n');
  const result = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
  assert.notEqual(result.status, 0);
});

test('stage-queue: queued names are passed to git as literal paths, never interpreted by a shell or as options', () => {
  const { root, git } = makeGitRoot();
  const tricky = '--weird; echo PWNED $(whoami).txt';
  fs.writeFileSync(path.join(root, tricky), 't\n');
  fs.writeFileSync(path.join(root, '.claude', 'review-queue.txt'), `${tricky}\n`);
  const result = run('stage-queue', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
  assert.equal(result.status, 0, result.stderr);
  // An executed `echo PWNED $(whoami)` would print a line STARTING with PWNED. The name
  // itself may appear quoted inside a git message (Windows prints an LF-to-CRLF warning
  // naming the file), which is harmless and must not fail the test.
  assert.doesNotMatch(result.stdout + result.stderr, /^\s*PWNED\b/m);
  assert.deepEqual(git('diff', '--cached', '--name-only', '-z').stdout.split('\0').filter(Boolean), [tricky]);
});

// ---------------------------------------------------------------- CLI surface

test('an unknown command fails loudly rather than silently doing nothing', () => {
  const root = makeRoot();
  const result = run('nope', { cwd: root, env: { CLAUDE_PROJECT_DIR: root } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command/i);
});

// ---------------------------------------------------------------- settings.json wiring

// Exec form (`args` set) spawns node directly with no shell, so the hook works the same
// under sh, Git Bash, and the PowerShell fallback Claude Code uses on Windows without
// Git Bash, where a bare `$CLAUDE_PROJECT_DIR` would be an undefined PowerShell variable.
test('settings.json: every hook is an exec-form `node` invocation of harness-hooks.js (no shell), with no PowerShell left', () => {
  const settingsPath = path.resolve(__dirname, '..', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const commands = [];
  for (const groups of Object.values(settings.hooks)) {
    for (const group of groups) for (const hook of group.hooks) commands.push(hook);
  }
  assert.ok(commands.length >= 5, 'the five original hooks are still wired');
  for (const hook of commands) {
    const label = JSON.stringify(hook);
    assert.equal(hook.shell, undefined, `exec form ignores shell; none may be set: ${label}`);
    assert.equal(hook.command, 'node', label);
    assert.ok(Array.isArray(hook.args) && hook.args.length === 2, label);
    assert.equal(hook.args[0], '${CLAUDE_PROJECT_DIR}/.claude/hooks/harness-hooks.js', label);
    assert.match(hook.args[1], /^[a-z-]+$/, label);
  }
  // queue-edit must see every file-writing tool. Claude Code's documented matcher rule
  // (https://code.claude.com/docs/en/hooks#matcher-patterns): a value of only letters,
  // digits, `_`, `-`, spaces, `,`, and `|` is a list of EXACT tool names; anything else
  // is an unanchored JavaScript regex. So `Write|Edit|MultiEdit` does NOT match NotebookEdit.
  const matcherValue = settings.hooks.PostToolUse[0].matcher;
  const claudeCodeMatches = (tool) =>
    /^[A-Za-z0-9_\- ,|]*$/.test(matcherValue)
      ? matcherValue.split(/[|,]/).map((name) => name.trim()).includes(tool)
      : new RegExp(matcherValue).test(tool);
  for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
    assert.ok(claudeCodeMatches(tool), `${tool} reaches queue-edit (matcher ${JSON.stringify(matcherValue)})`);
  }
  assert.equal(claudeCodeMatches('Read'), false, 'read-only tools must not trigger queue-edit');
  const used = new Set(commands.map((hook) => hook.args[1]));
  for (const name of ['queue-edit', 'session-start', 'pre-compact', 'stop-review-queue', 'stop-stale-scan']) {
    assert.ok(used.has(name), `${name} is wired`);
  }
});
