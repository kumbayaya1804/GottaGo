'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const hookPath = path.resolve(__dirname, 'check-review-artifacts.js');
const archivePath = path.resolve(__dirname, 'archive-review-artifact.js');
const fixtureRoots = [];

function write(root, relativePath, content = 'fixture\n') {
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

// Writes a file whose NAME is the sha256 of its own content, matching the
// archive contract the hook now verifies exactly.
function writeContentAddressedArchive(root, scopeHex, reviewer, body) {
  const hash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const relativePath = `.claude/reviews/${scopeHex}/${reviewer}/${hash}.md`;
  write(root, relativePath, body);
  return relativePath;
}

// A calibration record whose rows carry the receipts ANTIGRAVITY.md requires,
// each bound to a real content-addressed archive on disk.
function writeCalibration(root, requiredCases = ['transport-auth-negotiation'], runIds = ['run-1', 'run-2']) {
  const scopeHex = 'a'.repeat(64);
  const results = [];
  for (const caseId of requiredCases) {
    for (const runId of runIds) {
      // Each row gets its OWN prompt file and its OWN archive, and the archive
      // must read as a real verdict naming the case it certifies.
      const promptPath = `.claude/calibration/prompts/${caseId}-${runId}.md`;
      const promptBody = `calibration prompt for ${caseId} on ${runId}\n`;
      write(root, promptPath, promptBody);
      results.push({
        caseId,
        passed: true,
        runId,
        model: 'fixture-reviewer-model',
        command: `node fixture-calibration.js --case ${caseId} --run ${runId}`,
        promptPath,
        promptSha256: crypto.createHash('sha256').update(promptBody, 'utf8').digest('hex'),
        timestamp: '2026-07-30T00:00:00Z',
        verdictArchive: writeContentAddressedArchive(
          root,
          scopeHex,
          'antigravity',
          `**VERDICT: ADVISORY**\ncalibration verdict for ${caseId} on ${runId}\n`
        ),
      });
    }
  }
  write(
    root,
    '.claude/antigravity-calibration-contract.json',
    JSON.stringify(
      {
        version: 1,
        minimumIndependentRuns: 2,
        maximumFalseApprovals: 0,
        requireBlindInputs: true,
        requiredCases,
        passingVerdicts: ['ADVISORY'],
      },
      null,
      2
    ) + '\n'
  );
  write(
    root,
    '.claude/calibration-evidence.json',
    JSON.stringify(
      {
        contractVersion: 1,
        blindInputs: true,
        reviewerOutputsWithheld: true,
        independentRuns: runIds.length,
        falseApprovals: 0,
        results,
      },
      null,
      2
    ) + '\n'
  );
}

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-gate-'));
  fixtureRoots.push(root);
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Review Gate Fixture'], { cwd: root });
  // A policy file is now mandatory — the gate fails closed without one. This
  // baseline reproduces the permissive behavior the old missing-policy default
  // granted implicitly, so pre-existing tests keep asserting what they always
  // did, but it must now be stated explicitly and backed by real calibration
  // receipts rather than being conjured by deleting a file.
  writeCalibration(root);
  write(
    root,
    '.claude/antigravity-review-policy.json',
    JSON.stringify(
      {
        version: 1,
        mode: 'active',
        approvalAuthority: true,
        calibrationStatus: 'passed',
        calibrationContract: '.claude/antigravity-calibration-contract.json',
        calibrationEvidence: '.claude/calibration-evidence.json',
        enforceEvidenceContract: false,
        minimumHighRiskEvidenceLevel: 0,
        requireBlindReview: false,
        requireAppendOnlyVerdicts: false,
      },
      null,
      2
    ) + '\n'
  );
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

function writePolicy(root, overrides = {}) {
  write(
    root,
    '.claude/antigravity-review-policy.json',
    JSON.stringify(
      {
        version: 1,
        mode: 'probation',
        approvalAuthority: false,
        calibrationStatus: 'not_run',
        enforceEvidenceContract: true,
        minimumHighRiskEvidenceLevel: 3,
        requireBlindReview: true,
        requireAppendOnlyVerdicts: true,
        ...overrides,
      },
      null,
      2
    ) + '\n'
  );
}

function writeApprovalArtifacts(root, queuedFile, options = {}) {
  const includeClaimAudit = options.includeClaimAudit !== false;
  const includeQaSkillRouting = options.includeQaSkillRouting !== false;
  const includeSuperpowersRouting = options.includeSuperpowersRouting !== false;
  const antigravityVerdict = options.antigravityVerdict || 'APPROVE';
  const codexVerdict = options.codexVerdict || 'APPROVE';
  const incidentalApprovalText = options.incidentalApprovalText
    ? '\n### Approved\nThe required approval token is VERDICT: APPROVE.\n'
    : '\n';
  const conflictingCodexVerdict = options.conflictingCodexVerdict
    ? '\n**VERDICT: REQUEST CHANGES**\n'
    : '\n';
  const claimHeading = includeClaimAudit ? '\n### Claim And State Audit\nconfirmed\n' : '\n';
  const contractFields = options.evidenceContract
    ? `review_id: review-fixture-1\nrisk_level: ${options.riskLevel || 'high'}\nruntime_required: ${
        options.runtimeRequired === false ? 'false' : 'true'
      }\nblind_review: true\n`
    : '';
  const verdictFields = options.evidenceContract
    ? `prior_reviewer_outputs_read: false\nevidence_level: ${options.evidenceLevel || 3}\nruntime_evidence: ${
        options.runtimeEvidence || 'executed'
      }\n`
    : '';
  const evidenceSections = options.evidenceContract
    ? '\n### Evidence Receipts\n- command: fixture; result: passed\n\n### Adversarial Disproof\n- attempted counterexample\n\n### Unverified Boundaries\n- none\n'
    : '';
  const antigravitySkills = includeQaSkillRouting
    ? `\n### Required Skills\n- .claude/skills/artifact_qa_gate.md\n- Antigravity Overlay\n${
        includeSuperpowersRouting
          ? '- superpowers:using-superpowers\n- superpowers:verification-before-completion\n'
          : ''
      }`
    : '\n';
  const codexSkills = includeQaSkillRouting
    ? '\n### Required Skills\n- .claude/skills/artifact_qa_gate.md\n- Codex Overlay\n'
    : '\n';
  const antigravityApplied = includeQaSkillRouting
    ? `\n### Skills Applied\n- .claude/skills/artifact_qa_gate.md\n- Antigravity Overlay\n${
        includeSuperpowersRouting
          ? '- superpowers:using-superpowers\n- superpowers:verification-before-completion\n'
          : ''
      }`
    : '\n';
  const codexApplied = includeQaSkillRouting
    ? '\n### Skills Applied\n- .claude/skills/artifact_qa_gate.md\n- Codex Overlay\n'
    : '\n';
  const scopeHash = getStagedScopeHash(root);
  write(
    root,
    '.claude/antigravity-prompt-latest.md',
    `review-manifest\nreviewer: antigravity\nscope_hash: ${scopeHash}\n${contractFields}${queuedFile}\n${antigravitySkills}\n### Runtime Boundary And Mock Audit\nchecked\n${claimHeading}`
  );
  write(
    root,
    '.claude/codex-prompt-latest.md',
    `review-manifest\nreviewer: codex\nscope_hash: ${scopeHash}\n${contractFields}${queuedFile}\n${codexSkills}\n### Runtime Boundary And Mock Audit\nchecked\n`
  );
  write(
    root,
    '.claude/antigravity-review-latest.md',
    `**VERDICT: ${antigravityVerdict}**\nscope_hash: ${scopeHash}\n${contractFields}${verdictFields}${queuedFile}\n${antigravityApplied}\n### Runtime Boundary Check\nchecked\n${claimHeading}${evidenceSections}${incidentalApprovalText}`
  );
  write(
    root,
    '.claude/codex-review-latest.md',
    `**VERDICT: ${codexVerdict}**\n${conflictingCodexVerdict}scope_hash: ${scopeHash}\n${contractFields}${verdictFields}${queuedFile}\n${codexApplied}\n### Runtime Boundary Check\nchecked\n${evidenceSections}${incidentalApprovalText}`
  );
  if (options.evidenceContract && options.archive !== false) {
    execFileSync(process.execPath, [archivePath, 'antigravity'], { cwd: root });
    execFileSync(process.execPath, [archivePath, 'codex'], { cwd: root });
  }
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
  '.claude/probity/data/instructions.md',
  'probity.config.ts',
  '.claude/antigravity-review-policy.json',
  '.claude/antigravity-calibration-contract.json',
  '.claude/settings.json',
  'ANTIGRAVITY.md',
];

for (const protectedPath of reviewRequiredPaths) {
  test(`blocks an unqueued protected path: ${protectedPath}`, () => {
    const root = createRepo();
    const content =
      protectedPath === '.claude/antigravity-review-policy.json'
        ? '{"mode":"disabled"}\n'
        : protectedPath.endsWith('.json')
          ? '{}\n'
          : undefined;
    stage(root, protectedPath, content);

    const result = runHook(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing from \.claude\/review-queue\.txt/);
    assert.match(result.stderr, new RegExp(protectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('rejects the legacy override for unqueued protected files', () => {
  const root = createRepo();
  stage(root, 'app/src/example.ts');

  const result = runHook(root, { REVIEW_GATE_ALLOW_UNREVIEWED: '1' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no longer accepted/);
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

test('requires the shared Artifact QA Gate and role overlay in both reviewer packets and verdicts', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeApprovalArtifacts(root, queuedFile, { includeQaSkillRouting: false });

  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Antigravity prompt packet.*Required Skills/);
  assert.match(result.stderr, /Codex prompt packet.*Required Skills/);
  assert.match(result.stderr, /Antigravity review verdict.*Skills Applied/);
  assert.match(result.stderr, /Codex review verdict.*Skills Applied/);
});

test('requires Antigravity to invoke the Superpowers bootstrap and verification skill', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeApprovalArtifacts(root, queuedFile, { includeSuperpowersRouting: false });

  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Antigravity prompt packet.*superpowers:using-superpowers/);
  assert.match(result.stderr, /Antigravity prompt packet.*superpowers:verification-before-completion/);
  assert.match(result.stderr, /Antigravity review verdict.*superpowers:using-superpowers/);
  assert.match(result.stderr, /Antigravity review verdict.*superpowers:verification-before-completion/);
});

test('blocks REQUEST CHANGES even when unrelated prose contains the approval token', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeApprovalArtifacts(root, queuedFile, {
    codexVerdict: 'REQUEST CHANGES',
    incidentalApprovalText: true,
  });

  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Codex review verdict.*declares verdict REQUEST CHANGES/);
});

test('blocks BLOCK even when unrelated prose contains the approval token', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'BLOCK',
    incidentalApprovalText: true,
  });

  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Antigravity review verdict.*declares verdict BLOCK/);
});

