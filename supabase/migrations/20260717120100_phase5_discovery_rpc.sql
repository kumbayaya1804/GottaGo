-- Phase 5 (05-01 Task 3) — pending-candidate discovery RPC + partial GiST index.
-- (2026-07-17)
--
-- search_pending_submissions_nearby(user_lat, user_lng, result_limit default 10):
-- lets a signed-in verifier discover up to 10 nearby (<=500m) pending candidates,
-- excluding their own submissions and submissions they already recorded a
-- verification event for. VOLATILE (not STABLE) because it atomically claims
-- last_discovery_at in private.verification_rate_limits (D-36) — a rejected
-- attempt (cooldown-denied) still returns zero rows, never candidate data.
--
-- Analog: 20260704010002_phase3_search_rpcs.sql (b) search_locations_nearby
-- (PostGIS distance/KNN, explicit column list) + 20260707020000_phase4_submission_
-- staging.sql §3 get_my_pending_submissions (auth-gate, authed-only revoke/grant).
-- PostGIS is extensions.-qualified per 20260710010000. All object references are
-- schema-qualified because this function uses `set search_path = ''`.

-- ═══════════════════════════════════════════════════════════════════════════════
-- search_pending_submissions_nearby
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.search_pending_submissions_nearby(
  user_lat     numeric,
  user_lng     numeric,
  result_limit integer default 10
)
returns table (
  id          uuid,
  name        text,
  lat         double precision,
  lng         double precision,
  policy_tag  text,
  distance_m  double precision
)
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_radius        numeric;
  v_cooldown_s    numeric;
  v_uid           uuid := auth.uid();
  v_last_call     timestamptz;
begin
  if v_uid is null then
    return;                                              -- anon -> zero rows
  end if;

  select value::numeric into v_radius
    from public.app_config where key = 'discovery_radius_m';
  v_radius := coalesce(v_radius, 500);                    -- D-35; NEVER verify_radius_m (that
                                                            -- key is the separate 100m server
                                                            -- gate used only by verify_location)

  select value::numeric into v_cooldown_s
    from public.app_config where key = 'verify_cooldown_s';
  v_cooldown_s := coalesce(v_cooldown_s, 3);               -- D-36

  -- D-36: atomically claim last_discovery_at BEFORE returning candidates.
  -- Ensure the row exists, then lock it and capture its PRIOR value in the
  -- SAME statement that overwrites it to clock_timestamp(): a `for update`
  -- lock inside a CTE that feeds an UPDATE ... FROM is never inlined by the
  -- planner, so the lock is real and held until this call's transaction
  -- ends. Two concurrent calls for the same user therefore cannot both
  -- observe a stale/absent timestamp and both pass the cooldown check — the
  -- second call blocks on this row lock until the first call's transaction
  -- commits, then correctly sees the first call's claim. Every call —
  -- allowed or denied — advances the timestamp, so a denied attempt still
  -- consumes the cooldown window (prevents retry-loop abuse: repeated
  -- attempts keep pushing the window forward instead of ever reading a
  -- stale pre-claim value). This claim is why the RPC must be VOLATILE, not
  -- STABLE.
  --
  -- clock_timestamp() (real wall-clock time, re-evaluated on every call) is
  -- used here deliberately instead of now()/transaction_timestamp() (frozen
  -- for the lifetime of the calling transaction): this claim must reflect
  -- actual elapsed time even if a caller ever issues two discovery calls
  -- inside one client-managed transaction, not just across separate
  -- transactions.
  --
  -- A prior version of this claim used a plain select-then-insert (read
  -- last_discovery_at, decide, then upsert): that is a TOCTOU race — two
  -- concurrent calls could both read the same stale/null value and both
  -- pass — and it also skipped the upsert entirely on the denied branch,
  -- contradicting the "every call advances the timestamp" contract above.
  insert into private.verification_rate_limits (user_id, last_discovery_at)
  values (v_uid, null)
  on conflict (user_id) do nothing;

  with locked as (
    select last_discovery_at
      from private.verification_rate_limits
     where user_id = v_uid
       for update
  )
  update private.verification_rate_limits t
     set last_discovery_at = clock_timestamp()
    from locked
   where t.user_id = v_uid
  returning locked.last_discovery_at into v_last_call;

  if v_last_call is not null and clock_timestamp() - v_last_call < make_interval(secs => v_cooldown_s) then
    return;                                                -- cooldown active -> zero rows, no data (claim already recorded above)
  end if;

  return query
  select s.id,
         s.name,
         extensions.st_y(s.coordinates::extensions.geometry)::double precision as lat,
         extensions.st_x(s.coordinates::extensions.geometry)::double precision as lng,
         s.policy_tag,
         extensions.st_distance(
           s.coordinates,
           extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography
         )::double precision as distance_m
    from public.submissions s
   where s.status = 'pending'
     and s.expires_at > now()
     and s.submitter_id <> v_uid                                            -- D-37 exclude own
     and not exists (                                                       -- D-37 exclude already-verified
           select 1 from public.verification_events ve
            where ve.submission_id = s.id and ve.user_id = v_uid
         )
     and extensions.st_dwithin(
           s.coordinates,
           extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography,
           v_radius
         )
   order by s.coordinates OPERATOR(extensions.<->) extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography
   -- D-37 cap: bounded, non-null LIMIT. coalesce handles a null argument (PostgreSQL
   -- treats LIMIT NULL as UNBOUNDED, which would bypass the privacy/abuse cap
   -- entirely); least caps the upper bound at 10; greatest(1, ...) floors zero/
   -- negative inputs to 1 (a raw LIMIT 0 / negative is undefined/degenerate).
   -- NEVER use a bare least(result_limit, 10).
   limit greatest(1, least(coalesce(result_limit, 10), 10));
end;
$$;

revoke execute on function public.search_pending_submissions_nearby(numeric,numeric,integer) from public;
revoke execute on function public.search_pending_submissions_nearby(numeric,numeric,integer) from anon;
grant  execute on function public.search_pending_submissions_nearby(numeric,numeric,integer) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Partial GiST index on pending unexpired submissions (READINESS gap 1)
-- ═══════════════════════════════════════════════════════════════════════════════
-- `expires_at > now()` stays a QUERY predicate only — PostgreSQL index predicates
-- cannot reference the non-IMMUTABLE now(). The partial predicate below (status =
-- 'pending') is IMMUTABLE and valid.
create index if not exists idx_submissions_coordinates_pending
  on public.submissions using gist (coordinates)
  where status = 'pending';
