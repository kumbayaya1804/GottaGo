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
- Security-definer functions must set a safe `search_path` and validate caller authority.

## Workflow

1. Map every affected table/RPC to its intended roles.
2. Verify RLS is enabled and policies cover SELECT, INSERT, UPDATE, and DELETE where applicable.
3. Check that public discovery filters live below the UI layer.
4. Check that owner/admin paths do not over-expose private fields.
5. Require tests or SQL checks for unauthorized access on new or changed policies.