test('blocks duplicate or conflicting verdict declarations', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeApprovalArtifacts(root, queuedFile, { conflictingCodexVerdict: true });

  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Codex review verdict.*multiple verdict declarations/);
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

test('probation accepts ADVISORY but rejects Antigravity APPROVE', () => {
  const root = createRepo();
  const queuedFile = 'app/src/example.ts';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writePolicy(root);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'APPROVE',
    evidenceContract: true,
  });

  const rejected = runHook(root);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /policy requires ADVISORY/);

  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
  });
  const accepted = runHook(root);
  assert.equal(accepted.status, 0, accepted.stderr);
});

test('blocks a runtime-required verdict without executed runtime evidence', () => {
  const root = createRepo();
  const queuedFile = 'supabase/tests/example.sql';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writePolicy(root);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
    runtimeEvidence: 'unavailable',
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /without runtime_evidence: executed/);
});

test('blocks high-risk verdicts below the configured evidence floor', () => {
  const root = createRepo();
  const queuedFile = 'supabase/migrations/example.sql';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writePolicy(root);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
    evidenceLevel: 2,
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /high-risk evidence floor of Level 3/);
});

test('requires a byte-identical append-only verdict archive', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writePolicy(root);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
    runtimeRequired: false,
    archive: false,
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no byte-identical append-only archive/);
});

