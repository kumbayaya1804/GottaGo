#!/usr/bin/env node
/**
 * Cross-platform Claude Code hooks for this repo (macOS, Linux, Windows).
 *
 * Replaces the PowerShell one-liners that used to live in .claude/settings.json, so
 * the hooks no longer depend on an OS-specific shell. settings.json invokes this file
 * in exec form (`command: "node"` plus `args`), so no shell runs at all. Deliberate
 * differences from the originals: paths are normalized before the containment check,
 * case folding applies only when the root's filesystem is case-insensitive, NotebookEdit
 * paths are queued, edits inside a git worktree queue into that worktree (and the Stop
 * reminder checks it), and a failing `bd` falls back to the pointer message instead of
 * emitting nothing.
 *
 * Commands (first CLI argument):
 *   queue-edit         PostToolUse: read the tool payload from stdin and append the
 *                      edited file's repo-relative path to .claude/review-queue.txt.
 *   session-start      SessionStart: `bd prime` if bd exists; if bd is missing or fails,
 *                      point at the execution-state recovery docs.
 *   pre-compact        PreCompact: same, with `--work-type recovery`.
 *   stop-review-queue  Stop: remind about reviewers when the project queue, or the queue
 *                      of the worktree Claude is working in, is non-empty.
 *   stop-stale-scan    Stop: remind when the stale-information scan is >= 30 days old.
 *   stage-queue        Manual: `git add -A` exactly the paths in the review queue, before
 *                      computing the packet scope_hash (see review_packet_generator.md).
 *
 * Failure policy: a hook that cannot do its job exits non-zero with a stderr
 * message. It never exits 0 silently, because a silently skipped queue-edit is
 * exactly how edits escape the review gate.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const QUEUE_RELATIVE = '.claude/review-queue.txt';
// Gitignored input to review-packets.js. Queuing it would put an unstageable file into the
// review scope, so edits to it are never queued.
const CLAIMS_RELATIVE = '.claude/review-claims.md';
const SCAN_RELATIVE = '.planning/stale-info-scan-latest.md';
const EXECUTION_STATE_RELATIVE = '.beads/context/execution-state.md';
const STALE_SCAN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const MESSAGES = {
  reviewers:
    'Reviewers needed before committing: check .claude/review-queue.txt, generate ' +
    '.claude/antigravity-prompt-latest.md and .claude/codex-prompt-latest.md, then have the user ' +
    'run Antigravity and Codex CLIs and save both review artifacts.',
  staleScan:
    'Stale-information scan is due or missing: run /stale-info-scan before phase transitions, ' +
    'milestone close, release, or dependency/schema/harness changes.',
  bdMissing: 'bd CLI not found.',
  recoveryPointer:
    'For recovery, read .beads/context/execution-state.md, .planning/STATE.md, ' +
    'and docs/context-router.md instead of running bd prime.',
  startupPointer:
    'Startup context is docs/context-router.md, .planning/STATE.md, and ' +
    '.beads/context/execution-state.md.',
};

// Fallback only, for a path with no letters to probe: default macOS (APFS/HFS+) and
// Windows (NTFS) volumes are case-insensitive; Linux filesystems are not.
const PLATFORM_CASE_INSENSITIVE = process.platform === 'darwin' || process.platform === 'win32';

function swapCase(value) {
  return value.replace(/[A-Za-z]/g, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));
}

/**
 * Whether the filesystem holding `dir` is case-insensitive, probed rather than assumed
 * from the OS (macOS also supports case-sensitive APFS). Finds the nearest existing
 * ancestor whose name has letters and checks whether its case-swapped spelling is the
 * same file (same dev and inode). Nothing is written.
 */
