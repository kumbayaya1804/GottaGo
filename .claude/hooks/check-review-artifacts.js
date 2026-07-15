#!/usr/bin/env node
/**
 * Pre-commit gate for the Antigravity + Codex review artifacts.
 *
 * Two checks:
 *
 * A. Staged files that appear in .claude/review-queue.txt must be covered by
 *    current prompt packets and APPROVE verdicts (freshness + scope match).
 *
 * B. Staged files matching review-required path rules must appear in
 *    .claude/review-queue.txt at all. This closes the stale-queue bypass
 *    (2026-07-08): previously the gate scoped itself to `staged ∩ queue`, so a
 *    queue that was never updated for the current work made the gate pass
 *    vacuously. The gate now derives its own scope from the staged change set
 *    instead of trusting the hand-maintained queue to be complete.
 *
 * Escape hatch for check B only (user-approved trivial changes):
 *   REVIEW_GATE_ALLOW_UNREVIEWED=1 git commit ...
 * Check A has no escape hatch — if a file is queued, its artifacts must match.
 *
 * It is still not a quality check; it catches stale/missing-artifact and
 * missing-queue-entry failure modes.
 */
'use strict';

const { execSync } = require('child_process');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Paths whose staged changes REQUIRE a review-queue entry (check B). Planning
// and beads state (.planning/**, .beads/**) are deliberately excluded: GSD
// commits those on every plan execution and they may still be queued
// voluntarily (check A covers them when they are).
const REVIEW_REQUIRED_PATTERNS = [
  /^app\//,
  /^supabase\//,
  /^docs\//,
  /^\.claude\/(commands|hooks|skills|tdd-guard)\//,
  /^\.claude\/settings\.json$/,
  /^(SPEC|CODEX|ANTIGRAVITY|CLAUDE|AGENTS)\.md$/,
];

function requiresReview(file) {
  return REVIEW_REQUIRED_PATTERNS.some((re) => re.test(file));
}

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readFileSafe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function includesAll(content, values) {
  return values.filter((value) => !content.includes(value));
}

function stagedScopeHash(files) {
  const hash = crypto.createHash('sha256');
  for (const file of [...files].sort()) {
    let descriptor;
    try {
      const entry = execFileSync('git', ['ls-files', '--stage', '--', file], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      descriptor = entry || 'DELETED';
    } catch (error) {
      throw new Error('could not inspect staged scope entry ' + file + ' (' + error.message + ')');
    }
    hash.update(file + '\0' + descriptor + '\n', 'utf8');
  }
  return 'sha256:' + hash.digest('hex');
}

function artifactScopeHash(content) {
  const match = content.match(/^scope_hash:\s*(sha256:[a-f0-9]{64})\s*$/im);
  return match ? match[1].toLowerCase() : null;
}

function artifactVerdicts(content) {
  const verdicts = [];
  const pattern = /^\s*(?:\*\*)?VERDICT:\s*(APPROVE|REQUEST CHANGES|BLOCK)(?:\*\*)?\s*$/gim;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    verdicts.push(match[1].toUpperCase());
  }
  return verdicts;
}

const queueFile = path.join('.claude', 'review-queue.txt');
const queueEntries = readLines(queueFile);
const queue = new Set(queueEntries);

if (process.argv.includes('--print-staged-scope-hash')) {
  try {
    console.log(stagedScopeHash(queueEntries));
    process.exit(0);
  } catch (error) {
    console.error('BLOCKED: ' + error.message);
    process.exit(1);
  }
}

let staged;
try {
  staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
} catch (error) {
  console.error('BLOCKED: check-review-artifacts could not read staged files (' + error.message + ').');
  console.error('The review gate fails closed when the staged index cannot be inspected.');
  process.exit(1);
}

let failed = false;

// ─── Check B: staged review-required files must be queued ────────────────────
const unqueuedReviewable = staged.filter((file) => requiresReview(file) && !queue.has(file));
if (unqueuedReviewable.length > 0) {
  if (process.env.REVIEW_GATE_ALLOW_UNREVIEWED === '1') {
    console.error(
      'check-review-artifacts: WARNING — committing review-required file(s) without a queue entry (REVIEW_GATE_ALLOW_UNREVIEWED=1): ' +
        unqueuedReviewable.join(', ')
    );
  } else {
    console.error(
      'BLOCKED: staged file(s) match review-required paths but are missing from .claude/review-queue.txt: ' +
        unqueuedReviewable.join(', ')
    );
    console.error(
      'Add them to the queue and regenerate reviewer packets, or (with explicit user approval only) set REVIEW_GATE_ALLOW_UNREVIEWED=1.'
    );
    failed = true;
  }
}

// ─── Check A: queued staged files must be covered by fresh artifacts ─────────
const queuedStagedFiles = staged.filter((file) => queue.has(file));

