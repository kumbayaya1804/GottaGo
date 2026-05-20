# Skill: RLS Security Guard

## Purpose
Enforce Row Level Security and privacy standards across the Supabase schema.

## Constraints
- **RLS Enablement**: Every table must have RLS enabled (Pitfall #3).
- **Service Role**: Trust scores, shadowban status, and deleted_at must be read-only for public/auth roles.
- **Privacy**: `anon` role must never have access to `profiles.email` or raw `verification_events.user_id`.
- **Shadowban**: Every public-facing `SELECT` policy must include `is_shadowbanned = false`.

## Workflow
1. Scan migrations for `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
2. Verify each policy (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
3. Confirm that `WITH CHECK` on updates prevents identity spoofing.
