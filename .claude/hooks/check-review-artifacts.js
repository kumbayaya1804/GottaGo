#!/usr/bin/env node
/**
 * Pre-commit gate for the Antigravity + Codex review artifacts.
 *
 * If staged files intersect .claude/review-queue.txt, this blocks the commit
 * unless current prompt packets and review verdicts appear to match that scope.
 * It is still not a quality check, but it now catches the common stale-artifact
 * failure mode instead of checking headings only.
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
    .map((line) => line.trim())
    .filter(Boolean);
}

function readFileSafe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function includesAll(content, values) {
  return values.filter((value) => !content.includes(value));
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
    .map((line) => line.trim())
    .filter(Boolean);
} catch (error) {
  console.error('check-review-artifacts: could not read staged files (' + error.message + '), skipping check');
  process.exit(0);
}

const queuedStagedFiles = staged.filter((file) => queue.has(file));
if (queuedStagedFiles.length === 0) {
  process.exit(0);
}

const REQUIRED = [
  {
    file: path.join('.claude', 'antigravity-prompt-latest.md'),
    label: 'Antigravity prompt packet',
    headings: ['Runtime Boundary And Mock Audit'],
    requiredText: ['review-manifest', 'reviewer: antigravity'],
    verdict: false,
  },
  {
    file: path.join('.claude', 'codex-prompt-latest.md'),
    label: 'Codex prompt packet',
    headings: ['Runtime Boundary And Mock Audit'],
    requiredText: ['review-manifest', 'reviewer: codex'],
    verdict: false,
  },
  {
    file: path.join('.claude', 'antigravity-review-latest.md'),
    label: 'Antigravity review verdict',
    headings: ['Runtime Boundary Check'],
    requiredText: ['VERDICT: APPROVE'],
    verdict: true,
  },
  {
    file: path.join('.claude', 'codex-review-latest.md'),
    label: 'Codex review verdict',
    headings: ['Runtime Boundary Check'],
    requiredText: ['VERDICT: APPROVE'],
    verdict: true,
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

if (failed) {
  console.error('');
  console.error('Regenerate reviewer packets and verdicts for the current .claude/review-queue.txt scope.');
  console.error('Prompt packets must include a review-manifest. Verdicts must be APPROVE and mention the staged queued files.');
  console.error('');
  process.exit(1);
}

process.exit(0);