function isCaseInsensitiveFs(dir) {
  let current = path.resolve(dir);
  for (;;) {
    const name = path.basename(current);
    if (fs.existsSync(current) && swapCase(name) !== name) {
      const real = fs.statSync(current);
      try {
        const swapped = fs.statSync(path.join(path.dirname(current), swapCase(name)));
        return swapped.dev === real.dev && swapped.ino === real.ino;
      } catch {
        return false;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return PLATFORM_CASE_INSENSITIVE;
    current = parent;
  }
}

function toForwardSlashes(value) {
  return String(value).replace(/\\/g, '/');
}

/**
 * The project root, in order of trust: CLAUDE_PROJECT_DIR (set by Claude Code),
 * then the git top-level of `cwd`, then the nearest ancestor holding
 * .claude/settings.json, then `cwd`. Git comes before the marker walk because this
 * repo has a nested app/.claude/settings.json: a nearest-marker walk from app/
 * would write app/.claude/review-queue.txt, which the commit gate never reads.
 */
function resolveProjectRoot(env, cwd) {
  const fromEnv = env && env.CLAUDE_PROJECT_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  const topLevel = !git.error && git.status === 0 ? git.stdout.trim() : '';
  if (topLevel && fs.existsSync(topLevel)) return path.resolve(topLevel);

  let dir = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.claude', 'settings.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(cwd);
    dir = parent;
  }
}

/**
 * realpath of `target`, tolerating a target that does not exist yet (a Write creating
 * a new file): resolve the deepest existing ancestor and re-attach the remainder.
 * Uses the OS resolver (`.native`), which returns the canonical spelling: it expands
 * Windows 8.3 short names (RUNNER~1 -> runneradmin) and restores on-disk letter case.
 * The JS resolver only follows symlinks, so a root spelled by git and a file spelled
 * by the model could fail to match and the edit would go unqueued (windows-latest CI).
 */
function realpathOfExisting(target) {
  const remainder = [];
  let current = path.resolve(target);
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...remainder);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      remainder.unshift(path.basename(current));
      current = parent;
    }
  }
}

function stripPrefix(fpFwd, root, caseInsensitive) {
  const prefix = `${path.posix.normalize(toForwardSlashes(root)).replace(/\/+$/, '')}/`;
  const matches = caseInsensitive
    ? fpFwd.toLowerCase().startsWith(prefix.toLowerCase())
    : fpFwd.startsWith(prefix);
  return matches ? fpFwd.slice(prefix.length) : null;
}

/**
 * A repo-relative, forward-slash path for `filePath`, or null when it is not a
 * file inside `root` (outside the repo, or escaping it via `..`). `..` segments are
 * resolved before the containment check. The prefix match is case-insensitive only when
 * the root's filesystem is (isCaseInsensitiveFs). Both the root and the file are also
 * tried in their symlink-resolved form, because the same directory can be spelled
 * two ways (macOS /var -> /private/var, /tmp -> /private/tmp) and the project root
 * (from cwd) and the tool's file path (from the model) need not use the same one.
 */
function toRepoRelative(filePath, root, { caseInsensitive } = {}) {
  if (!filePath) return null;
  if (caseInsensitive === undefined) caseInsensitive = isCaseInsensitiveFs(root);
  const fp = path.posix.normalize(toForwardSlashes(filePath));
  const isAbsolute = path.posix.isAbsolute(fp) || /^[A-Za-z]:\//.test(fp);

  let relative = null;
  if (!isAbsolute) {
    relative = fp;
  } else {
    const roots = [root, realpathOfExisting(root)];
    // Only resolve symlinks for paths that are absolute on THIS platform; a Windows-style
    // `C:\...` path on POSIX would otherwise be resolved against cwd and could land inside root.
    const files = path.isAbsolute(filePath) ? [fp, toForwardSlashes(realpathOfExisting(filePath))] : [fp];
    for (const candidateFile of files) {
      for (const candidateRoot of roots) {
        relative = stripPrefix(candidateFile, candidateRoot, caseInsensitive);
        if (relative !== null) break;
      }
      if (relative !== null) break;
    }
  }

  if (!relative || relative === '.' || relative === '..' || relative.startsWith('../')) return null;

  // A lexical match is not enough: a symlink inside the root can point outside it
  // (repo/link -> ../outside). Require the fully resolved file to be inside the fully
  // resolved root too. Skipped only for a foreign-platform absolute path (e.g. C:\ on
  // POSIX), which cannot be resolved here.
  if (!isAbsolute || path.isAbsolute(filePath)) {
    const resolvedFile = realpathOfExisting(isAbsolute ? filePath : path.join(root, relative));
    const resolved = stripPrefix(toForwardSlashes(resolvedFile), realpathOfExisting(root), caseInsensitive);
    if (!resolved || resolved === '..' || resolved.startsWith('../')) return null;
  }
  return relative;
}

/**
 * Queue entries exactly as written (CR/LF stripped, whitespace-only lines skipped). Names
 * are NOT trimmed: trimming would silently turn `a.txt ` into a different path, `a.txt`.
 */
