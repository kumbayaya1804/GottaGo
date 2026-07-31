'use strict';

// Regression coverage for probity.config.ts requested by Codex round 2
// (rg-2026-07-31-tdd-guard-to-probity-migration-02, MAJOR finding 1): loads
// the REAL config through Probity's own loadConfig()/evaluate() path (not a
// reimplementation) and proves both the app/src/** scoping and the full
// project-specific instruction set actually reach the validator's prompt.

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = __dirname;
const CONFIG_PATH = path.join(REPO_ROOT, 'probity.config.ts');
const PROBITY_DIST = path.join(REPO_ROOT, 'node_modules', '@nizos', 'probity', 'dist');

// Probity's public entry point only re-exports defineConfig/rules; loadConfig
// and evaluate are internal engine pieces with no dedicated export map entry,
// so this reaches the same dist files Codex's and Antigravity's own round-2
// verification scripts read directly.
function importDist(relativePath) {
  return import(pathToFileURL(path.join(PROBITY_DIST, relativePath)).href);
}

function capturingAgent() {
  const prompts = [];
  return {
    prompts,
    agent: {
      async reason(prompt) {
        prompts.push(prompt);
        return { kind: 'pass', reason: '' };
      },
    },
  };
}

// Mirrors config.js's own anchorGlob/loadConfig behavior exactly (dirname
// with backslashes normalized to forward slashes) so the constructed
// action paths match what the real loader anchors block globs against.
const CONFIG_DIR_POSIX = path.dirname(CONFIG_PATH).replace(/\\/g, '/');

test('probity.config.ts scopes enforceTdd to a single app/src/** rule block', async () => {
  const { loadConfig } = await importDist('config.js');
  const config = await loadConfig(CONFIG_PATH);

  assert.equal(config.rules.length, 1);
  const [block] = config.rules;
  assert.equal(typeof block, 'object');
  assert.deepEqual(block.files, [`${CONFIG_DIR_POSIX}/app/src/**`]);
  assert.equal(block.rules.length, 1);
});

test('a write under app/src/** invokes enforceTdd; a write outside it does not', async () => {
  const { loadConfig } = await importDist('config.js');
  const { evaluate } = await importDist('engine.js');
  const config = await loadConfig(CONFIG_PATH);

  const inScope = capturingAgent();
  const inScopeOutcome = await evaluate(
    {
      kind: 'write',
      path: `${CONFIG_DIR_POSIX}/app/src/features/example.ts`,
      content: 'export const x = 1;\n',
    },
    config.rules,
    { agent: inScope.agent },
  );
  assert.equal(inScope.prompts.length, 1, 'enforceTdd must call the AI validator for an in-scope write');
  assert.equal(inScopeOutcome.decision.kind, 'allow');

  const outOfScope = capturingAgent();
  const outOfScopeOutcome = await evaluate(
    {
      kind: 'write',
      path: `${CONFIG_DIR_POSIX}/docs/example.md`,
      content: '# doc\n',
    },
    config.rules,
    { agent: outOfScope.agent },
  );
  assert.equal(outOfScope.prompts.length, 0, 'enforceTdd must not fire for a write outside app/src/**');
  assert.equal(outOfScopeOutcome.decision.kind, 'allow');

  const configItself = capturingAgent();
  const configOutcome = await evaluate(
    {
      kind: 'write',
      path: `${CONFIG_DIR_POSIX}/probity.config.ts`,
      content: 'export default {}\n',
    },
    config.rules,
    { agent: configItself.agent },
  );
  assert.equal(configItself.prompts.length, 0, 'enforceTdd must not fire for a write to probity.config.ts itself');
  assert.equal(configOutcome.decision.kind, 'allow');
});

test('the effective TDD prompt carries Probity defaults plus every ported project section, including TDD Order', async () => {
  const { loadConfig } = await importDist('config.js');
  const { evaluate } = await importDist('engine.js');
  const config = await loadConfig(CONFIG_PATH);

  const capture = capturingAgent();
  await evaluate(
    {
      kind: 'write',
      path: `${CONFIG_DIR_POSIX}/app/src/features/example.ts`,
      content: 'export const x = 1;\n',
    },
    config.rules,
    { agent: capture.agent },
  );

  assert.equal(capture.prompts.length, 1);
  const [prompt] = capture.prompts;

  // Probity's own default Red-Green-Refactor spec must still be present —
  // the addendum EXTENDS defaults, it does not replace them.
  assert.match(prompt, /Red phase: write a failing test first/);

  // Every section from the deleted .claude/tdd-guard/data/instructions.md
  // must reach the real validator prompt verbatim, not just live in the
  // config file's source text.
  for (const heading of [
    'GPS Distance Tests',
    'Trust Score Delta Tests',
    'PostGIS Geometry Tests',
    'RLS Tests',
    'TDD Order',
    'Coverage',
  ]) {
    assert.match(
      prompt,
      new RegExp(`###\\s+${heading}\\b`),
      `effective prompt missing ported project section: ${heading}`,
    );
  }

  // The specific rule Codex's round-2 finding caught as omitted.
  assert.match(
    prompt,
    /All `app\/src\/` files must follow strict TDD order: write a failing test\s*\n?\s*first, watch it fail, then implement\./,
  );
});