test('blocks a blind packet that exposes the other reviewer verdict', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writePolicy(root);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
    runtimeRequired: false,
  });
  fs.appendFileSync(
    path.join(root, '.claude', 'antigravity-prompt-latest.md'),
    '\nSee .claude/codex-review-latest.md\n',
    'utf8'
  );

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exposes the other reviewer verdict before blind review/);
});

test('rejects active Antigravity authority without passed calibration', () => {
  const root = createRepo();
  write(root, '.claude/review-queue.txt', 'docs/example.md\n');
  stage(root, 'docs/example.md');
  writePolicy(root, { mode: 'active', approvalAuthority: true, calibrationStatus: 'not_run' });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /active mode requires approvalAuthority=true and calibrationStatus=passed/);
});

test('rejects active Antigravity authority without calibration evidence', () => {
  const root = createRepo();
  write(root, '.claude/review-queue.txt', 'docs/example.md\n');
  stage(root, 'docs/example.md');
  write(
    root,
    '.claude/antigravity-calibration-contract.json',
    JSON.stringify({
      version: 1,
      minimumIndependentRuns: 2,
      maximumFalseApprovals: 0,
      requireBlindInputs: true,
      requiredCases: ['transport-auth-negotiation'],
    })
  );
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: null,
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /calibration evidence path is missing/);
});

test('allows active Antigravity authority only with complete calibration receipts', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeCalibration(root, ['transport-auth-negotiation']);
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: '.claude/calibration-evidence.json',
  });
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'APPROVE',
    evidenceContract: true,
    runtimeRequired: false,
  });

  const result = runHook(root);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects self-asserted calibration rows with no receipts', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  const caseId = 'transport-auth-negotiation';
  write(
    root,
    '.claude/antigravity-calibration-contract.json',
    JSON.stringify({
      version: 1,
      minimumIndependentRuns: 2,
      maximumFalseApprovals: 0,
      requireBlindInputs: true,
      requiredCases: [caseId],
      passingVerdicts: ['ADVISORY'],
    })
  );
  // The exact minimal record the previous implementation accepted.
  write(
    root,
    '.claude/calibration-evidence.json',
    JSON.stringify({
      contractVersion: 1,
      blindInputs: true,
      reviewerOutputsWithheld: true,
      independentRuns: 2,
      falseApprovals: 0,
      results: [{ caseId, passed: true }],
    })
  );
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: '.claude/calibration-evidence.json',
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /is missing runId/);
});

