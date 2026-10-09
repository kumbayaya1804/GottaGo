#!/usr/bin/env node
'use strict';

// Builds the blind reviewer packets for the current review queue in one step:
//   node .claude/hooks/review-packets.js
//
// 1. Stages exactly the queued paths (harness-hooks stageQueue).
// 2. Computes the staged scope_hash, a fresh review_id, and the risk tier (the gate's own
//    reviewTier, only when the policy sets lowRiskCodexOnly).
// 3. Wraps Claude's per-task claims (.claude/review-claims.md, gitignored) with the
//    reviewer-specific role, skills, blind-review rules, staged diffs, and verdict form.
// 4. Checks every packet against the gate's ARTIFACT_REQUIREMENTS and its leak checks,
//    and writes nothing unless all packets pass.
// Low tier writes only the Codex packet. The user still runs the reviewer CLIs.

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const gate = require('./check-review-artifacts.js');
const { readQueue, resolveProjectRoot, stageQueue } = require('./harness-hooks.js');

const CLAIMS_FILE = path.join('.claude', 'review-claims.md');
const REQUIRED_CLAIM_SECTIONS = [
  'Task Goal',
  'Neutral Claim Table',
  'User Advocacy Gate',
  'Runtime Boundary And Mock Audit',
  'Verification',
];

const ROLE = {
  antigravity:
    'You are Antigravity, the architecture and data-integrity reviewer. This packet is a set of claims, not proof. Inspect every queued path from disk and confirm the staged scope matches `scope_hash`. Policy `.claude/antigravity-review-policy.json` governs your allowed verdicts: during probation they are ADVISORY (clean), REQUEST CHANGES, and BLOCK.',
  codex:
    'You are Codex, the approval-bearing implementation-quality, security, and user-failure-state reviewer. This packet is a set of claims, not proof. Inspect every queued path from disk and confirm the staged scope matches `scope_hash`. Allowed verdicts: APPROVE, REQUEST CHANGES, BLOCK.',
};

const SKILLS = {
  antigravity: [
    '- `.claude/skills/artifact_qa_gate.md` shared core plus its **Antigravity Overlay**.',
    '- `superpowers:using-superpowers` first.',
    '- `superpowers:verification-before-completion` before any positive verdict.',
    '- Project domain skills under `.claude/skills/<name>/SKILL.md` (`postgis-optimizer`, `rls-security-guard`, `trust-engine-validator`, `pgtap-testing`, `user-advocacy-gate`, `privacy-pii-guard`) only when the queue touches their boundary. Name any unavailable skill as a gap.',
  ],
  codex: [
    '- `.claude/skills/artifact_qa_gate.md` shared core plus its **Codex Overlay**.',
    '- Task-relevant skills actually available in the Codex harness (for example `superpowers:using-superpowers` and `superpowers:verification-before-completion`). List only the ones you applied.',
  ],
};

const APPLIED = {
  antigravity: [
    '- `.claude/skills/artifact_qa_gate.md` shared core and Antigravity Overlay',
    '- superpowers:using-superpowers',
    '- superpowers:verification-before-completion',
    '- <add any others actually applied>',
  ],
  codex: [
    '- `.claude/skills/artifact_qa_gate.md` shared core and Codex Overlay',
    '- <list any other skills actually applied>',
  ],
};

const VERDICT_SECTIONS = {
  antigravity: ['Issues', 'Concerns', 'Follow-ups', 'Verification', 'Evidence Receipts', 'Adversarial Disproof', 'Unverified Boundaries', 'Runtime Boundary Check', 'Claim And State Audit', 'Approved'],
  codex: ['Findings', 'Follow-ups', 'Open Questions', 'Verification', 'Evidence Receipts', 'Adversarial Disproof', 'Unverified Boundaries', 'Runtime Boundary Check', 'Approved'],
};

const VERDICTS = {
  antigravity: 'ADVISORY / REQUEST CHANGES / BLOCK',
  codex: 'APPROVE / REQUEST CHANGES / BLOCK',
};

