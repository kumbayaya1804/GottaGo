'use strict';

/**
 * Codex round-2 review finding on phase5_confidence.test.sql: the test's copies
 * of the confidence backfill UPDATE statement (20260731000100_phase5_confidence
 * _numeric.sql Section 2) are currently byte-identical to the migration, but
 * nothing enforces that — a comment asking future editors to keep them in sync
 * by hand is not an executable check. If the migration's mapping logic is
 * edited without updating the test's copy (or vice versa), the test would keep
 * exercising its OWN stale copy and stay green while the shipped behavior
 * silently diverged.
 *
 * This test extracts the exact statement from both files via the
 * BACKFILL-STATEMENT-BEGIN/END marker comments (present in both files
 * specifically for this purpose) and fails loudly on any byte difference,
 * or if a marker is missing/renamed in either file.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_PATH = path.join(REPO_ROOT, 'supabase', 'migrations', '20260731000100_phase5_confidence_numeric.sql');
const TEST_PATH = path.join(REPO_ROOT, 'supabase', 'tests', 'phase5_confidence.test.sql');

function extractBetweenMarkers(fileContents, filePath, beginMarker, endMarker) {
  const beginIdx = fileContents.indexOf(beginMarker);
  const endIdx = fileContents.indexOf(endMarker);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`could not find both "${beginMarker}" and "${endMarker}" markers in ${filePath} — markers may have been removed or renamed, silently disabling this binding check.`);
  }
  const statement = fileContents.slice(beginIdx + beginMarker.length, endIdx).trim();
  if (!statement) {
    throw new Error(`markers found in ${filePath} but the text between them is empty.`);
  }
  return statement;
}

test('confidence backfill: the migration statement and the test\'s primary verbatim copy are byte-identical', () => {
  const migrationSrc = fs.readFileSync(MIGRATION_PATH, 'utf8');
  const testSrc = fs.readFileSync(TEST_PATH, 'utf8');

  const canonical = extractBetweenMarkers(migrationSrc, MIGRATION_PATH, '-- BACKFILL-STATEMENT-BEGIN', '-- BACKFILL-STATEMENT-END');
  const testCopy = extractBetweenMarkers(testSrc, TEST_PATH, '-- BACKFILL-STATEMENT-BEGIN', '-- BACKFILL-STATEMENT-END');

  assert.equal(testCopy, canonical, 'phase5_confidence.test.sql\'s primary backfill statement copy has DRIFTED from the migration\'s actual statement — the pgTAP suite is now testing behavior the migration no longer implements. Update the test copy to match the migration exactly.');
});

test('confidence backfill: the test\'s SECOND (guard-idempotency re-run) copy is also byte-identical to the migration', () => {
  const migrationSrc = fs.readFileSync(MIGRATION_PATH, 'utf8');
  const testSrc = fs.readFileSync(TEST_PATH, 'utf8');

  const canonical = extractBetweenMarkers(migrationSrc, MIGRATION_PATH, '-- BACKFILL-STATEMENT-BEGIN', '-- BACKFILL-STATEMENT-END');
  const rerunCopy = extractBetweenMarkers(testSrc, TEST_PATH, '-- BACKFILL-STATEMENT-RERUN-BEGIN', '-- BACKFILL-STATEMENT-RERUN-END');

  assert.equal(rerunCopy, canonical, 'phase5_confidence.test.sql\'s second (idempotency guard re-run) backfill statement copy has DRIFTED from the migration\'s actual statement.');
});

test('confidence backfill: extraction itself fails loudly (not silently) when a marker is missing', () => {
  const withoutBeginMarker = 'some sql\n-- BACKFILL-STATEMENT-END\n';
  assert.throws(
    () => extractBetweenMarkers(withoutBeginMarker, 'synthetic-fixture.sql', '-- BACKFILL-STATEMENT-BEGIN', '-- BACKFILL-STATEMENT-END'),
    /could not find both/,
    'a missing BEGIN marker must throw, not silently return an empty/wrong match'
  );
});
