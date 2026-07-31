#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Archives are tracked audit history (docs/agent-harness.md), and the gate now
// requires the archive blob to be present in the Git index — working-tree
// existence alone previously satisfied it, so the "committed history" promise
// was never enforced (2026-07-30 round-2 finding). Stage it here so the
// documented workflow actually produces a committable archive.
function stageArchive(archivePath) {
  try {
    execFileSync('git', ['add', '--', archivePath.split(path.sep).join('/')], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return true;
  } catch (error) {
    console.error('WARNING: archived the verdict but could not stage it: ' + archivePath);
    console.error('Stage it manually — the review gate requires the archive to be in the commit.');
    return false;
  }
}

const reviewer = process.argv[2];
const artifacts = {
  antigravity: path.join('.claude', 'antigravity-review-latest.md'),
  codex: path.join('.claude', 'codex-review-latest.md'),
};

if (!Object.hasOwn(artifacts, reviewer)) {
  console.error('Usage: node .claude/hooks/archive-review-artifact.js antigravity|codex');
  process.exit(2);
}

const source = artifacts[reviewer];
if (!fs.existsSync(source)) {
  console.error(`BLOCKED: review artifact is missing: ${source}`);
  process.exit(1);
}

const content = fs.readFileSync(source, 'utf8');
const scopeMatch = content.match(/^scope_hash:\s*sha256:([a-f0-9]{64})\s*$/im);
if (!scopeMatch) {
  console.error(`BLOCKED: ${source} has no valid scope_hash.`);
  process.exit(1);
}

const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
const archiveDir = path.join('.claude', 'reviews', scopeMatch[1].toLowerCase(), reviewer);
const archivePath = path.join(archiveDir, `${contentHash}.md`);
fs.mkdirSync(archiveDir, { recursive: true });

if (fs.existsSync(archivePath)) {
  const archived = fs.readFileSync(archivePath, 'utf8');
  if (archived !== content) {
    console.error(`BLOCKED: archive digest collision or altered archive: ${archivePath}`);
    process.exit(1);
  }
  stageArchive(archivePath);
  console.log(archivePath.replaceAll(path.sep, '/'));
  process.exit(0);
}

fs.writeFileSync(archivePath, content, { encoding: 'utf8', flag: 'wx' });
stageArchive(archivePath);
console.log(archivePath.replaceAll(path.sep, '/'));
