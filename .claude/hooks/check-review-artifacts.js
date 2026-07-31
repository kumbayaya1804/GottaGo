#!/usr/bin/env node
/**
 * Pre-commit gate for the Antigravity + Codex review artifacts.
 *
 * Two checks:
 *
 * A. Staged files that appear in .claude/review-queue.txt must be covered by
 *    current prompt packets and policy-valid verdicts (freshness + scope match).
 *
 * B. Staged files matching review-required path rules must appear in
 *    .claude/review-queue.txt at all. This closes the stale-queue bypass
 *    (2026-07-08): previously the gate scoped itself to `staged ∩ queue`, so a
 *    queue that was never updated for the current work made the gate pass
 *    vacuously. The gate now derives its own scope from the staged change set
 *    instead of trusting the hand-maintained queue to be complete.
 *
 * REVIEW_GATE_ALLOW_UNREVIEWED is rejected for protected paths. A focused or
 * named verdict cannot substitute for the canonical current-scope artifacts.
 *
 * Structural checks cannot establish reviewer quality, but they do enforce
 * probation, blind-review metadata, evidence floors, and immutable history.
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
  /^\.claude\/antigravity-(review-policy|calibration-contract)\.json$/,
  /^\.claude\/settings\.json$/,
  /^(SPEC|CODEX|ANTIGRAVITY|CLAUDE|AGENTS)\.md$/,
  // The pre-commit wrapper is the gate's actual caller. A change there can
  // disable every check below, so it is protected like the gate itself.
  /^\.beads\/hooks\//,
];

// Policy/calibration state whose staged deletion would silently weaken the
// gate on the NEXT commit. Removing them is never an ordinary edit.
const POLICY_STATE_PATHS = [
  '.claude/antigravity-review-policy.json',
  '.claude/antigravity-calibration-contract.json',
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
  const pattern = /^\s*(?:\*\*)?VERDICT:\s*(APPROVE|ADVISORY|REQUEST CHANGES|BLOCK)(?:\*\*)?\s*$/gim;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    verdicts.push(match[1].toUpperCase());
  }
  return verdicts;
}

function artifactField(content, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp('^' + escaped + ':\\s*([^\\r\\n]+?)\\s*$', 'im'));
  return match ? match[1].trim() : null;
}

function readPolicy() {
  const policyPath = path.join('.claude', 'antigravity-review-policy.json');
  if (!fs.existsSync(policyPath)) {
    // FAIL CLOSED (2026-07-30 review finding). This previously returned a
    // permissive default (active mode, approvalAuthority, every evidence and
    // archive check disabled), so deleting or renaming one file silently
    // restored the exact regime the policy exists to constrain. Absence of
    // policy is now an error, not an implicit grant of authority.
    throw new Error(
      'review policy is missing (' +
        policyPath +
        '); the gate fails closed rather than defaulting to permissive review settings'
    );
  }

  let policy;
  try {
    policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  } catch (error) {
    throw new Error('invalid Antigravity review policy (' + error.message + ')');
  }

  if (!['active', 'probation', 'disabled'].includes(policy.mode)) {
    throw new Error('Antigravity review policy mode must be active, probation, or disabled');
  }
  if (policy.mode === 'active' && (policy.approvalAuthority !== true || policy.calibrationStatus !== 'passed')) {
    throw new Error('Antigravity active mode requires approvalAuthority=true and calibrationStatus=passed');
  }
  if (policy.mode === 'probation' && policy.approvalAuthority !== false) {
    throw new Error('Antigravity probation mode requires approvalAuthority=false');
  }
  if (policy.mode === 'active') {
    validateCalibration(policy);
  }
  return policy;
}

function readRepoJson(relativePath, label) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    throw new Error(label + ' path is missing');
  }
  const root = path.resolve('.');
  const resolved = path.resolve(relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(label + ' path escapes the repository');
  }
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error('could not read ' + label + ' (' + error.message + ')');
  }
}

function isSha256Hex(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isIsoTimestamp(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function resolveInRepo(relativePath, label) {
  const root = path.resolve('.');
  const resolved = path.resolve(relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(label + ' escapes the repository');
  }
  return resolved;
}

function validateCalibration(policy) {
  const contract = readRepoJson(policy.calibrationContract, 'calibration contract');
  const evidence = readRepoJson(policy.calibrationEvidence, 'calibration evidence');
  const requiredCases = Array.isArray(contract.requiredCases) ? contract.requiredCases : [];
  const results = Array.isArray(evidence.results) ? evidence.results : [];

  if (evidence.contractVersion !== contract.version) {
    throw new Error('calibration evidence does not match the active contract version');
  }
  if (contract.requireBlindInputs === true && (evidence.blindInputs !== true || evidence.reviewerOutputsWithheld !== true)) {
    throw new Error('calibration evidence does not attest blind inputs and withheld reviewer outputs');
  }
  if (!Number.isInteger(evidence.independentRuns) || evidence.independentRuns < contract.minimumIndependentRuns) {
    throw new Error('calibration evidence has too few independent runs');
  }
  if (!Number.isInteger(evidence.falseApprovals) || evidence.falseApprovals > contract.maximumFalseApprovals) {
    throw new Error('calibration evidence exceeds the false-approval limit');
  }

  // The contract must state which archived verdict tokens are consistent with a
  // passing row. Without this, any parseable verdict satisfied a passed:true
  // claim — VERDICT: BLOCK included (2026-07-30 round-3 finding).
  const passingVerdicts = Array.isArray(contract.passingVerdicts)
    ? contract.passingVerdicts.map((value) => String(value).toUpperCase())
    : null;
  if (!passingVerdicts || passingVerdicts.length === 0) {
    throw new Error(
      'calibration contract does not declare passingVerdicts; the gate fails closed rather than accepting any verdict token as passing'
    );
  }

  // Receipts (2026-07-30 review finding). Previously a self-asserted
  // `{ caseId, passed: true }` row was sufficient, so restoring approval
  // authority required only writing a short JSON file by hand. ANTIGRAVITY.md's
  // "Calibration Exit Gate" requires model identity, prompt hashes, verdict
  // archive paths, commands and timestamps — enforce them, and bind each row to
  // a real content-addressed archive so a passing claim cannot be fabricated
  // without also producing the immutable verdict it refers to.
  const runIds = new Set();
  const seenPairs = new Set();
  const seenArchives = new Set();
  for (const result of results) {
    if (!result || typeof result !== 'object') {
      throw new Error('calibration evidence contains a malformed result row');
    }
    if (!isNonEmptyString(result.caseId)) {
      throw new Error('calibration evidence contains a result row without a caseId');
    }
    if (result.passed !== true) continue;

    const where = 'calibration result "' + result.caseId + '"';
    if (!isNonEmptyString(result.runId)) throw new Error(where + ' is missing runId');
    if (!isNonEmptyString(result.model)) throw new Error(where + ' is missing model');
    if (!isNonEmptyString(result.command)) throw new Error(where + ' is missing command');
    if (!isSha256Hex(result.promptSha256)) throw new Error(where + ' is missing a valid promptSha256');
    if (!isIsoTimestamp(result.timestamp)) throw new Error(where + ' is missing a valid ISO timestamp');
    if (!isNonEmptyString(result.verdictArchive)) throw new Error(where + ' is missing verdictArchive');
    if (!isNonEmptyString(result.promptPath)) throw new Error(where + ' is missing promptPath');

    const pairKey = result.caseId + '\0' + result.runId;
    if (seenPairs.has(pairKey)) {
      throw new Error(where + ' duplicates an existing (caseId, runId) pair: ' + result.runId);
    }
    seenPairs.add(pairKey);

    // The prompt must be a real file whose bytes hash to the declared value, so
    // promptSha256 cannot be an arbitrary 64-hex string.
    const promptResolved = resolveInRepo(result.promptPath, where + ' promptPath');
    if (!fs.existsSync(promptResolved)) {
      throw new Error(where + ' promptPath does not exist: ' + result.promptPath);
    }
    const promptDigest = crypto
      .createHash('sha256')
      .update(fs.readFileSync(promptResolved, 'utf8'), 'utf8')
      .digest('hex');
    if (promptDigest !== result.promptSha256.toLowerCase()) {
      throw new Error(where + ' promptSha256 does not match the bytes at ' + result.promptPath);
    }

    const archiveResolved = resolveInRepo(result.verdictArchive, where + ' verdictArchive');
    if (!fs.existsSync(archiveResolved)) {
      throw new Error(where + ' verdictArchive does not exist: ' + result.verdictArchive);
    }
    const archived = fs.readFileSync(archiveResolved, 'utf8');
    const digest = crypto.createHash('sha256').update(archived, 'utf8').digest('hex');
    if (path.basename(archiveResolved).toLowerCase() !== digest + '.md') {
      throw new Error(where + ' verdictArchive is not content-addressed: ' + result.verdictArchive);
    }

    // Every row must cite its OWN archive. Reusing one file across rows was the
    // demonstrated round-2 bypass: ten rows pointed at a single unrelated
    // content-addressed file and active mode was granted.
    const archiveKey = canonicalizePathText(result.verdictArchive);
    if (seenArchives.has(archiveKey)) {
      throw new Error(where + ' reuses a verdictArchive already cited by another row: ' + result.verdictArchive);
    }
    seenArchives.add(archiveKey);

    // The archive must live where reviewer verdicts live, and must actually be a
    // verdict for THIS case — not arbitrary text that happens to be
    // content-addressed.
    if (!/^\.claude\/reviews\/[a-f0-9]{64}\/antigravity\//.test(canonicalizePathText(result.verdictArchive))) {
      throw new Error(
        where + ' verdictArchive is not an Antigravity verdict archive path: ' + result.verdictArchive
      );
    }
    const archiveVerdicts = artifactVerdicts(archived);
    if (archiveVerdicts.length === 0) {
      throw new Error(where + ' verdictArchive contains no parseable VERDICT declaration');
    }
    if (archiveVerdicts.length > 1) {
      throw new Error(
        where + ' verdictArchive contains multiple verdict declarations: ' + archiveVerdicts.join(', ')
      );
    }
    if (!passingVerdicts.includes(archiveVerdicts[0])) {
      throw new Error(
        where +
          ' verdictArchive declares verdict ' +
          archiveVerdicts[0] +
          ', which is not an accepted passing verdict for this contract'
      );
    }
    if (!archived.includes(result.caseId)) {
      throw new Error(where + ' verdictArchive does not reference the case it certifies');
    }

    runIds.add(result.runId);
  }

  // Counts are derived from verified receipts, not trusted from the header.
  if (runIds.size !== evidence.independentRuns) {
    throw new Error(
      'calibration evidence declares ' +
        evidence.independentRuns +
        ' independent runs but its verified receipts contain ' +
        runIds.size
    );
  }

  for (const caseId of requiredCases) {
    const passing = results.filter((entry) => entry && entry.caseId === caseId && entry.passed === true);
    if (passing.length === 0) {
      throw new Error('calibration case did not pass: ' + caseId);
    }
    const caseRuns = new Set(passing.map((entry) => entry.runId));
    if (caseRuns.size < contract.minimumIndependentRuns) {
      throw new Error(
        'calibration case lacks ' + contract.minimumIndependentRuns + ' independent runs: ' + caseId
      );
    }
  }

  if (runIds.size < contract.minimumIndependentRuns) {
    throw new Error('calibration evidence has too few distinct run identities');
  }
}

// The archive must live at its own content address, not merely somewhere in the
// reviewer's directory. Scanning every *.md for matching text (the prior
// behavior, 2026-07-30 review finding) accepted arbitrarily-named files, so the
// "content-addressed immutable history" guarantee was only a convention that
// archive-review-artifact.js happened to follow — nothing verified it.
function hasArchivedCopy(content, scopeHash, reviewer) {
  if (!scopeHash) return false;
  const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  const archivePath = path.join(
    '.claude',
    'reviews',
    scopeHash.slice('sha256:'.length),
    reviewer,
    contentHash + '.md'
  );
  if (!fs.existsSync(archivePath)) return false;
  if (fs.readFileSync(archivePath, 'utf8') !== content) return false;
  // The archive must also be IN THE COMMIT. Working-tree existence alone let the
  // promised audit history stay untracked forever (2026-07-30 round-2 finding),
  // which silently contradicted docs/agent-harness.md's retention rule. The
  // index entry covers both a freshly staged archive and one already committed
  // unchanged in an earlier commit. Comparison is by blob OID, not raw bytes:
  // under core.autocrlf=true `git add` stores a CRLF verdict LF-normalized, so
  // raw index bytes can never equal working-tree bytes for such a file and the
  // old equality check blocked every legitimate CRLF archive (2026-07-30
  // round-3 finding). `git hash-object` applies the same clean filters `git
  // add` does, so OID equality proves the commit records exactly this file.
  const stagedOid = stagedBlobOid(archivePath);
  return stagedOid !== null && stagedOid === workingTreeBlobOid(archivePath);
}

// Detects a reference to the OTHER reviewer's actual verdict output: the
// `<reviewer>-review-latest.md` artifact, or a concrete archived verdict under
// .claude/reviews/<scope>/<reviewer>/. Separators are normalized and matching is
// case-insensitive so a Windows-style `.claude\codex-review-latest.md` cannot
// slip past (2026-07-30 review finding: the old check was a forward-slash-only
// substring test). Policy and config filenames that merely share the
// `<reviewer>-review` prefix — notably .claude/antigravity-review-policy.json,
// which packets are REQUIRED to name when it is queued — are deliberately not
// matched; treating them as exposure made a compliant packet impossible to write.
// Canonicalize path-like text before scanning. Lowercasing and swapping
// separators is not enough: `.claude//reviews/<scope>/codex/x.md` and
// `.claude/./reviews/...` and `a/../.claude/reviews/...` all resolve to the same
// location on disk but evaded a naive match (2026-07-30 round-2 finding, proven
// with an executed counterexample). Percent-encoded separators are decoded for
// the same reason.
// Named CommonMark/HTML5 character references. Round 4 hand-picked 5 names
// (amp/period/sol/bsol/colon); round 5's review found that hand-picking left
// `&percnt;` (-> '%') out, which composes with the fixed-point percent decoder
// to reveal %2e/%2f — a real, executed bypass. Round 6 replaced the 5-name
// table with what was believed to be the full WHATWG HTML5 category of named
// references whose value is a single ASCII punctuation/control character
// (https://html.spec.whatwg.org/entities.json, filtered to non-alphanumeric
// code points) — but a second manual miscount still shipped only 40 of the 41
// names in that category, missing `underbar` (-> '_'); round 7's review found
// it with an exact programmatic diff against the live spec, not a spot-check.
// The 41 entries below are verified against that source as of 2026-07-30
// (`check-review-artifacts.test.js`'s completeness test pins the exact
// key->value pairs so a future accidental deletion or typo is caught locally
// without needing live network access at test or gate-run time). This is not
// a standing guarantee that WHATWG will never add another such name — re-diff
// against the live spec if this category is suspected to have grown.
// Multi-character/non-ASCII named references (e.g. &copy;, &alpha;) are
// excluded as irrelevant to path/filename syntax.
const NAMED_CHARACTER_REFERENCES = {
  tab: '\t',
  newline: '\n',
  excl: '!',
  quot: '"',
  num: '#',
  dollar: '$',
  percnt: '%',
  amp: '&',
  apos: "'",
  lpar: '(',
  rpar: ')',
  ast: '*',
  midast: '*',
  plus: '+',
  comma: ',',
  period: '.',
  sol: '/',
  colon: ':',
  semi: ';',
  lt: '<',
  equals: '=',
  gt: '>',
  quest: '?',
  commat: '@',
  lsqb: '[',
  lbrack: '[',
  bsol: '\\',
  rsqb: ']',
  rbrack: ']',
  hat: '^',
  lowbar: '_',
  underbar: '_',
  grave: '`',
  diacriticalgrave: '`',
  lcub: '{',
  lbrace: '{',
  verbar: '|',
  vert: '|',
  verticalline: '|',
  rcub: '}',
  rbrace: '}',
};

function decodeCharacterReferencesOnce(text) {
  let out = text.replace(/&#([0-9]+);/g, (m, dec) => {
    const code = parseInt(dec, 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
  out = out.replace(/&#x([0-9a-f]+);/gi, (m, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
  out = out.replace(/&([a-z]+);/gi, (m, name) => {
    const literal = NAMED_CHARACTER_REFERENCES[name.toLowerCase()];
    return literal === undefined ? m : literal;
  });
  return out;
}

function canonicalizePathText(content) {
  let text = content.toLowerCase();
  // Full percent-decoding AND CommonMark/HTML5 character-reference decoding,
  // iterated together to a single fixed point. Decoding only %2f/%5c in a
  // single pass left %2e (encoded dot) and nested forms like %252f
  // (%25 → % , then %2f → /) undetected (2026-07-30 round-3 finding); decoding
  // only percent-encoding at all left CommonMark numeric/named character
  // references (&#46; / &#x2e; / &period; -> '.') undetected, since a packet
  // renders as a live link to the hidden path while the raw-text scan missed
  // it (2026-07-30 round-4 Codex finding, reproduced before fixing). Every
  // decode step strictly shrinks the string (the shortest reference, &sol;,
  // is 5 characters collapsing to 1), so the loop terminates on its own
  // without an arbitrary iteration cap that deep nesting could outlast.
  let decoded;
  while (
    (decoded = decodeCharacterReferencesOnce(
      text.replace(/%([0-9a-f]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)).toLowerCase())
    )) !== text
  ) {
    text = decoded;
  }
  text = text.split('\\').join('/');
  text = text.replace(/\/{2,}/g, '/');
  while (text.includes('/./')) text = text.split('/./').join('/');
  let previous;
  do {
    previous = text;
    text = text.replace(/[^/\s]+\/\.\.\//g, '');
  } while (text !== previous);
  return text;
}

function referencesReviewerOutput(content, reviewer) {
  const haystack = canonicalizePathText(content);
  if (haystack.includes(reviewer + '-review-latest.md')) return true;
  return new RegExp('\\.claude/reviews/[a-f0-9]{64}/' + reviewer + '/').test(haystack);
}

// Returns the blob OID recorded for the file in the Git index, or null when the
// path is not staged/tracked. Used to prove an artifact actually enters the
// commit rather than merely existing in the working tree.
function stagedBlobOid(file) {
  try {
    const entry = execFileSync('git', ['ls-files', '--stage', '--', file.split(path.sep).join('/')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return entry ? entry.split(/\s+/)[1] : null;
  } catch (error) {
    return null;
  }
}

// Returns the blob OID Git would store for the working-tree file, applying the
// path's clean filters (CRLF normalization, .gitattributes) exactly as `git add`
// would, or null when the file cannot be hashed.
function workingTreeBlobOid(file) {
  try {
    return (
      execFileSync('git', ['hash-object', '--', file.split(path.sep).join('/')], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim() || null
    );
  } catch (error) {
    return null;
  }
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

// ─── Check C: policy/calibration state may not be deleted out from under the gate ──
let stagedDeletions;
try {
  stagedDeletions = execSync('git diff --cached --name-only --diff-filter=D', { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
} catch (error) {
  console.error('BLOCKED: check-review-artifacts could not read staged deletions (' + error.message + ').');
  console.error('The review gate fails closed when the staged index cannot be inspected.');
  process.exit(1);
}

const deletedPolicyState = stagedDeletions.filter((file) => POLICY_STATE_PATHS.includes(file));
if (deletedPolicyState.length > 0) {
  console.error(
    'BLOCKED: staged deletion of review policy state: ' + deletedPolicyState.join(', ') + '.'
  );
  console.error(
    'Removing policy or calibration state would weaken the gate on the next commit. ' +
      'Commit an explicit policy with mode: disabled instead of deleting it.'
  );
  failed = true;
}

// ─── Check B: staged review-required files must be queued ────────────────────
// Runs BEFORE the policy is loaded: "is this file even queued" is the more
// fundamental question, and an invalid/absent policy should not mask it.
const unqueuedReviewable = staged.filter((file) => requiresReview(file) && !queue.has(file));
if (unqueuedReviewable.length > 0) {
  console.error(
    'BLOCKED: staged file(s) match review-required paths but are missing from .claude/review-queue.txt: ' +
      unqueuedReviewable.join(', ')
  );
  if (process.env.REVIEW_GATE_ALLOW_UNREVIEWED === '1') {
    console.error('REVIEW_GATE_ALLOW_UNREVIEWED is no longer accepted for protected paths.');
  }
  console.error('Add them to the queue and regenerate the canonical reviewer packets.');
  failed = true;
}

// ─── Check A: queued staged files must be covered by fresh artifacts ─────────
const queuedStagedFiles = staged.filter((file) => queue.has(file));

if (queuedStagedFiles.length > 0) {
  let policy;
  try {
    policy = readPolicy();
  } catch (error) {
    console.error('BLOCKED: ' + error.message + '.');
    process.exit(1);
  }

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
      reviewer: 'antigravity',
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
      reviewer: 'codex',
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
      reviewer: 'antigravity',
    },
    {
      file: path.join('.claude', 'codex-review-latest.md'),
      label: 'Codex review verdict',
      headings: ['Skills Applied', 'Runtime Boundary Check'],
      requiredText: ['.claude/skills/artifact_qa_gate.md', 'Codex Overlay'],
      verdict: true,
      reviewer: 'codex',
    },
  ];
  const contractValues = new Map();

  for (const req of REQUIRED) {
    if (policy.mode === 'disabled' && req.reviewer === 'antigravity') {
      continue;
    }

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
      } else {
        const expectedVerdict =
          req.reviewer === 'antigravity' && policy.mode === 'probation' ? 'ADVISORY' : 'APPROVE';
        if (verdicts[0] !== expectedVerdict) {
          console.error(
            'BLOCKED: ' +
              req.label +
              ' (' +
              req.file +
              ') declares verdict ' +
              verdicts[0] +
              ', but policy requires ' +
              expectedVerdict +
              '.'
          );
          failed = true;
        }
      }

      if (
        policy.requireAppendOnlyVerdicts === true &&
        !hasArchivedCopy(content, declaredScopeHash, req.reviewer)
      ) {
        console.error(
          'BLOCKED: ' +
            req.label +
            ' has no byte-identical append-only archive. Run: node .claude/hooks/archive-review-artifact.js ' +
            req.reviewer
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

    if (policy.enforceEvidenceContract === true) {
      for (const field of ['review_id', 'risk_level', 'runtime_required', 'blind_review']) {
        const value = artifactField(content, field);
        if (value === null) {
          console.error('BLOCKED: ' + req.label + ' (' + req.file + ') is missing required field: ' + field);
          failed = true;
        } else if (!contractValues.has(field)) {
          contractValues.set(field, value);
        } else if (contractValues.get(field) !== value) {
          console.error(
            'BLOCKED: ' +
              req.label +
              ' (' +
              req.file +
              ') declares ' +
              field +
              ': ' +
              value +
              ', but the active review contract requires ' +
              contractValues.get(field) +
              '.'
          );
          failed = true;
        }
      }

      if (policy.requireBlindReview === true && artifactField(content, 'blind_review') !== 'true') {
        console.error('BLOCKED: ' + req.label + ' (' + req.file + ') must declare blind_review: true.');
        failed = true;
      }

      if (!req.verdict) {
        const otherReviewer = req.reviewer === 'antigravity' ? 'codex' : 'antigravity';
        if (referencesReviewerOutput(content, otherReviewer)) {
          console.error(
            'BLOCKED: ' + req.label + ' (' + req.file + ') exposes the other reviewer verdict before blind review.'
          );
          failed = true;
        }
      } else {
        if (artifactField(content, 'prior_reviewer_outputs_read') !== 'false') {
          console.error(
            'BLOCKED: ' + req.label + ' (' + req.file + ') must declare prior_reviewer_outputs_read: false.'
          );
          failed = true;
        }

        const riskLevel = artifactField(content, 'risk_level');
        const evidenceLevel = Number(artifactField(content, 'evidence_level'));
        if (
          riskLevel === 'high' &&
          (!Number.isInteger(evidenceLevel) || evidenceLevel < Number(policy.minimumHighRiskEvidenceLevel || 3))
        ) {
          console.error(
            'BLOCKED: ' +
              req.label +
              ' (' +
              req.file +
              ') does not meet the high-risk evidence floor of Level ' +
              Number(policy.minimumHighRiskEvidenceLevel || 3) +
              '.'
          );
          failed = true;
        }

        for (const heading of ['Evidence Receipts', 'Adversarial Disproof', 'Unverified Boundaries']) {
          if (!content.includes(heading)) {
            console.error(
              'BLOCKED: ' + req.label + ' (' + req.file + ') is missing the required "' + heading + '" section.'
            );
            failed = true;
          }
        }

        if (
          artifactField(content, 'runtime_required') === 'true' &&
          artifactField(content, 'runtime_evidence') !== 'executed'
        ) {
          console.error(
            'BLOCKED: ' +
              req.label +
              ' (' +
              req.file +
              ') covers a runtime-required change without runtime_evidence: executed.'
          );
          failed = true;
        }
      }
    }
  }
}

if (failed) {
  console.error('');
  console.error('Regenerate reviewer packets and verdicts for the current .claude/review-queue.txt scope.');
  console.error('Prompt packets and verdicts must satisfy .claude/antigravity-review-policy.json, repeat the current scope_hash, identify evidence and skills actually used, and mention the staged queued files.');
  console.error('');
  process.exit(1);
}

process.exit(0);