const FOLLOW_UP_RULE =
  'A problem found only in lines this batch did not change is a `NOTE (follow-up)` under `### Follow-ups`, not REQUEST CHANGES, unless the batch\'s change depends on it or directly contradicts it. BLOCK-level safety problems block wherever they are.';

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function fail(message) {
  process.stderr.write(`review-packets: ${message}\n`);
  process.exit(1);
}

function parseClaims(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) fail(`${CLAIMS_FILE} must start with a --- frontmatter block (title, attempt, risk_level, runtime_required, context_tier).`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*?)\s*$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  for (const key of ['title', 'attempt', 'risk_level', 'runtime_required', 'context_tier']) {
    if (!meta[key]) fail(`${CLAIMS_FILE} frontmatter is missing ${key}.`);
  }
  if (!['low', 'medium', 'high'].includes(meta.risk_level)) fail('risk_level must be low, medium, or high.');
  if (!['true', 'false'].includes(meta.runtime_required)) fail('runtime_required must be true or false.');
  const body = m[2].trim();
  const missing = REQUIRED_CLAIM_SECTIONS.filter((s) => !new RegExp(`^## ${s}\\s*$`, 'm').test(body));
  if (missing.length) fail(`${CLAIMS_FILE} is missing section(s): ${missing.map((s) => `## ${s}`).join(', ')}.`);
  return { meta, body };
}

function stagedStatus(queue) {
  // --no-renames keeps every record to two fields (status, path): a rename becomes a
  // deletion of the old path plus an addition of the new one, matching the gate.
  // --literal-pathspecs, as in stageQueue: a queued `app/src/app/[id]/page.tsx` is a name,
  // not a glob that also matches `app/src/app/i/page.tsx`.
  const out = git(['--literal-pathspecs', '-c', 'core.quotePath=false', 'diff', '--cached', '--no-renames', '--name-status', '-z', '--', ...queue]);
  const parts = out.split('\0').filter((p) => p !== '');
  const status = new Map();
  for (let i = 0; i < parts.length; i += 2) status.set(parts[i + 1], parts[i][0]);
  return status;
}

function diffSection(queue, status) {
  const blocks = [];
  for (const file of queue) {
    const s = status.get(file);
    if (s === 'D') {
      blocks.push(`### ${file} (deleted)\n\nRead it at \`HEAD\` with \`git show HEAD:${file}\`.`);
      continue;
    }
    if (!s) {
      blocks.push(`### ${file}\n\nQueued but unchanged in the index.`);
      continue;
    }
    const diff = git(['--literal-pathspecs', 'diff', '--cached', '--no-color', '--', file]).trimEnd();
    const leaky =
      gate.referencesReviewerOutput(diff, 'codex') ||
      gate.referencesReviewerOutput(diff, 'antigravity') ||
      gate.referencesUnsafeFullGateInvocation(diff);
    blocks.push(
      leaky
        ? `### ${file}\n\nNot embedded (it names reviewer output or a gate command). Read it from disk: \`git diff --cached -- ${file}\`.`
        : `### ${file}\n\n\`\`\`diff\n${diff}\n\`\`\``
    );
  }
  return blocks.join('\n\n');
}

function queueSection(queue, status, archiveCount) {
  const group = (code) => queue.filter((f) => status.get(f) === code);
  // One path per line: the gate's leak check is line-based, so several paths on one line
  // (the gate script next to a *.sh or .env file) would read as a gate invocation.
  const fmt = (files) => files.map((f) => `- \`${f}\``).join('\n');
  const lines = [`## Queue (${queue.length} paths, all staged)`];
  for (const [label, code] of [['Deleted', 'D'], ['Added', 'A'], ['Modified', 'M'], ['Type changed', 'T']]) {
    const files = group(code);
    if (files.length) lines.push('', `${label} (${files.length}):`, fmt(files));
  }
  const unchanged = queue.filter((f) => !status.has(f));
  if (unchanged.length) lines.push('', `Unchanged in the index (${unchanged.length}):`, fmt(unchanged));
  if (archiveCount > 0) {
    lines.push(
      '',
      `The index also holds ${archiveCount} staged reviewer archive file(s) under \`.claude/reviews/\` (count from \`git diff --cached --name-only -- .claude/reviews\` when this packet was generated; each reviewer's archive step adds one, so a slightly higher count when you check is expected). They are not queue entries and are not part of \`scope_hash\`. Do not open them.`
    );
  }
  return lines.join('\n');
}