test('rejects calibration whose verdictArchive is not content-addressed', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  const caseId = 'transport-auth-negotiation';
  const scopeHex = 'a'.repeat(64);
  write(root, `.claude/reviews/${scopeHex}/antigravity/not-the-content-hash.md`, 'forged\n');
  const promptPath = '.claude/calibration/prompts/p.md';
  const promptBody = 'p\n';
  write(root, promptPath, promptBody);
  write(
    root,
    '.claude/antigravity-calibration-contract.json',
    JSON.stringify({
      version: 1,
      minimumIndependentRuns: 1,
      maximumFalseApprovals: 0,
      requireBlindInputs: true,
      requiredCases: [caseId],
      passingVerdicts: ['ADVISORY'],
    })
  );
  write(
    root,
    '.claude/calibration-evidence.json',
    JSON.stringify({
      contractVersion: 1,
      blindInputs: true,
      reviewerOutputsWithheld: true,
      independentRuns: 1,
      falseApprovals: 0,
      results: [
        {
          caseId,
          passed: true,
          runId: 'run-1',
          model: 'm',
          command: 'c',
          promptPath,
          promptSha256: crypto.createHash('sha256').update(promptBody, 'utf8').digest('hex'),
          timestamp: '2026-07-30T00:00:00Z',
          verdictArchive: `.claude/reviews/${scopeHex}/antigravity/not-the-content-hash.md`,
        },
      ],
    })
  );
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: '.claude/calibration-evidence.json',
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not content-addressed/);
});

test('rejects calibration that lacks the required independent runs per case', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeCalibration(root, ['transport-auth-negotiation'], ['run-only-one']);
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: '.claude/calibration-evidence.json',
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /too few independent runs|lacks 2 independent runs/);
});

test('fails closed when the review policy file is absent', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeApprovalArtifacts(root, queuedFile);
  assert.equal(runHook(root).status, 0);

  fs.rmSync(path.join(root, '.claude', 'antigravity-review-policy.json'));
  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /review policy is missing/);
  assert.match(result.stderr, /fails closed/);
});

test('blocks a staged deletion of review policy state', () => {
  const root = createRepo();
  const policyPath = '.claude/antigravity-review-policy.json';
  execFileSync('git', ['add', '--', policyPath, '.claude/calibration-evidence.json'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '--no-verify', '-m', 'baseline'], { cwd: root });
  write(root, '.claude/review-queue.txt', `${policyPath}\n`);
  execFileSync('git', ['rm', '--quiet', '--', policyPath], { cwd: root });

  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /staged deletion of review policy state/);
});

test('blocks a blind packet that references the other verdict with backslashes', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writePolicy(root);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
    runtimeRequired: false,
  });
  fs.appendFileSync(
    path.join(root, '.claude', 'antigravity-prompt-latest.md'),
    '\nSee .claude\\codex-review-latest.md\n',
    'utf8'
  );

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exposes the other reviewer verdict before blind review/);
});

test('allows a blind packet to name the queued antigravity policy file', () => {
  const root = createRepo();
  const queuedFile = '.claude/antigravity-review-policy.json';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  writePolicy(root);
  execFileSync('git', ['add', '--', queuedFile], { cwd: root });
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
    runtimeRequired: false,
  });

  const result = runHook(root);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects an archive stored under a name that is not its content hash', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writePolicy(root);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
    runtimeRequired: false,
    archive: false,
  });
  const scopeHex = getStagedScopeHash(root).slice('sha256:'.length);
  const verdict = fs.readFileSync(path.join(root, '.claude', 'antigravity-review-latest.md'), 'utf8');
  // Correct content, wrong filename — accepted by the previous directory scan.
  write(root, `.claude/reviews/${scopeHex}/antigravity/arbitrary-name.md`, verdict);

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no byte-identical append-only archive/);
});

