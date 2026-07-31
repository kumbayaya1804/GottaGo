import { defineConfig, enforceTdd } from '@nizos/probity'

// Migrated from TDD Guard (2026-07-31, corrected same day after a real Codex
// finding: the first version put `files` at the top level of Config, which
// does not exist there, and put enforceTdd() as a bare top-level rule, which
// Probity's own types document as applying GLOBALLY, not scoped at all - the
// installed resolver confirmed this at runtime, not just as a type error).
//
// Config.rules entries are either a bare Rule (global) or a RuleBlock
// ({ files, rules }) that scopes its nested rules to files matching the
// glob. Scoping to app/src/** matches this project's prior TDD Guard
// coverage exactly (see CLAUDE.md / docs/agent-harness.md). Supabase
// SQL/pgTAP work keeps its existing per-phase RED-GREEN discipline
// documented in .planning/ instead of this rule, matching how TDD Guard was
// never wired to supabase/** either.
//
// The `instructions` extend function preserves TDD Guard's project-specific
// rules verbatim (ported from the deleted .claude/tdd-guard/data/
// instructions.md, not silently retired - a second real Codex finding from
// the same review round) as an addendum to Probity's own default
// Red-Green-Refactor spec, per enforceTdd()'s documented extend pattern.
const PROJECT_TDD_ADDENDUM = `
## Gotta Go Project Rules

### GPS Distance Tests
Every write to \`verification_events\` must have a test that asserts
\`distance_from_location_meters\` is below the 100-meter threshold. Never test
raw lat/lon values - always test through the PostGIS geometry or geography
column.

### Trust Score Delta Tests
Every write to \`trust_events\` must assert that the \`delta\` sign matches the
\`action_type\`. Positive actions produce positive deltas; negative/flag
actions produce negative deltas.

### PostGIS Geometry Tests
Never test GPS coordinates as raw lat/lon floats. Always test through the
geometry/geography column (e.g., \`ST_DWithin\`, \`ST_Distance\`, or
equivalent). Tests that assert raw numeric coordinate values will be
rejected.

### RLS Tests
Any new table or any change to a Row Level Security policy requires a test
that asserts unauthorized access returns 0 rows. The test must use a
different auth context (e.g., anon key or a different user's JWT) from the
one that created the data.

### TDD Order
All \`app/src/\` files must follow strict TDD order: write a failing test
first, watch it fail, then implement. Do not commit implementation code
without a corresponding test that was written before it.

### Coverage
100% lines, branches, functions, and statements are required for all
\`app/src/\` code. No exceptions.
`

export default defineConfig({
  rules: [
    {
      files: ['app/src/**'],
      rules: [
        enforceTdd({
          instructions: (defaults) => defaults + '\n' + PROJECT_TDD_ADDENDUM,
        }),
      ],
    },
  ],
})
