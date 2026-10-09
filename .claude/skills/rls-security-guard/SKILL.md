---
name: rls-security-guard
description: Use when a Gotta Go change creates or alters tables, RLS policies, RPCs, or SECURITY DEFINER functions, reads or writes public location data, user-owned data, or verification events, or touches shadowban, soft-delete, privacy, or service-role behavior.
---

# Skill: RLS Security Guard

## Purpose

Audit Supabase Row Level Security, privacy boundaries, and public-read behavior.

## Load When

- migrations create or alter tables, policies, RPCs, or security-definer functions
- code reads public location data, user-owned data, moderation data, or verification events
- a review touches trust, shadowban, soft delete, privacy, or service-role behavior

## Context To Read

- affected migrations and SQL functions
- relevant `docs/schema-contract.md` sections
- client/server call sites that consume the affected table or RPC
- tests that assert authorized and unauthorized access

## Rules

- Every user-owned, moderation, contribution, or public-facing table must have RLS enabled before use.
- Public discovery reads must exclude shadowbanned and soft-deleted records at the database/query layer.
- Owner/self reads may return the owner's own state when product behavior requires it; do not blindly require `is_shadowbanned = false` on every SELECT policy without checking the access path.
- `anon` must never read `users.email`, raw `verification_events.user_id`, service-only moderation data, or private auth/session material.
- Trust score, shadowban status, moderation flags, and deleted state must not be writable by public or ordinary authenticated roles.
- `WITH CHECK` must prevent identity spoofing on inserts and updates.
- Security-definer functions must validate caller authority and pin `search_path`. New functions use `set search_path = ''` with every object schema-qualified (`public.`, `auth.`, `extensions.`). The many existing `set search_path = public` bodies are legacy; do not copy that pattern.
- Function ACLs are explicit. Postgres grants EXECUTE to PUBLIC by default, so every new function revokes it from `public`, then grants each intended caller. Public discovery RPCs (map search and location detail) must stay callable by `anon`, because finding a bathroom needs no account; contributor, verification, and moderation RPCs grant only `authenticated` (or `service_role`) and deny `anon`. An in-body `auth.uid() is null` check is not a substitute for the grant. Flag both a missing denial and a missing intended grant: an `anon` revoke on a discovery RPC turns urgent search into an error.
- Table grants are explicit. Supabase's default grants to `anon` and `authenticated` are broad, and RLS does not restrict TRUNCATE. A new client-facing table revokes all privileges from both roles, then grants only what its policies serve, typically `select` to `authenticated`. Precedent: `20260710121534_verification_events_client_write_acl_lockdown.sql`.

## Workflow

1. Map every affected table/RPC to its intended roles.
2. Verify RLS is enabled and policies cover SELECT, INSERT, UPDATE, and DELETE where applicable.
3. Check that public discovery filters live below the UI layer.
4. Check that owner/admin paths do not over-expose private fields.
5. Require tests or SQL checks for unauthorized access on new or changed policies.
6. Require each changed RPC to be called as `anon` and as an authenticated user. A migration that applies cleanly proves nothing about a PL/pgSQL body, which is only resolved at call time.