test('rejects calibration that reuses one archive across rows', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  const caseId = 'transport-auth-negotiation';
  const scopeHex = 'a'.repeat(64);
  const shared = writeContentAddressedArchive(
    root,
    scopeHex,
    'antigravity',
    `**VERDICT: ADVISORY**\n${caseId}\n`
  );
  const promptPath = '.claude/calibration/prompts/shared.md';
  const promptBody = 'shared prompt\n';
  write(root, promptPath, promptBody);
  const promptSha256 = crypto.createHash('sha256').update(promptBody, 'utf8').digest('hex');
  const row = (runId) => ({
    caseId,
    passed: true,
    runId,
    model: 'm',
    command: 'c',
    promptPath,
    promptSha256,
    timestamp: '2026-07-30T00:00:00Z',
    verdictArchive: shared,
  });
  write(
    root,
    '.claude/antigravity-calibration-contract.json',
    JSON.stringify({
      version: 1,
      minimumIndependentRuns: 2,
      maximumFalseApprovals: 0,
      requireBlindInputs: true,
      requiredCases: [caseId],
      passingVerdicts: ['ADVISORY'],
    })
  );
  write(
    root,
    '.claude/calibration-evidence.json',
    JSON.stringify({
      contractVersion: 1,
      blindInputs: true,
      reviewerOutputsWithheld: true,
      independentRuns: 2,
      falseApprovals: 0,
      results: [row('run-1'), row('run-2')],
    })
  );
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: '.claude/calibration-evidence.json',
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /reuses a verdictArchive/);
});

test('rejects calibration whose archive is not a verdict for the declared case', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  const caseId = 'transport-auth-negotiation';
  const scopeHex = 'a'.repeat(64);
  const promptPath = '.claude/calibration/prompts/p.md';
  const promptBody = 'p\n';
  write(root, promptPath, promptBody);
  const results = ['run-1', 'run-2'].map((runId) => ({
    caseId,
    passed: true,
    runId,
    model: 'm',
    command: 'c',
    promptPath,
    promptSha256: crypto.createHash('sha256').update(promptBody, 'utf8').digest('hex'),
    timestamp: '2026-07-30T00:00:00Z',
    // Content-addressed, uniquely named, but not a verdict at all.
    verdictArchive: writeContentAddressedArchive(
      root,
      scopeHex,
      'antigravity',
      `this is not a verdict (${runId})\n`
    ),
  }));
  write(
    root,
    '.claude/antigravity-calibration-contract.json',
    JSON.stringify({
      version: 1,
      minimumIndependentRuns: 2,
      maximumFalseApprovals: 0,
      requireBlindInputs: true,
      requiredCases: [caseId],
      passingVerdicts: ['ADVISORY'],
    })
  );
  write(
    root,
    '.claude/calibration-evidence.json',
    JSON.stringify({
      contractVersion: 1,
      blindInputs: true,
      reviewerOutputsWithheld: true,
      independentRuns: 2,
      falseApprovals: 0,
      results,
    })
  );
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: '.claude/calibration-evidence.json',
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no parseable VERDICT declaration/);
});

test('rejects a passing calibration row whose archived verdict is not an accepted passing verdict', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  const caseId = 'transport-auth-negotiation';
  const scopeHex = 'a'.repeat(64);
  const promptPath = '.claude/calibration/prompts/p.md';
  const promptBody = 'p\n';
  write(root, promptPath, promptBody);
  const results = ['run-1', 'run-2'].map((runId) => ({
    caseId,
    passed: true,
    runId,
    model: 'm',
    command: 'c',
    promptPath,
    promptSha256: crypto.createHash('sha256').update(promptBody, 'utf8').digest('hex'),
    timestamp: '2026-07-30T00:00:00Z',
    // Content-addressed, uniquely named, labelled with the case — but the
    // verdict token contradicts the row's own passing claim.
    verdictArchive: writeContentAddressedArchive(
      root,
      scopeHex,
      'antigravity',
      `**VERDICT: BLOCK**\ncalibration verdict for ${caseId} on ${runId}\n`
    ),
  }));
  write(
    root,
    '.claude/antigravity-calibration-contract.json',
    JSON.stringify({
      version: 1,
      minimumIndependentRuns: 2,
      maximumFalseApprovals: 0,
      requireBlindInputs: true,
      requiredCases: [caseId],
      passingVerdicts: ['ADVISORY'],
    })
  );
  write(
    root,
    '.claude/calibration-evidence.json',
    JSON.stringify({
      contractVersion: 1,
      blindInputs: true,
      reviewerOutputsWithheld: true,
      independentRuns: 2,
      falseApprovals: 0,
      results,
    })
  );
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: '.claude/calibration-evidence.json',
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not an accepted passing verdict/);
});

test('fails closed when the calibration contract omits passingVerdicts', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeCalibration(root, ['transport-auth-negotiation']);
  const contractPath = path.join(root, '.claude', 'antigravity-calibration-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  delete contract.passingVerdicts;
  fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2), 'utf8');
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: '.claude/calibration-evidence.json',
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /passingVerdicts/);
});

