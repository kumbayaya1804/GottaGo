---
name: pgtap-testing
description: Use when writing, changing, running, or reviewing Gotta Go pgTAP tests under supabase/tests, including RLS, grant, RPC, concurrency, or two-session race tests, and when a claim rests on "supabase test db" passing.
---

# Skill: pgTAP Testing

## Purpose

Make database tests exercise the same role, claims, and isolation that production callers get.

## Rules

- Test access as the caller, not the superuser. pgTAP runs as `postgres`, which bypasses RLS and grants and has no `auth.uid()`. Every assertion about client access (RLS, grants, allowed or denied callers) runs under `set local role authenticated` (or `anon`) with `select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)`. Reset the claims before switching users. An assertion made as `postgres` proves nothing about access. Fixture creation, privileged lock setup, and cleanup may run as `postgres`; label them as setup, not as access assertions. A JWT `role` claim is not `SET ROLE`: it sets `auth.uid()` and `auth.role()` but keeps `postgres` privileges.
- Cover allowed and denied paths: owner, other user, `anon`, and a shadowbanned user where it applies. Use `throws_ok` or `is_empty` for denials.
- By default, keep each file in one transaction: `begin; select plan(n); ... select * from finish(); rollback;`. The plan count must equal the assertions.
- Exception: a file that must commit a globally visible change (for example an `app_config` value or fixture another session must see) runs only through `node supabase/scripts/run-isolated-db-suite.js <path>`, never plain `supabase test db` against the shared stack, and its cleanup must be idempotent. See `docs/verification.md`.
- A race needs two real sessions (dblink) that actually overlap. A single session, or two calls run one after the other, is not a race test.
- dblink sessions do not inherit role or claims. Set the JWT claims in every session that calls an RPC that reads `auth.uid()`, and `SET ROLE` as well when that session's assertion is about access. The existing Phase 5 race suites run their sessions as `postgres` with claims only: they are evidence for locking, ordering, and the RPC body under concurrency, not for access control. Access for the same RPC must be proven separately by single-session caller-role tests, including denied roles.
- Use the approved dblink route: the session's own interface address and port discovered at run time (`host(inet_server_addr())`, `inet_server_port()`) with the ordinary `postgres` role and password, as in `phase5_discovery_cooldown_race.test.sql` and `phase5_verify_publish.test.sql`. Flag a hardcoded host, a loopback or Unix-socket route, or an elevated role: credentials in the string do not prove the server negotiated password auth, because peer or trust HBA rules can accept it anyway. Any new route needs the runtime proof in `docs/verification.md` first.
- Create fixtures inside the test and scope assertions to them. Never count a whole table.

## Workflow

1. For each assertion, name the role and `sub` it runs as.
2. Check the plan count and the transaction frame.
3. If anything commits, confirm the isolated runner is the only documented way to run the file.
4. Report the exact command run and its output. "All green" with no command is not evidence.