function buildPacket(reviewer, ctx) {
  const { meta, body, scope, reviewId, generatedAt, riskLevel, queue, queueText, diffs } = ctx;
  const name = reviewer === 'codex' ? 'Codex' : 'Antigravity';
  const manifest = [
    '<!-- review-manifest',
    `reviewer: ${reviewer}`,
    `generated_at: ${generatedAt}`,
    `scope_hash: ${scope}`,
    `review_id: ${reviewId}`,
    `risk_level: ${riskLevel}`,
    `runtime_required: ${meta.runtime_required}`,
    'blind_review: true',
    'queue:',
    ...queue.map((q) => `  - ${q}`),
    'diff_base: HEAD',
    `context_tier: ${meta.context_tier}`,
    '-->',
  ].join('\n');
  const verdictFields = [
    `scope_hash: ${scope}`,
    `review_id: ${reviewId}`,
    `risk_level: ${riskLevel}`,
    `runtime_required: ${meta.runtime_required}`,
    'blind_review: true',
    'prior_reviewer_outputs_read: false',
    'evidence_level: 0|1|2|3|4',
    'runtime_evidence: executed|not_applicable|unavailable',
  ].join('\n');
  const verdictForm = [
    '```md',
    `## ${name} Review - ${meta.title}, attempt ${meta.attempt}`,
    '',
    `**VERDICT: ${VERDICTS[reviewer]}**`,
    '',
    verdictFields,
    '',
    '### Reviewed Queue',
    '### Skills Applied',
    ...APPLIED[reviewer],
    ...VERDICT_SECTIONS[reviewer].map((s) => `### ${s}`),
    '```',
  ].join('\n');
  return [
    manifest,
    '',
    `# ${name} Review Packet: ${meta.title}, Attempt ${meta.attempt}`,
    '',
    ROLE[reviewer],
    '',
    '## Required Skills',
    '',
    ...SKILLS[reviewer],
    '',
    queueText,
    '',
    body,
    '',
    '## Blind-Review Rules',
    '',
    "- Exclude `.claude/reviews/**` and every `.claude/*-review-latest.md` file from every repository-wide search, including `rg`, `grep -r`, and `git grep` (for example `rg ... -g '!.claude/reviews/**' -g '!.claude/*-review-latest.md'`). If an unscoped search surfaces archived reviewer text, stop using the result and report it.",
    "- Do not read the other reviewer's packet, verdict, or archives.",
    '- The only gate command you may run is the fingerprint preflight: `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`.',
    '- Read deleted files with `git show HEAD:<path>`.',
    `- ${FOLLOW_UP_RULE}`,
    '',
    '## Staged Diff',
    '',
    diffs,
    '',
    '## Required Verdict Format',
    '',
    `Write to \`.claude/${reviewer}-review-latest.md\`, run \`node .claude/hooks/archive-review-artifact.js ${reviewer}\`, and print the verdict.`,
    '',
    verdictForm,
    '',
  ].join('\n');
}

function validatePacket(reviewer, content, queue) {
  const req = gate.ARTIFACT_REQUIREMENTS.find((r) => r.reviewer === reviewer && !r.verdict);
  const problems = [];
  for (const h of req.headings) if (!content.includes(h)) problems.push(`missing heading "${h}"`);
  for (const t of req.requiredText) if (!content.includes(t)) problems.push(`missing text "${t}"`);
  for (const f of queue) if (!content.includes(f)) problems.push(`does not mention ${f}`);
  const other = reviewer === 'codex' ? 'antigravity' : 'codex';
  if (gate.referencesReviewerOutput(content, other)) problems.push("references the other reviewer's output");
  if (gate.referencesUnsafeFullGateInvocation(content)) problems.push('names the full review gate as something to run');
  return problems;
}

