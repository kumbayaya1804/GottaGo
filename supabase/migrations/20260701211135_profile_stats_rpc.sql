-- Phase 2 (02-02 T3) — review-gate fix (2026-07-01)
--
-- Antigravity + Codex both flagged that app/src/features/profile/profileStats.ts
-- queried `ratings` directly via the client (`supabase.from('ratings').select(...)`).
-- Migration 20260624000002_ratings_privacy_fix.sql already revokes base-table SELECT
-- on `ratings` from both `authenticated` and `anon` (to prevent rater-identity/PII
-- exposure) — so a direct client-side query fails at runtime with a Postgres
-- permission error (42501), even though it appeared to pass under mocked unit tests.
--
-- Fix: a single SECURITY DEFINER RPC that derives the user via auth.uid() internally
-- (no caller-supplied id, matching update_profile/delete_account's pattern) and
-- returns the three profile-stats counts as a single JSON object so PostgREST/
-- supabase-js hands the client a plain object rather than an array-of-rows.

-- ─── 1. get_profile_stats ──────────────────────────────────────────────────────
create or replace function public.get_profile_stats()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'gps_verifications', (
      select count(*) from verification_events where user_id = auth.uid()
    ),
    'locations_submitted', (
      select count(*) from submissions where submitter_id = auth.uid()
    ),
    'ratings_given', (
      select count(*) from ratings where user_id = auth.uid()
    )
  );
$$;

revoke execute on function public.get_profile_stats() from public;
revoke execute on function public.get_profile_stats() from anon;
grant execute on function public.get_profile_stats() to authenticated;