test('rejects calibration whose promptSha256 does not match the prompt bytes', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writeCalibration(root, ['transport-auth-negotiation']);
  const evidencePath = path.join(root, '.claude', 'calibration-evidence.json');
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  evidence.results[0].promptSha256 = 'f'.repeat(64);
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
  writePolicy(root, {
    mode: 'active',
    approvalAuthority: true,
    calibrationStatus: 'passed',
    calibrationContract: '.claude/antigravity-calibration-contract.json',
    calibrationEvidence: '.claude/calibration-evidence.json',
  });

  const result = runHook(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /promptSha256 does not match/);
});

test('requires the verdict archive to be present in the git index', () => {
  const root = createRepo();
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writePolicy(root);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
    runtimeRequired: false,
  });
  assert.equal(runHook(root).status, 0, 'archives staged by the archiver should pass');

  // Un-stage the archives: they still exist on disk, but would not enter the commit.
  execFileSync('git', ['reset', '--quiet', '--', '.claude/reviews'], { cwd: root });
  const result = runHook(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no byte-identical append-only archive/);
});

test('blocks a blind packet using doubled separators or dot segments', () => {
  for (const variant of [
    '.claude//reviews/SCOPE/codex/fake.md',
    '.claude/./reviews/SCOPE/codex/fake.md',
    '.claude/x/../reviews/SCOPE/codex/fake.md',
  ]) {
    const root = createRepo();
    const queuedFile = 'docs/example.md';
    write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
    stage(root, queuedFile);
    writePolicy(root);
    writeApprovalArtifacts(root, queuedFile, {
      antigravityVerdict: 'ADVISORY',
      evidenceContract: true,
      runtimeRequired: false,
    });
    const scopeHex = getStagedScopeHash(root).slice('sha256:'.length);
    fs.appendFileSync(
      path.join(root, '.claude', 'antigravity-prompt-latest.md'),
      '\nSee ' + variant.replace('SCOPE', scopeHex) + '\n',
      'utf8'
    );

    const result = runHook(root);
    assert.equal(result.status, 1, `variant should be blocked: ${variant}`);
    assert.match(result.stderr, /exposes the other reviewer verdict before blind review/);
  }
});

test('blocks a blind packet using percent-encoded dots, nested encoding, or encoded extensions', () => {
  for (const variant of [
    // %2e hides the leading dot of .claude while every separator stays literal.
    '%2eclaude/reviews/SCOPE/codex/fake.md',
    // %252f decodes to %2f and only then to a slash — needs iterated decoding.
    '.claude%252freviews%252fSCOPE%252fcodex%252ffake.md',
    // %2e hides the extension dot of the -review-latest.md filename check.
    '.claude/codex-review-latest%2emd',
  ]) {
    const root = createRepo();
    const queuedFile = 'docs/example.md';
    write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
    stage(root, queuedFile);
    writePolicy(root);
    writeApprovalArtifacts(root, queuedFile, {
      antigravityVerdict: 'ADVISORY',
      evidenceContract: true,
      runtimeRequired: false,
    });
    const scopeHex = getStagedScopeHash(root).slice('sha256:'.length);
    fs.appendFileSync(
      path.join(root, '.claude', 'antigravity-prompt-latest.md'),
      '\nSee ' + variant.replace(/SCOPE/g, scopeHex) + '\n',
      'utf8'
    );

    const result = runHook(root);
    assert.equal(result.status, 1, `variant should be blocked: ${variant}`);
    assert.match(result.stderr, /exposes the other reviewer verdict before blind review/);
  }
});

test('blocks a blind packet using CommonMark numeric or named character references', () => {
  for (const variant of [
    // Decimal numeric character references for '.' (46) and '/' (47).
    '&#46;claude&#47;reviews&#47;SCOPE&#47;codex&#47;fake.md',
    // Hexadecimal numeric character references for the same two characters.
    '&#x2e;claude&#x2f;reviews&#x2f;SCOPE&#x2f;codex&#x2f;fake.md',
    // Named character references (CommonMark/HTML5 entity table).
    '&period;claude&sol;reviews&sol;SCOPE&sol;codex&sol;fake.md',
    // Nested: &amp; must decode to '&' so the numeric reference it was hiding
    // is revealed on a later pass of the same fixed-point loop.
    '&amp;#46;claude&#47;reviews&#47;SCOPE&#47;codex&#47;fake.md',
  ]) {
    const root = createRepo();
    const queuedFile = 'docs/example.md';
    write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
    stage(root, queuedFile);
    writePolicy(root);
    writeApprovalArtifacts(root, queuedFile, {
      antigravityVerdict: 'ADVISORY',
      evidenceContract: true,
      runtimeRequired: false,
    });
    const scopeHex = getStagedScopeHash(root).slice('sha256:'.length);
    fs.appendFileSync(
      path.join(root, '.claude', 'antigravity-prompt-latest.md'),
      '\nSee ' + variant.replace(/SCOPE/g, scopeHex) + '\n',
      'utf8'
    );

    const result = runHook(root);
    assert.equal(result.status, 1, `variant should be blocked: ${variant}`);
    assert.match(result.stderr, /exposes the other reviewer verdict before blind review/);
  }
});

