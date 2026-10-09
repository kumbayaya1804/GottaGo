## Codex Review - Regenerate database.types.ts for Phase 5 and remove the submit_location type bridge, attempt 1

**VERDICT: APPROVE**

scope_hash: sha256:a747ea14046678d503e4581795c5da9980fec6ae5eb0de0803fddc1b105a3e5f
review_id: rv-20260929T021232Z-43ad8d04
risk_level: high
runtime_required: true
blind_review: true
prior_reviewer_outputs_read: false
evidence_level: 3
runtime_evidence: executed

### Reviewed Queue
- `app/src/lib/database.types.ts`: full file, HEAD diff, staged/working-tree equality, independently generated live schema output.
- `app/src/features/submit/submitLocation.ts`: full file, HEAD diff, caller, input contract, RPC mock tests, emitted JavaScript.

### Skills Applied
- `.claude/skills/artifact_qa_gate.md` shared core and Codex Overlay.
- `artifact-qa-gate`.
- `superpowers:using-superpowers`.
- `superpowers:verification-before-completion`.
- `supabase:supabase` for live type generation and read-only catalog verification.

### Findings
None requiring changes within this batch.

### Follow-ups
No new follow-up finding. Jest emitted a MapScreen React act warning and a Node localStorage experimental warning; neither failed the suite or arose from these changed lines.

### Open Questions
None blocking this bounded types-only change.

### Verification
Executed on 2026-10-09 from `/Users/yaelsaint-armand/GottaGo`:
- Fingerprint preflight: exit 0, exact packet hash, confirmed again after verification.
- `git diff --quiet -- app/src/lib/database.types.ts app/src/features/submit/submitLocation.ts`: exit 0; reviewed disk files equal staged files.
- `git diff --cached --check -- <both queued paths>`: exit 0.
- In `app/`, `npx tsc --noEmit`: exit 0.
- In `app/`, `npx eslint src --quiet`: exit 0.
- In `app/`, `npx jest --coverage --runInBand`: authorized outside-sandbox rerun exit 0, 46/46 suites and 397/397 tests passed. Initial sandbox execution failed before tests because Watchman socket access was denied; the rerun resolved that environmental failure.
- TypeScript `transpileModule` comparison of HEAD and disk `submitLocation.ts` with ES2020/ESNext and comments removed: exit 0, identical emitted JavaScript.

### Evidence Receipts
1. C1: Supabase plugin `generate_typescript_types(project_id="ebmzhjmmtmldhrojkdqw")` succeeded. Saved the returned `types` string to `/private/tmp/codex-live-phase5-types.ts` without modifying the repository source. Removed the single extra newline introduced by the patch transport, preserving the generator string. `cmp` returned 0; both files have SHA-256 `3f7e6a21ab18b424a0b161eed25bc2f28408cedf6af73d08e13714f3628be51f`.
2. C2: Read the complete queued file and HEAD diff. Additions map to `20260731000100_phase5_confidence_numeric.sql:64,123`, `20260731000200_phase5_notification_outbox.sql:44`, and `20260731000300_phase5_verify_and_publish.sql:68,75,480,682,712`. Outbox defaults/nullability/relationships match its DDL, including unique submission FK. Remaining five helper changes are generator parentheses. No unrelated changed schema shape found.
3. C3: Supabase plugin `execute_sql` queried `pg_proc`, `pg_namespace`, `pg_get_function_arguments`, and `pg_get_function_result` for public.submit_location. Succeeded: exactly one overload, 14 parameters, uuid return; p_changing_table and p_wheelchair are boolean DEFAULT false. Other optional arguments default NULL; required numeric/text/boolean/timestamptz arguments match generated Args at `database.types.ts:960`. The unchanged wrapper explicitly sends both selections at `submitLocation.ts:39,40`; the screen maps booleans at `app/src/app/(tabs)/submit.tsx:95,96`.
4. C4: HEAD diff changes only comment/type declarations at `submitLocation.ts:5`. Independent transpilation produced identical JavaScript. Passing wrapper tests assert complete argument mapping, true/false forwarding, returned ID and raw-error propagation.
5. C5: Scoped `rg` over `app/src` for SubmitLocationArgs, database.types, and all newly generated identifiers found direct generated-type consumers only in the wrapper and typed Supabase singleton. No outbox app access found. Full TypeScript check and app suite passed; the singleton's generic type checks its callers throughout the app.
6. C6: Supabase plugin read-only catalog query used `pg_class.relrowsecurity` and effective `has_table_privilege` for SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER. Succeeded: notification_outbox RLS=true; any_privilege=false for both anon and authenticated. This agrees with migration lines 111 and 119. Generated types confer no grants.
7. Live migration-ledger SELECT succeeded with versions 20260731000000, 20260731000100, 20260731000200, 20260731000300. This confirms presence, without claiming a checksum audit of deployed migration bodies.

### Adversarial Disproof
- Attempted to falsify generator fidelity by fresh independent generation and byte comparison: no mismatch.
- Checked for a stale 12-argument overload or changed defaults using live function catalogs: exactly the expected 14-argument overload.
- Checked whether the optional generated booleans silently omit user choices: wrapper supplies both explicitly, including false; unchanged required SubmitInput fields and passing tests preserve that behavior.
- Checked whether type-only removal alters runtime: transpilation equality disproves that concern.
- Checked whether exposing an outbox type creates client data access: effective live table privileges deny both client roles, and no app consumer exists.

### Unverified Boundaries
No real submission was written to production. Device GPS, transport failures against a real server, push delivery and device UAT were not exercised. SQL business logic and database concurrency suites were not rerun because this batch changes neither SQL nor runtime JavaScript. Tests mock Supabase and do not prove server submission behavior. Supabase markdown documentation fetches were unavailable through the web reader; review conclusions rely on local implementation and executed live generator/catalog checks.

### Runtime Boundary Check
The runtime-required schema claims were exercised through the live Supabase generator and read-only SQL tools. Screen -> buildInput -> submitLocation -> typed singleton -> RPC keys agrees with the deployed signature. The wrapper rethrows errors; the screen retains form state and shows locked ERR-08 on failure (`app/src/app/__tests__/(tabs)/submit.test.tsx:319`). Screen tests replace the wrapper, while wrapper tests replace the Supabase client; neither is end-to-end transport proof.

Does this decision serve someone with 60 seconds before an emergency? Yes, within this scope: matching generated types to the deployed function removes contract drift without changing the submission path or adding friction. The live signature check prevents approving a merely compiling but mismatched argument contract. Existing failure feedback and retained form state remain unchanged.

### Approved
The exact two-file staged types-only batch is approved. This verdict does not authorize a merge, deployment, production write, or app release, and does not establish pending device UAT as complete.
