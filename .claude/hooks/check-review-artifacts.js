#!/usr/bin/env node
/**
 * Pre-commit gate: blocks a commit if it stages files that are currently in
 * .claude/review-queue.txt but the reviewer packets/verdicts don't carry the
 * runtime-boundary and mock-boundary sections required by docs/agent-harness.md
 * "Prompt Packet Requirements" and the CODEX.md/ANTIGRAVITY.md Review Output formats.
 *
 * This is a presence check, not a quality check — it proves the required section
 * exists, not that the analysis in it is correct. It exists to catch the "skipped
 * the step entirely" failure mode, which review packets don't self-report.
 *
 * Scoped to the intersection of staged files and review-queue.txt so it stays a
 * no-op for commits that don't touch anything pending review (docs-only changes,
 * bookkeeping files, etc).
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function readFileSafe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

const queueFile = path.join('.claude', 'review-queue.txt');
const queue = new Set(readLines(queueFile));

if (queue.size === 0) {
  process.exit(0);
}

let staged;
try {
  staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
} catch (e) {
  console.error('check-review-artifacts: could not read staged files (' + e.message + '), skipping check');
  process.exit(0);
}

const touchesReviewedFiles = staged.some((f) => queue.has(f));
if (!touchesReviewedFiles) {
  process.exit(0);
}

const REQUIRED = [
  {
    file: path.join('.claude', 'antigravity-prompt-latest.md'),
    label: 'Antigravity prompt packet',
    headings: ['Runtime Boundary And Mock Audit'],
  },
  {
    file: path.join('.claude', 'codex-prompt-latest.md'),
    label: 'Codex prompt packet',
    headings: ['Runtime Boundary And Mock Audit'],
  },
  {
    file: path.join('.claude', 'antigravity-review-latest.md'),
    label: 'Antigravity review verdict',
    headings: ['Runtime Boundary Check'],
  },
  {
    file: path.join('.claude', 'codex-review-latest.md'),
    label: 'Codex review verdict',
    headings: ['Runtime Boundary Check'],
  },
];

let failed = false;
for (const req of REQUIRED) {
  const content = readFileSafe(req.file);
  if (content === null) {
    console.error(
      'BLOCKED: ' + req.label + ' is missing (' + req.file + ') but staged files are in the active review queue.'
    );
    failed = true;
    continue;
  }
  for (const heading of req.headings) {
    if (!content.includes(heading)) {
      console.error(
        'BLOCKED: ' + req.label + ' (' + req.file + ') is missing the required "' + heading + '" section.'
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error('');
  console.error(
    'Per docs/agent-harness.md "Prompt Packet Requirements" and the CODEX.md/ANTIGRAVITY.md Review Output'
  );
  console.error(
    'formats, every reviewer packet and verdict must include runtime-boundary and mock-boundary context.'
  );
  console.error('Regenerate the missing artifact(s) before committing files in .claude/review-queue.txt.');
  console.error('');
  console.error('This check only confirms the section is present, not that its content is correct.');
  process.exit(1);
}

process.exit(0);