function main() {
  const root = resolveProjectRoot(process.env, process.cwd());
  process.chdir(root);

  const queue = readQueue(root);
  if (queue.length === 0) fail('the review queue is empty.');
  if (!fs.existsSync(CLAIMS_FILE)) fail(`${CLAIMS_FILE} is missing. Write the task's claims there first.`);
  const { meta, body } = parseClaims(fs.readFileSync(CLAIMS_FILE, 'utf8'));

  stageQueue(root);
  const scope = gate.stagedScopeHash(queue);
  const status = stagedStatus(queue);
  const queuedStaged = queue.filter((f) => status.has(f));

  const policyPath = path.join('.claude', 'antigravity-review-policy.json');
  const policy = fs.existsSync(policyPath) ? JSON.parse(fs.readFileSync(policyPath, 'utf8')) : {};
  // Same rule as the gate: low only when the paths qualify AND the claims say low. Claims may
  // escalate a low-path batch to both reviewers; a full-path batch is never labeled low.
  const pathTier = policy.lowRiskCodexOnly === true ? gate.reviewTier(queuedStaged) : 'full';
  const riskLevel = pathTier === 'full' && meta.risk_level === 'low' ? 'medium' : meta.risk_level;
  const tier = pathTier === 'low' && riskLevel === 'low' ? 'low' : 'full';
  const reviewers = tier === 'low' || policy.mode === 'disabled' ? ['codex'] : ['antigravity', 'codex'];

  const now = new Date();
  const generatedAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const reviewId = `rv-${generatedAt.replace(/[-:]/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
  const archiveCount = git(['diff', '--cached', '--name-only', '--', '.claude/reviews']).split('\n').filter(Boolean).length;
  const ctx = {
    meta,
    body,
    scope,
    reviewId,
    generatedAt,
    riskLevel,
    queue,
    queueText: queueSection(queue, status, archiveCount),
    diffs: diffSection(queue, status),
  };

  const packets = reviewers.map((r) => ({ reviewer: r, content: buildPacket(r, ctx) }));
  const problems = packets.flatMap((p) => validatePacket(p.reviewer, p.content, queue).map((x) => `${p.reviewer} packet ${x}`));
  if (problems.length) fail(`no packets written:\n  - ${problems.join('\n  - ')}`);

  for (const p of packets) fs.writeFileSync(path.join('.claude', `${p.reviewer}-prompt-latest.md`), p.content);

  const out = [
    `Packets written for ${queue.length} queued path(s).`,
    `scope_hash: ${scope}`,
    `review_id: ${reviewId}`,
    `tier: ${tier === 'low' ? 'low (Codex only)' : `full (${reviewers.join(' + ')})`}, risk_level: ${riskLevel}`,
    '',
    'Run from the project root:',
  ];
  if (reviewers.includes('antigravity')) {
    out.push(
      '',
      'agy -p "You are Antigravity reviewing Gotta Go. Read .claude/antigravity-prompt-latest.md and .claude/antigravity-review-policy.json in full. Review independently without reading any other reviewer\'s verdict. Apply the packet\'s required skills and evidence contract. Write the verdict to .claude/antigravity-review-latest.md, then run node .claude/hooks/archive-review-artifact.js antigravity, and print the same verdict."'
    );
  }
  out.push(
    '',
    'codex exec --sandbox workspace-write "You are Codex reviewing Gotta Go. Read .claude/codex-prompt-latest.md in full without reading any other reviewer\'s verdict, inspect every queued file and material boundary, satisfy the packet evidence contract, write your verdict to .claude/codex-review-latest.md, run node .claude/hooks/archive-review-artifact.js codex, and print the same verdict."',
    ''
  );
  process.stdout.write(out.join('\n'));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    fail(error.message);
  }
}