if (queuedStagedFiles.length > 0) {
  let expectedScopeHash;
  try {
    expectedScopeHash = stagedScopeHash(queueEntries);
  } catch (error) {
    console.error('BLOCKED: review scope fingerprint failed (' + error.message + ').');
    failed = true;
  }

  const REQUIRED = [
    {
      file: path.join('.claude', 'antigravity-prompt-latest.md'),
      label: 'Antigravity prompt packet',
      headings: ['Required Skills', 'Runtime Boundary And Mock Audit', 'Claim And State Audit'],
      requiredText: [
        'review-manifest',
        'reviewer: antigravity',
        '.claude/skills/artifact_qa_gate.md',
        'Antigravity Overlay',
        'superpowers:using-superpowers',
        'superpowers:verification-before-completion',
      ],
      verdict: false,
    },
    {
      file: path.join('.claude', 'codex-prompt-latest.md'),
      label: 'Codex prompt packet',
      headings: ['Required Skills', 'Runtime Boundary And Mock Audit'],
      requiredText: [
        'review-manifest',
        'reviewer: codex',
        '.claude/skills/artifact_qa_gate.md',
        'Codex Overlay',
      ],
      verdict: false,
    },
    {
      file: path.join('.claude', 'antigravity-review-latest.md'),
      label: 'Antigravity review verdict',
      headings: ['Skills Applied', 'Runtime Boundary Check', 'Claim And State Audit'],
      requiredText: [
        '.claude/skills/artifact_qa_gate.md',
        'Antigravity Overlay',
        'superpowers:using-superpowers',
        'superpowers:verification-before-completion',
      ],
      verdict: true,
    },
    {
      file: path.join('.claude', 'codex-review-latest.md'),
      label: 'Codex review verdict',
      headings: ['Skills Applied', 'Runtime Boundary Check'],
      requiredText: ['.claude/skills/artifact_qa_gate.md', 'Codex Overlay'],
      verdict: true,
    },
  ];

  for (const req of REQUIRED) {
    const content = readFileSafe(req.file);
    if (content === null) {
      console.error(
        'BLOCKED: ' + req.label + ' is missing (' + req.file + ') but staged files are in the active review queue.'
      );
      failed = true;
      continue;
    }

    const declaredScopeHash = artifactScopeHash(content);
    if (declaredScopeHash === null) {
      console.error(
        'BLOCKED: ' + req.label + ' (' + req.file + ') is missing a valid scope_hash fingerprint.'
      );
      failed = true;
    } else if (expectedScopeHash && declaredScopeHash !== expectedScopeHash) {
      console.error(
        'BLOCKED: ' +
          req.label +
          ' (' +
          req.file +
          ') scope_hash does not match the current staged queue bytes. Expected ' +
          expectedScopeHash +
          ', found ' +
          declaredScopeHash +
          '.'
      );
      failed = true;
    }

    if (req.verdict) {
      const verdicts = artifactVerdicts(content);
      if (verdicts.length === 0) {
        console.error(
          'BLOCKED: ' + req.label + ' (' + req.file + ') is missing one valid verdict declaration.'
        );
        failed = true;
      } else if (verdicts.length > 1) {
        console.error(
          'BLOCKED: ' + req.label + ' (' + req.file + ') contains multiple verdict declarations: ' + verdicts.join(', ') + '.'
        );
        failed = true;
      } else if (verdicts[0] !== 'APPROVE') {
        console.error(
          'BLOCKED: ' + req.label + ' (' + req.file + ') declares verdict ' + verdicts[0] + ', not APPROVE.'
        );
        failed = true;
      }
    }

    for (const heading of req.headings) {
      if (!content.includes(heading)) {
        console.error(
          'BLOCKED: ' + req.label + ' (' + req.file + ') is missing the required "' + heading + '" section.'
        );
        failed = true;
      }
    }

    for (const required of req.requiredText) {
      if (!content.includes(required)) {
        console.error(
          'BLOCKED: ' + req.label + ' (' + req.file + ') is missing required freshness text: ' + required
        );
        failed = true;
      }
    }

    const missingFiles = includesAll(content, queuedStagedFiles);
    if (missingFiles.length > 0) {
      console.error(
        'BLOCKED: ' +
          req.label +
          ' (' +
          req.file +
          ') does not mention staged queued file(s): ' +
          missingFiles.join(', ')
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error('');
  console.error('Regenerate reviewer packets and verdicts for the current .claude/review-queue.txt scope.');
  console.error('Prompt packets must include a review-manifest, Required Skills, and the current staged scope_hash. Verdicts must be APPROVE, repeat that scope_hash, identify Skills Applied, and mention the staged queued files.');
  console.error('');
  process.exit(1);
}

process.exit(0);