test('blocks a blind packet using &percnt; composed with the fixed-point percent decoder', () => {
  for (const variant of [
    // &percnt; -> '%', which only becomes dangerous once the SAME fixed-point
    // loop's percent-decode step consumes the %2e/%2f it just revealed.
    '&percnt;2eclaude/reviews/SCOPE/codex/fake.md',
    '.claude&percnt;2freviews&percnt;2fSCOPE&percnt;2fcodex&percnt;2ffake.md',
  ]) {
    const root = createRepo();
    const queuedFile = 'docs/example.md';
    write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
    stage(root, queuedFile);
    writePolicy(root);
    writeApprovalArtifacts(root, queuedFile, {
      antigravityVerdict: 'ADVISORY',
      evidenceContract: true,
      runtimeRequired: false,
    });
    const scopeHex = getStagedScopeHash(root).slice('sha256:'.length);
    fs.appendFileSync(
      path.join(root, '.claude', 'antigravity-prompt-latest.md'),
      '\nSee ' + variant.replace(/SCOPE/g, scopeHex) + '\n',
      'utf8'
    );

    const result = runHook(root);
    assert.equal(result.status, 1, `variant should be blocked: ${variant}`);
    assert.match(result.stderr, /exposes the other reviewer verdict before blind review/);
  }
});

// &UnderBar; -> '_' is unreachable through the blind-review PATH check itself
// (referencesReviewerOutput's protected patterns contain no underscore, so a
// hook-level test through that path cannot distinguish present-vs-absent —
// confirmed this is exactly why round-6's omission was only MINOR, not another
// live bypass). Testing it meaningfully requires calling the decoder directly.
// Extracts the REAL function bodies from the shipped hook file (not a
// reimplementation) and evaluates them in an isolated scope.
function loadCanonicalizePathText() {
  const src = fs.readFileSync(hookPath, 'utf8');
  const start = src.indexOf('const NAMED_CHARACTER_REFERENCES');
  const end = src.indexOf('// Returns the blob OID');
  const scope = {};
  // eslint-disable-next-line no-new-func
  new Function('scope', src.slice(start, end) + '\nscope.canonicalizePathText = canonicalizePathText;')(scope);
  return scope.canonicalizePathText;
}

test('&UnderBar; decodes to a literal underscore', () => {
  const canonicalizePathText = loadCanonicalizePathText();
  assert.equal(canonicalizePathText('&UnderBar;'), '_');
  assert.equal(canonicalizePathText('&underbar;'), '_');
  // Composed with percent-decoding in the same fixed-point loop, same pattern
  // as the round-6 &percnt; finding: %5f is also '_', both forms must agree.
  assert.equal(canonicalizePathText('%5f'), canonicalizePathText('&UnderBar;'));
});

// Deterministic, no-network completeness check: the exact 41 WHATWG HTML5
// named-character-reference key -> value pairs (lowercased, matching the
// decoder's own case-insensitive matching) verified against
// https://html.spec.whatwg.org/entities.json on 2026-07-30, restricted to
// names whose "characters" value is a single ASCII punctuation/control code
// point. Round 6 shipped only 40 of these — missing `underbar` (-> '_') — a
// real, independently-reproduced Codex finding. This test exists so a FUTURE
// accidental deletion or value typo is caught locally without needing live
// network access at test or gate-run time; it is not a substitute for
// re-verifying against the live spec if WHATWG ever adds another such name.
// Extracts and evaluates the REAL shipped NAMED_CHARACTER_REFERENCES object
// literal directly (not a reimplementation), returning it as a plain object
// so its RAW values can be deep-compared - not observed only through
// canonicalizePathText's output, which further transforms some raw values
// (see the round-7 Codex finding below).
function loadNamedCharacterReferences() {
  const src = fs.readFileSync(hookPath, 'utf8');
  const match = src.match(/const NAMED_CHARACTER_REFERENCES = \{[\s\S]*?\n\};/);
  assert.ok(match, 'NAMED_CHARACTER_REFERENCES constant not found in hook source');
  const scope = {};
  // eslint-disable-next-line no-new-func
  new Function('scope', match[0] + '\nscope.NAMED_CHARACTER_REFERENCES = NAMED_CHARACTER_REFERENCES;')(scope);
  return scope.NAMED_CHARACTER_REFERENCES;
}

