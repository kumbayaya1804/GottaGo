'use strict';

// Guards that the repo stays usable on every dev OS (macOS, Linux, Windows).
// Development moved from Windows to macOS on 2026-09-26; before that, hooks were
// PowerShell-only and docs used `npm.cmd`, absolute `C:\Users\...` paths, and
// PowerShell cmdlets. This test fails if any of that creeps back into ACTIVE
// files. Dated historical records are exempt: rewriting them would falsify
// provenance (see docs/verification.md).
//
// Run: node --test scripts/os-portability.test.js

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');

// Dated records of what actually happened on the original Windows host.
const HISTORICAL_PREFIXES = [
  '.planning/',
  '.claude/reviews/',
  '.beads/issues.jsonl',
  '.beads/interactions.jsonl',
  '.beads/context/execution-state.md',
  '.beads/plans/',
  // Past reviewer prompts/verdicts; regenerated per review round, never hand-edited.
  '.claude/antigravity-prompt-latest.md',
  '.claude/antigravity-review-latest.md',
  '.claude/codex-prompt-latest.md',
  '.claude/codex-review-latest.md',
  '.claude/codex-security-investigation-prompt.md',
];

// Files that legitimately contain Windows-specific strings as code or fixtures.
const LEGITIMATE_WINDOWS_HANDLING = new Set([
  'scripts/os-portability.test.js', // this file names the forbidden patterns
  'supabase/scripts/run-isolated-db-suite.js', // real win32 branch for the npm .cmd shim
  'supabase/scripts/run-isolated-db-suite.test.js', // Windows-only tests (skipped elsewhere)
  '.claude/hooks/harness-hooks.test.js', // Windows path fixtures prove they are never queued
  '.claude/hooks/check-review-artifacts.test.js', // Windows sh.exe fallback fixtures
]);

const FORBIDDEN = [
  { name: 'PowerShell hook shell', pattern: /"shell"\s*:\s*"powershell"/i },
  { name: 'PowerShell code fence', pattern: /^\s*```(powershell|ps1|pwsh)\s*$/im },
  { name: 'npm.cmd used as the command', pattern: /(^|&&\s*|\|\|\s*)npm\.cmd\s/im },
  { name: 'PowerShell cmdlet used as the command', pattern: /^\s*(\$\w+\s*=\s*)?(Get-Content|Set-Location|Test-Path|New-Item|Add-Content|Get-Item)\b/m },
  { name: 'absolute Windows user path', pattern: /[A-Za-z]:(\\{1,2}|\/)Users(\\{1,2}|\/)/i },
  { name: 'absolute POSIX home path', pattern: /(^|[\s"'`(=:])\/(Users|home)\/[^/\s]+\// },
  { name: 'absolute file:/// Windows URL', pattern: /file:\/\/\/[A-Za-z]:\//i },
];

const TEXT_EXTENSIONS = /\.(md|js|ts|tsx|json|jsonc|yml|yaml|toml|sql|txt|sh)$|(^|\/)(\.gitignore|\.gitattributes|\.editorconfig)$/;

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function isHistorical(file) {
  return HISTORICAL_PREFIXES.some((prefix) => file === prefix || file.startsWith(prefix));
}

function activeTextFiles() {
  return trackedFiles().filter(
    (file) =>
      TEXT_EXTENSIONS.test(file) &&
      !isHistorical(file) &&
      !file.includes('node_modules/') &&
      fs.existsSync(path.join(REPO_ROOT, file)),
  );
}

test('active files contain no OS-specific commands, shells, or absolute machine paths', () => {
  const violations = [];
  for (const file of activeTextFiles()) {
    if (LEGITIMATE_WINDOWS_HANDLING.has(file)) continue;
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    for (const { name, pattern } of FORBIDDEN) {
      const match = content.match(pattern);
      if (match) {
        const line = content.slice(0, match.index).split('\n').length;
        violations.push(`${file}:${line}  ${name}: ${match[0].trim()}`);
      }
    }
  }
  assert.deepEqual(violations, [], `OS-specific content found in active files:\n  ${violations.join('\n  ')}`);
});

test('no tracked text file has CRLF line endings (review scope_hash binds to exact bytes)', () => {
  const crlf = activeTextFiles().filter((file) =>
    fs.readFileSync(path.join(REPO_ROOT, file)).includes(Buffer.from('\r\n')),
  );
  assert.deepEqual(crlf, []);
});

test('.gitattributes pins LF line endings for every checkout', () => {
  const attrs = fs.readFileSync(path.join(REPO_ROOT, '.gitattributes'), 'utf8');
  assert.match(attrs, /^\*\s+text=auto\s+eol=lf\s*$/m);
});

test('the forbidden patterns actually catch the Windows-isms they target (guards against a silently broken regex)', () => {
  const samples = {
    'PowerShell hook shell': '"shell": "powershell",',
    'PowerShell code fence': '```powershell',
    'npm.cmd used as the command': 'cd app && npm.cmd test',
    'PowerShell cmdlet used as the command': '$files = Get-Content .claude/review-queue.txt',
    'absolute Windows user path': 'C:\\Users\\mrsai\\Gotta Go',
    'absolute POSIX home path': 'cd /Users/someone/GottaGo',
    'absolute file:/// Windows URL': '(file:///C:/Users/mrsai/x.md)',
  };
  for (const { name, pattern } of FORBIDDEN) {
    assert.match(samples[name], pattern, name);
  }
  // Variants that must not slip past: casing, forward-slash drive paths, POSIX home dirs.
  const variants = [
    ['npm.cmd used as the command', 'cd app && NPM.CMD test'],
    ['absolute Windows user path', 'C:/Users/mrsai/Gotta Go'],
    ['absolute POSIX home path', 'cd /Users/someone/GottaGo'],
    ['absolute POSIX home path', 'see /home/someone/GottaGo/app'],
  ];
  for (const [name, sample] of variants) {
    const rule = FORBIDDEN.find((entry) => entry.name === name);
    assert.ok(rule, `rule exists: ${name}`);
    assert.match(sample, rule.pattern, `${name} catches ${sample}`);
  }
  // Home-relative and repo-relative paths stay allowed.
  for (const allowed of ['~/GottaGo-savepoints/x', 'app/Users/list.tsx', 'src/home/screen.tsx']) {
    for (const { pattern } of FORBIDDEN) assert.doesNotMatch(allowed, pattern);
  }
  // Prose that merely mentions the Windows fallback must stay allowed.
  const prose = 'On Windows PowerShell only, substitute `npm.cmd` for `npm`.';
  for (const { pattern } of FORBIDDEN) assert.doesNotMatch(prose, pattern);
});
