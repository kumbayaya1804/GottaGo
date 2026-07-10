'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const hookPath = path.resolve(__dirname, 'check-review-artifacts.js');
const fixtureRoots = [];

function write(root, relativePath, content = 'fixture\n') {
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-gate-'));
  fixtureRoots.push(root);
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Review Gate Fixture'], { cwd: root });
  return root;
}

function stage(root, relativePath, content) {
  write(root, relativePath, content);
  execFileSync('git', ['add', '--', relativePath], { cwd: root });
}

function runHook(root, env = {}) {
  return spawnSync(process.execPath, [hookPath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function getStagedScopeHash(root) {
  return execFileSync(process.execPath, [hookPath, '--print-staged-scope-hash'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

function writeApprovalArtifacts(root, queuedFile, options = {}) {
  const includeClaimAudit = options.includeClaimAudit !== false;
  const claimHeading = includeClaimAudit ? '\n### Claim And State Audit\nconfirmed\n' : '\n';
  const scopeHash = getStagedScopeHash(root);
  write(
    root,
    '.claude/antigravity-prompt-latest.md',
    `review-manifest\nreviewer: antigravity\nscope_hash: ${scopeHash}\n${queuedFile}\n### Runtime Boundary And Mock Audit\nchecked\n${claimHeading}`
  );
  write(
    root,
    '.claude/codex-prompt-latest.md',
    `review-manifest\nreviewer: codex\nscope_hash: ${scopeHash}\n${queuedFile}\n### Runtime Boundary And Mock Audit\nchecked\n`
  );
  write(
    root,
    '.claude/antigravity-review-latest.md',
    `VERDICT: APPROVE\nscope_hash: ${scopeHash}\n${queuedFile}\n### Runtime Boundary Check\nchecked\n${claimHeading}`
  );
  write(
    root,
    '.claude/codex-review-latest.md',
    `VERDICT: APPROVE\nscope_hash: ${scopeHash}\n${queuedFile}\n### Runtime Boundary Check\nchecked\n`
  );
}

test.after(() => {
  for (const root of fixtureRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const reviewRequiredPaths = [
  'app/src/example.ts',
  'supabase/migrations/example.sql',
  'docs/example.md',
  '.claude/commands/example.md',
  '.claude/hooks/example.js',
  '.claude/skills/example.md',
  '.claude/tdd-guard/data/instructions.md',
  '.claude/settings.json',
  'ANTIGRAVITY.md',
];

for (const protectedPath of reviewRequiredPaths) {
  test(`blocks an unqueued protected path: ${protectedPath}`, () => {
    const root = createRepo();
    stage(root, protectedPath, protectedPath.endsWith('.json') ? '{}\n' : undefined);

    const result = runHook(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing from \.claude\/review-queue\.txt/);
    assert.match(result.stderr, new RegExp(protectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('allows an explicitly approved override only for unqueued protected files', () => {
  const root = createRepo();
  stage(root, 'app/src/example.ts');

  const result = runHook(root, { REVIEW_GATE_ALLOW_UNREVIEWED: '1' });

  assert.equal(result.status, 0);
  assert.match(result.stderr, /REVIEW_GATE_ALLOW_UNREVIEWED=1/);
});

test('does not let the override bypass queued artifact checks', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);

  const result = runHook(root, { REVIEW_GATE_ALLOW_UNREVIEWED: '1' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Antigravity prompt packet is missing/);
});

test('requires Claim And State Audit in Antigravity packet and verdict', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeApprovalArtifacts(root, queuedFile, { includeClaimAudit: false });

  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Antigravity prompt packet.*Claim And State Audit/);
  assert.match(result.stderr, /Antigravity review verdict.*Claim And State Audit/);
});

test('passes when queued scope and all required artifacts agree', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeApprovalArtifacts(root, queuedFile);

  const result = runHook(root);

  assert.equal(result.status, 0, result.stderr);
});

test('blocks stale approvals after queued staged bytes change', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile, 'reviewed bytes\n');
  writeApprovalArtifacts(root, queuedFile);
  assert.equal(runHook(root).status, 0);

  stage(root, queuedFile, 'changed after approval\n');
  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /scope_hash does not match the current staged queue bytes/);
});

test('fails closed when the staged index cannot be inspected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-gate-no-git-'));
  fixtureRoots.push(root);

  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /fails closed/);
});