const EXPECTED_NAMED_CHARACTER_REFERENCES = {
  tab: '\t', newline: '\n', excl: '!', quot: '"', num: '#', dollar: '$',
  percnt: '%', amp: '&', apos: "'", lpar: '(', rpar: ')', ast: '*',
  midast: '*', plus: '+', comma: ',', period: '.', sol: '/', colon: ':',
  semi: ';', lt: '<', equals: '=', gt: '>', quest: '?', commat: '@',
  lsqb: '[', lbrack: '[', bsol: '\\', rsqb: ']', rbrack: ']', hat: '^',
  lowbar: '_', underbar: '_', grave: '`', diacriticalgrave: '`', lcub: '{',
  lbrace: '{', verbar: '|', vert: '|', verticalline: '|', rcub: '}', rbrace: '}',
};

// Round-7 Codex finding: the previous version of this test only observed
// values through canonicalizePathText()'s FULL pipeline, which unifies '\' ->
// '/' as a separate normalization step AFTER entity decoding. That masked a
// real class of defect - proven with an executed mutant: changing the RAW
// `bsol: '\\'` mapping to the WRONG `bsol: '/'` produced an IDENTICAL final
// canonicalized result ('/'), so the old test's "pins the exact 41 key->value
// pairs" claim was false for any entry whose raw value undergoes further
// transformation. This test deep-compares the RAW object directly instead -
// the property the docstring actually claims to guarantee.
test('NAMED_CHARACTER_REFERENCES raw object matches the verified-complete WHATWG ASCII-punctuation set exactly', () => {
  assert.deepEqual(loadNamedCharacterReferences(), EXPECTED_NAMED_CHARACTER_REFERENCES);
});

// Separate from raw-value completeness above: confirms the FULL pipeline
// (decode + path-separator normalization) still resolves every entity to the
// correct end-to-end result for blind-review matching - a real property worth
// testing, just not the same property as raw-value completeness, and no
// longer conflated with it in one assertion the way round 6's version was.
test('canonicalizePathText resolves every named reference to its correct end-to-end path form', () => {
  const canonicalizePathText = loadCanonicalizePathText();
  for (const [name, rawValue] of Object.entries(EXPECTED_NAMED_CHARACTER_REFERENCES)) {
    const expectedFinal = rawValue === '\\' ? '/' : rawValue;
    assert.equal(
      canonicalizePathText(`&${name};`),
      expectedFinal,
      `&${name}; should resolve to ${JSON.stringify(expectedFinal)} after full canonicalization`
    );
  }
});

test('the pre-commit wrapper fails closed when node is unavailable', (t) => {
  // Locate a POSIX shell by absolute path: the child's PATH is deliberately
  // stripped of node, so the shell itself must not be resolved through it.
  // PATH lookup alone is not portable: on Windows hosts with Git installed,
  // sh.exe frequently is NOT on PATH (a reviewer on such a host saw this test
  // skip while it passed here, making the recorded result irreproducible —
  // 2026-07-30 round-2 finding). Fall back to the standard Git-for-Windows
  // locations before giving up.
  const candidates = [];
  try {
    candidates.push(
      ...execFileSync(process.platform === 'win32' ? 'where' : 'which', ['sh'], { encoding: 'utf8' })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
  } catch {
    // fall through to the well-known locations below
  }
  candidates.push(
    'C:\\Program Files\\Git\\usr\\bin\\sh.exe',
    'C:\\Program Files\\Git\\bin\\sh.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\sh.exe',
    '/usr/bin/sh',
    '/bin/sh'
  );
  const shPath = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (!shPath) {
    t.skip('no POSIX sh available to execute the pre-commit wrapper');
    return;
  }

  const wrapper = path.resolve(__dirname, '..', '..', '.beads', 'hooks', 'pre-commit');
  const root = createRepo();

  const result = spawnSync(shPath, [wrapper], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: '/usr/bin:/bin' },
  });

  assert.equal(result.status, 1, result.stderr || String(result.error));
  assert.match(result.stderr, /node is not available on PATH/);
  assert.match(result.stderr, /fails closed/);
});

test('accepts a CRLF verdict archive when core.autocrlf=true normalizes the index', () => {
  const root = createRepo();
  execFileSync('git', ['config', 'core.autocrlf', 'true'], { cwd: root });
  const queuedFile = 'docs/example.md';
  write(root, '.claude/review-queue.txt', `${queuedFile}\n`);
  stage(root, queuedFile);
  writePolicy(root);
  writeApprovalArtifacts(root, queuedFile, {
    antigravityVerdict: 'ADVISORY',
    evidenceContract: true,
    runtimeRequired: false,
    archive: false,
  });
  // A reviewer on Windows saves verdicts with CRLF endings; autocrlf stores the
  // archive LF-normalized in the index while the working tree keeps CRLF.
  for (const reviewer of ['antigravity', 'codex']) {
    const file = path.join(root, '.claude', `${reviewer}-review-latest.md`);
    const crlf = fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(file, crlf, 'utf8');
    execFileSync(process.execPath, [archivePath, reviewer], { cwd: root });
  }

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
