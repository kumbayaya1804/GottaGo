'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(__dirname, 'review-packets.js');
const gatePath = path.resolve(__dirname, 'check-review-artifacts.js');
const gate = require('./check-review-artifacts.js');
const fixtureRoots = [];

test.after(() => {
  for (const root of fixtureRoots) fs.rmSync(root, { recursive: true, force: true });
});

function write(root, rel, content = 'fixture\n') {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const CLAIMS_BODY = [
  '## Task Goal',
  'Fixture goal.',
  '',
  '## Neutral Claim Table',
  '| # | Claim | Authority | Disproof | Evidence |',
  '|---|---|---|---|---|',
  '| T1 | Fixture claim. | file | find a counterexample | read it |',
  '',
  '## User Advocacy Gate',
  'Does this decision serve someone with 60 seconds before an emergency? Fixture answer.',
  '',
  '## Runtime Boundary And Mock Audit',
  '- No runtime change.',
  '',
  '## Verification',
  '| Evidence | Result |',
  '|---|---|',
  '| fixture | passed |',
  '',
].join('\n');

function claims({ body = CLAIMS_BODY, risk = 'medium' } = {}) {
  return `---\ntitle: Fixture batch\nattempt: 2\nrisk_level: ${risk}\nruntime_required: false\ncontext_tier: 1\n---\n\n${body}`;
}

// A throwaway repo with a probation policy, one committed file, and an optional low-risk flag.
function makeRepo({ lowRiskCodexOnly = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-packets-'));
  fixtureRoots.push(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Fixture');
  write(root, '.claude/settings.json', '{}\n');
  write(
    root,
    '.claude/antigravity-review-policy.json',
    JSON.stringify({
      version: 1,
      mode: 'probation',
      approvalAuthority: false,
      calibrationStatus: 'not_run',
      enforceEvidenceContract: true,
      minimumHighRiskEvidenceLevel: 3,
      requireBlindReview: true,
      requireAppendOnlyVerdicts: true,
      ...(lowRiskCodexOnly ? { lowRiskCodexOnly: true } : {}),
    }) + '\n'
  );
  write(root, 'docs/old.md', 'old\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  return { root, git };
}

function run(root) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
}

function field(content, name) {
  const m = content.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

function read(root, rel) {
  const full = path.join(root, rel);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

// The packet-level checks the gate itself enforces, applied to one generated packet.
function assertGateValidPacket(content, reviewer, queued) {
  const req = gate.ARTIFACT_REQUIREMENTS.find((r) => r.reviewer === reviewer && !r.verdict);
  for (const h of req.headings) assert.ok(content.includes(h), `${reviewer} packet heading ${h}`);
  for (const t of req.requiredText) assert.ok(content.includes(t), `${reviewer} packet text ${t}`);
  for (const f of queued) assert.ok(content.includes(f), `${reviewer} packet mentions ${f}`);
  const other = reviewer === 'codex' ? 'antigravity' : 'codex';
  assert.equal(gate.referencesReviewerOutput(content, other), false, `${reviewer} packet leaks the other verdict`);
  assert.equal(gate.referencesUnsafeFullGateInvocation(content), false, `${reviewer} packet names the full gate`);
  assert.equal(field(content, 'blind_review'), 'true');
}

test('full tier: writes both packets with the gate scope hash and one shared review_id', () => {
  const { root } = makeRepo();
  write(root, 'app/src/x.ts', 'export const x = 1;\n');
  write(root, '.claude/review-queue.txt', 'app/src/x.ts\n');
  write(root, '.claude/review-claims.md', claims());

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);

  const scope = execFileSync(process.execPath, [gatePath, '--print-staged-scope-hash'], { cwd: root, encoding: 'utf8' }).trim();
  const ag = read(root, '.claude/antigravity-prompt-latest.md');
  const cx = read(root, '.claude/codex-prompt-latest.md');
  assert.ok(ag && cx, 'both packets written');
  for (const p of [ag, cx]) {
    assert.equal(field(p, 'scope_hash'), scope);
    assert.equal(field(p, 'risk_level'), 'medium');
    assert.match(p, /Attempt 2/);
  }
  assert.equal(field(ag, 'review_id'), field(cx, 'review_id'));
  assert.match(field(cx, 'review_id'), /^rv-\d{8}T\d{6}Z-[0-9a-f]{8}$/);
  assertGateValidPacket(ag, 'antigravity', ['app/src/x.ts']);
  assertGateValidPacket(cx, 'codex', ['app/src/x.ts']);
  // The verdict templates prefill the exact skills text the gate requires in verdicts.
  assert.match(cx, /### Skills Applied\n- `\.claude\/skills\/artifact_qa_gate\.md` shared core and Codex Overlay/);
  assert.match(ag, /### Skills Applied\n- `\.claude\/skills\/artifact_qa_gate\.md` shared core and Antigravity Overlay/);
  assert.match(cx, /### Follow-ups/);
  assert.match(result.stdout, /agy/);
  assert.match(result.stdout, /codex exec/);
});

test('low tier: writes only the Codex packet, labeled risk_level: low, when the policy flag is on', () => {
  const { root } = makeRepo({ lowRiskCodexOnly: true });
  write(root, 'docs/new.md', 'new\n');
  write(root, '.claude/review-queue.txt', 'docs/new.md\n');
  write(root, '.claude/review-claims.md', claims({ risk: 'low' }));

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const cx = read(root, '.claude/codex-prompt-latest.md');
  assert.equal(field(cx, 'risk_level'), 'low');
  assertGateValidPacket(cx, 'codex', ['docs/new.md']);
  assert.equal(read(root, '.claude/antigravity-prompt-latest.md'), null, 'no Antigravity packet for a low-tier batch');
  assert.match(result.stdout, /Codex only/);
  assert.doesNotMatch(result.stdout, /agy/);
});

test('refuses to write any packet when the claims text names a reviewer verdict file', () => {
  const { root } = makeRepo();
  write(root, 'app/src/x.ts', 'x\n');
  write(root, '.claude/review-queue.txt', 'app/src/x.ts\n');
  write(root, '.claude/review-claims.md', claims({ body: CLAIMS_BODY + '\nSee .claude/antigravity-review-latest.md for context.\n' }));

  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /other reviewer/);
  assert.equal(read(root, '.claude/codex-prompt-latest.md'), null);
  assert.equal(read(root, '.claude/antigravity-prompt-latest.md'), null);
});

test('a staged diff that names a verdict file or the full gate is replaced with a read-from-disk pointer', () => {
  const { root } = makeRepo();
  write(root, 'docs/leaky.md', 'Reviewers write .claude/codex-review-latest.md.\nRun node .claude/hooks/check-review-artifacts.js now.\n');
  write(root, 'app/src/x.ts', 'x\n');
  write(root, '.claude/review-queue.txt', 'docs/leaky.md\napp/src/x.ts\n');
  write(root, '.claude/review-claims.md', claims());

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const ag = read(root, '.claude/antigravity-prompt-latest.md');
  assert.match(ag, /git diff --cached -- docs\/leaky\.md/);
  assert.doesNotMatch(ag, /Reviewers write/);
  assertGateValidPacket(ag, 'antigravity', ['docs/leaky.md', 'app/src/x.ts']);
  assertGateValidPacket(read(root, '.claude/codex-prompt-latest.md'), 'codex', ['docs/leaky.md', 'app/src/x.ts']);
});

test('stages the queue itself, including a deletion already staged with git rm', () => {
  const { root, git } = makeRepo();
  git('rm', '-q', 'docs/old.md');
  write(root, 'app/src/x.ts', 'x\n');
  write(root, '.claude/review-queue.txt', 'docs/old.md\napp/src/x.ts\n');
  write(root, '.claude/review-claims.md', claims());

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const staged = git('diff', '--cached', '--name-status').trim().split('\n').sort();
  assert.deepEqual(staged, ['A\tapp/src/x.ts', 'D\tdocs/old.md']);
  assert.match(read(root, '.claude/codex-prompt-latest.md'), /Deleted \(1\):\n- `docs\/old\.md`/);
});

test('fails with a clear message when the claims file is missing a required section', () => {
  const { root } = makeRepo();
  write(root, 'app/src/x.ts', 'x\n');
  write(root, '.claude/review-queue.txt', 'app/src/x.ts\n');
  write(root, '.claude/review-claims.md', claims({ body: '## Task Goal\nOnly a goal.\n' }));

  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Neutral Claim Table/);
  assert.equal(read(root, '.claude/codex-prompt-latest.md'), null);
});

// End to end: packets from this script plus a verdict filled from the packet's own form
// must satisfy the real gate, with Codex alone for a low-tier batch.
function fillCodexVerdict(root, verdict) {
  const packet = read(root, '.claude/codex-prompt-latest.md');
  const form = packet.slice(packet.lastIndexOf('```md\n') + 6, packet.lastIndexOf('\n```'));
  const queued = packet.match(/^ {2}- .+$/gm).map((l) => l.slice(4));
  const filled = form
    .replace('APPROVE / REQUEST CHANGES / BLOCK', verdict)
    .replace('evidence_level: 0|1|2|3|4', 'evidence_level: 2')
    .replace('runtime_evidence: executed|not_applicable|unavailable', 'runtime_evidence: not_applicable')
    .replace('### Reviewed Queue', `### Reviewed Queue\n${queued.map((q) => `- ${q}`).join('\n')}`)
    .replace('### Runtime Boundary Check', '### Runtime Boundary Check\nNo runtime change.')
    .replace('### Evidence Receipts', '### Evidence Receipts\n- fixture: read the diff');
  write(root, '.claude/codex-review-latest.md', filled + '\n');
  execFileSync(process.execPath, [path.resolve(__dirname, 'archive-review-artifact.js'), 'codex'], { cwd: root });
}

test('end to end: a low-tier batch passes the real gate with only a Codex APPROVE', () => {
  const { root } = makeRepo({ lowRiskCodexOnly: true });
  write(root, 'docs/new.md', 'new\n');
  write(root, '.claude/review-queue.txt', 'docs/new.md\n');
  write(root, '.claude/review-claims.md', claims({ risk: 'low' }));
  assert.equal(run(root).status, 0);
  fillCodexVerdict(root, 'APPROVE');

  const result = spawnSync(process.execPath, [gatePath], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('end to end: adding an app file makes the same flow block until Antigravity reviews', () => {
  const { root } = makeRepo({ lowRiskCodexOnly: true });
  write(root, 'docs/new.md', 'new\n');
  write(root, 'app/src/x.ts', 'x\n');
  write(root, '.claude/review-queue.txt', 'docs/new.md\napp/src/x.ts\n');
  write(root, '.claude/review-claims.md', claims());
  const gen = run(root);
  assert.equal(gen.status, 0, gen.stderr);
  assert.ok(read(root, '.claude/antigravity-prompt-latest.md'), 'full tier writes the Antigravity packet');
  fillCodexVerdict(root, 'APPROVE');

  const result = spawnSync(process.execPath, [gatePath], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Antigravity review verdict is missing/);
});

test('a staged rename is reported as a deletion plus an addition, and later files keep their status', () => {
  const { root, git } = makeRepo();
  write(root, 'docs/keep.md', 'line one\nline two\nline three\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'seed');
  git('mv', 'docs/keep.md', 'docs/renamed.md');
  write(root, 'docs/z-last.md', 'z\n');
  write(root, 'app/src/x.ts', 'x\n');
  write(root, '.claude/review-queue.txt', 'docs/keep.md\ndocs/renamed.md\ndocs/z-last.md\napp/src/x.ts\n');
  write(root, '.claude/review-claims.md', claims());

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const cx = read(root, '.claude/codex-prompt-latest.md');
  assert.match(cx, /Deleted \(1\):\n- `docs\/keep\.md`/);
  assert.match(cx, /Added \(3\):/);
  assert.doesNotMatch(cx, /Unchanged in the index/);
  assert.match(cx, /### docs\/z-last\.md\n\n```diff/);
});

test('a queue holding the gate file and a shell script still yields writable packets (one path per line)', () => {
  const { root } = makeRepo();
  write(root, '.claude/hooks/check-review-artifacts.js', '// fixture\n');
  write(root, 'scripts/setup.sh', 'echo hi\n');
  write(root, 'app/.env.example', 'A=1\n');
  write(root, '.claude/review-queue.txt', '.claude/hooks/check-review-artifacts.js\nscripts/setup.sh\napp/.env.example\n');
  write(root, '.claude/review-claims.md', claims());

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assertGateValidPacket(read(root, '.claude/codex-prompt-latest.md'), 'codex', ['scripts/setup.sh', 'app/.env.example']);
});

test('a claims file with CRLF line endings is accepted', () => {
  const { root } = makeRepo();
  write(root, 'app/src/x.ts', 'x\n');
  write(root, '.claude/review-queue.txt', 'app/src/x.ts\n');
  write(root, '.claude/review-claims.md', claims().replace(/\n/g, '\r\n'));

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(read(root, '.claude/codex-prompt-latest.md'), /Attempt 2/);
});

test('low-tier paths with claims declaring medium or high risk get both packets (escalation, never a silent downgrade)', () => {
  const { root } = makeRepo({ lowRiskCodexOnly: true });
  write(root, 'docs/new.md', 'new\n');
  write(root, '.claude/review-queue.txt', 'docs/new.md\n');
  write(root, '.claude/review-claims.md', claims({ risk: 'high' }));
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(field(read(root, '.claude/codex-prompt-latest.md'), 'risk_level'), 'high');
  assert.ok(read(root, '.claude/antigravity-prompt-latest.md'), 'Antigravity packet written');
});

test('queued names are literal in diffs: a [id] route does not pull in another file', () => {
  const { root } = makeRepo();
  write(root, 'app/src/app/[id]/page.tsx', 'bracket\n');
  write(root, 'app/src/app/i/page.tsx', 'OTHER-FILE-CONTENT\n');
  execFileSync('git', ['add', 'app/src/app/i/page.tsx'], { cwd: root });
  write(root, '.claude/review-queue.txt', 'app/src/app/[id]/page.tsx\napp/src/app/i/page.tsx\n');
  write(root, '.claude/review-claims.md', claims());
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const cx = read(root, '.claude/codex-prompt-latest.md');
  const block = cx.split('### app/src/app/[id]/page.tsx')[1].split('### ')[0];
  assert.match(block, /bracket/);
  assert.doesNotMatch(block, /OTHER-FILE-CONTENT/);
});