function readQueue(root) {
  const queue = path.join(root, QUEUE_RELATIVE);
  if (!fs.existsSync(queue)) return [];
  return fs
    .readFileSync(queue, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
}

/**
 * The queue is a line format, and the pre-commit gate (check-review-artifacts.js) trims
 * each line, so a path with leading/trailing whitespace or a line break cannot be
 * represented. Fail loudly instead of recording or staging a different path.
 */
function assertRepresentable(entry) {
  if (entry !== entry.trim() || /[\r\n]/.test(entry)) {
    throw new Error(
      `path ${JSON.stringify(entry)} cannot be represented in the review queue (leading/trailing whitespace or a line break); rename it or review it manually`,
    );
  }
}

/** Appends `relative` to the review queue unless already listed. Returns true if it wrote. */
function appendToQueue(root, relative) {
  assertRepresentable(relative);
  if (readQueue(root).includes(relative)) return false;
  const queue = path.join(root, QUEUE_RELATIVE);
  fs.mkdirSync(path.dirname(queue), { recursive: true });
  // Guarantee the new path starts on its own line even if the file has no trailing newline.
  const existing = fs.existsSync(queue) ? fs.readFileSync(queue, 'utf8') : '';
  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(queue, `${separator}${relative}\n`, 'utf8');
  return true;
}

/** Trimmed stdout of `git <args>` run in `cwd`, or '' when git fails or is missing. */
function gitOutput(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return !result.error && result.status === 0 ? result.stdout.trim() : '';
}

/**
 * The top-level of the git worktree containing `dir`, but only when that worktree
 * belongs to the same repository as `projectRoot` (same git common dir). A worktree
 * has its own index and its own gitignored review queue, and its pre-commit gate reads
 * that queue. An unrelated repository is never returned, so no queue is written there.
 */
function sameRepoWorktreeRoot(dir, projectRoot) {
  if (!dir || !fs.existsSync(dir)) return null;
  const commonDirArgs = ['rev-parse', '--path-format=absolute', '--git-common-dir'];
  const common = gitOutput(dir, commonDirArgs);
  const projectCommon = gitOutput(projectRoot, commonDirArgs);
  if (!common || !projectCommon || realpathOfExisting(common) !== realpathOfExisting(projectCommon)) return null;
  const topLevel = gitOutput(dir, ['rev-parse', '--show-toplevel']);
  return topLevel ? path.resolve(topLevel) : null;
}

/** Nearest existing directory at or above `target`. */
function existingDirOf(target) {
  let dir = path.resolve(target);
  while (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    const parent = path.dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
  return dir;
}

/**
 * Queues the edited file into the review queue of the checkout that owns it. Claude
 * Code keeps CLAUDE_PROJECT_DIR at the main checkout when Claude enters a worktree,
 * while the hook input's `cwd` follows Claude. So the candidates, most specific
 * first, are: the same-repo worktree holding the file (worktrees can be nested inside
 * the main checkout, e.g. .claude/worktrees/<name>), the same-repo worktree holding
 * the hook cwd, and the project root.
 */
function queueEdit(root, stdinText) {
  const payload = JSON.parse(stdinText);
  const input = (payload && payload.tool_input) || {};
  // NotebookEdit reports notebook_path. settings.json lists it explicitly: the matcher is
  // an exact-name list, so "Edit" alone would not match NotebookEdit.
  const filePath = input.file_path || input.notebook_path;
  if (!filePath) return;
  const candidates = [];
  if (path.isAbsolute(filePath)) candidates.push(sameRepoWorktreeRoot(existingDirOf(path.dirname(filePath)), root));
  candidates.push(sameRepoWorktreeRoot(payload.cwd, root), root);
  for (const candidate of candidates) {
    if (!candidate) continue;
    const relative = toRepoRelative(filePath, candidate);
    if (relative) {
      if (relative !== CLAIMS_RELATIVE) appendToQueue(candidate, relative);
      return;
    }
  }
}

/**
 * The reviewer reminder when the project queue, or the queue of the same-repo worktree
 * Claude is working in (hook input `cwd`), has pending entries. Empty stdin means no
 * payload (a manual run); non-JSON stdin throws.
 */
function reviewQueueMessage(root, stdinText = '') {
  const payload = stdinText.trim() ? JSON.parse(stdinText) : {};
  const roots = [sameRepoWorktreeRoot(payload && payload.cwd, root), root];
  return roots.some((candidate) => candidate && readQueue(candidate).length > 0)
    ? { systemMessage: MESSAGES.reviewers }
    : null;
}

function staleScanMessage(root, now = Date.now()) {
  const scan = path.join(root, SCAN_RELATIVE);
  let due = true;
  if (fs.existsSync(scan)) due = now - fs.statSync(scan).mtimeMs >= STALE_SCAN_DAYS * DAY_MS;
  return due ? { systemMessage: MESSAGES.staleScan } : null;
}

/**
 * Runs `bd prime [args]` when bd is on PATH (its stdout becomes hook context). When
 * bd is missing or fails, and the execution-state doc exists, returns a pointer
 * message naming the reason. bd's stdin is detached so it can neither consume the
 * hook payload nor block waiting for input.
 */
function beadsOrFallback(root, bdArgs, pointer) {
  const result = spawnSync('bd', bdArgs, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  let reason;
  if (result.error) {
    reason = result.error.code === 'ENOENT' ? MESSAGES.bdMissing : `bd prime failed (${result.error.message}).`;
  } else if (result.status !== 0) {
    reason = `bd prime failed (exit ${result.status === null ? result.signal : result.status}).`;
  } else {
    return null;
  }
  return fs.existsSync(path.join(root, EXECUTION_STATE_RELATIVE)) ? { systemMessage: `${reason} ${pointer}` } : null;
}

/**
 * `git add -A` exactly the queued paths (new, modified, or deleted). Paths go to git
 * as argv after `--`, never through a shell, so no queued name can be read as an
 * option or a command. `--literal-pathspecs` makes each name a literal path, so glob
 * characters or `:(magic)` in a name cannot match, and stage, other files. Blank lines
 * and CRLF endings are ignored, unlike
 * `git add --pathspec-from-file`, which aborts on an empty line.
 */
function stageQueue(root) {
  const paths = readQueue(root);
  if (paths.length === 0) throw new Error(`review queue is empty or missing (${QUEUE_RELATIVE})`);
  paths.forEach(assertRepresentable);
  // A deletion already staged (e.g. by `git rm`) is in neither the working tree nor the
  // index, so `git add -A` rejects it. It is already in its final staged state, so leave
  // it out. A path that was never tracked is not in HEAD either and still reaches
  // `git add`, which rejects it loudly.
  const toAdd = paths.filter((p) => !isStagedDeletion(root, p));
  if (toAdd.length === 0) return;
  const result = spawnSync('git', ['--literal-pathspecs', 'add', '-A', '--', ...toAdd], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git add exited with status ${result.status}`);
}

// True when the path is absent from the working tree and the index but present in HEAD.
function isStagedDeletion(root, relPath) {
  // lstat, not existsSync: existsSync follows symlinks, so a dangling symlink that
  // replaced the deleted file would read as absent and be skipped.
  try {
    fs.lstatSync(path.join(root, relPath));
    return false;
  } catch {
    // absent from the working tree; fall through to the index and HEAD checks
  }
  const git = (args) =>
    spawnSync('git', ['--literal-pathspecs', ...args], { cwd: root, encoding: 'utf8', shell: false });
  const inIndex = git(['ls-files', '--cached', '-z', '--', relPath]);
  if (inIndex.status !== 0 || inIndex.stdout !== '') return false;
  const inHead = git(['ls-tree', '-z', '--name-only', 'HEAD', '--', relPath]);
  return inHead.status === 0 && inHead.stdout !== '';
}

function emit(message) {
  if (message) process.stdout.write(`${JSON.stringify(message)}\n`);
}

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function main(argv, env, cwd) {
  const command = argv[0];
  const root = resolveProjectRoot(env, cwd);

  switch (command) {
    case 'queue-edit':
      queueEdit(root, readStdin());
      return;
    case 'session-start':
      emit(beadsOrFallback(root, ['prime'], MESSAGES.startupPointer));
      return;
    case 'pre-compact':
      emit(beadsOrFallback(root, ['prime', '--work-type', 'recovery'], MESSAGES.recoveryPointer));
      return;
    case 'stop-review-queue':
      emit(reviewQueueMessage(root, readStdin()));
      return;
    case 'stop-stale-scan':
      emit(staleScanMessage(root));
      return;
    case 'stage-queue':
      stageQueue(root);
      return;
    default:
      throw new Error(`unknown command: ${command === undefined ? '(none)' : command}`);
  }
}

module.exports = {
  isCaseInsensitiveFs,
  resolveProjectRoot,
  toRepoRelative,
  readQueue,
  appendToQueue,
  reviewQueueMessage,
  staleScanMessage,
  stageQueue,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2), process.env, process.cwd());
  } catch (error) {
    process.stderr.write(`harness-hooks: ${error.message}\n`);
    process.exit(1);
  }
}
