-- Phase 5 — server-side input validation for the two GPS-bearing write RPCs.
--
-- Recreates verify_location and submit_location from their 20260731000300 bodies
-- (signatures, grants and lock order unchanged) and closes four gaps a hostile or
-- buggy authenticated client could reach. The app wizard never sends these values,
-- so only the server can hold the boundary:
--
--   1. submit_location validated no coordinates. A NULL lat/lng staged a pending row
--      that could never be discovered or verified; NaN/Infinity were stored; and an
--      out-of-range pair was silently wrapped by PostGIS to a different place. It now
--      applies the same NULL/range check verify_location already had (in PostgreSQL
--      numeric, NaN and Infinity compare greater than 90/180, so the range check
--      rejects them too).
--   2. Both RPCs tested `p_mocked is true`, so p_mocked = NULL skipped the D-45 mock
--      reject. They now require `p_mocked is false` — an unproven fix is rejected.
--   3. submit_location accepted a NULL or whitespace-only name. locations.name is NOT NULL, so
--      the deciding verifier's publish raised 23502 and rolled back that verifier's
--      cooldown, event and trust writes, on every attempt, for the row's lifetime.
--   4. verify_location stamped last_verify_attempt_at := now() unconditionally. now()
--      is the transaction start, so a call that waited on the rate-limit row lock
--      could overwrite a newer concurrent claim with its older timestamp, letting a
--      third call through early. The write is now monotonic (greatest(old, now())),
--      keeping the deliberate single-transaction now() semantics described in Step 2.
--
-- Covered by supabase/tests/phase5_rpc_input_validation.test.sql.

create or replace function public.verify_location(
  p_submission_id uuid,
  p_lat           numeric,
  p_lng           numeric,
  p_accuracy_m    numeric,
  p_mocked        boolean,
  p_captured_at   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid              uuid := auth.uid();
  v_now              timestamptz := now();

  -- Task-1-locked tunables (seeded 20260731000000; fallbacks must match the seeds)
  v_cooldown_s       numeric;
  v_accuracy_floor   numeric;
  v_accuracy_span    numeric;
  v_max_age_s        numeric;
  v_verify_radius    numeric;
  v_discovery_radius numeric;
  v_retention_days   integer;
  v_threshold        integer;
  v_mult_step        numeric;
  v_publish_start    numeric;

  v_last_attempt     timestamptz;
  v_submitter_id     uuid;
  v_status           text;
  v_expires_at       timestamptz;
  v_distance         numeric;
  v_lock_id          uuid;
  v_caller_shadowban boolean;
  v_creator_shadowban boolean := false;
  v_multiplier       numeric;
  v_prox             numeric;
  v_acc              numeric;
  v_weight           numeric;
  v_count            integer;
  v_location_id      uuid;
begin
  -- ── Step 1 — auth gate ────────────────────────────────────────────────────
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- ── Config reads (all coalesce to the Task-1-locked seeded values) ────────
  select c.value::numeric  into v_cooldown_s       from public.app_config c where c.key = 'verify_cooldown_s';
  select c.value::numeric  into v_accuracy_floor   from public.app_config c where c.key = 'accuracy_floor_m';
  select c.value::numeric  into v_accuracy_span    from public.app_config c where c.key = 'accuracy_decay_span_m';
  select c.value::numeric  into v_max_age_s        from public.app_config c where c.key = 'max_gps_age_s';
  select c.value::numeric  into v_verify_radius    from public.app_config c where c.key = 'verify_radius_m';
  select c.value::numeric  into v_discovery_radius from public.app_config c where c.key = 'discovery_radius_m';
  select c.value::integer  into v_retention_days   from public.app_config c where c.key = 'raw_gps_retention_days';
  select c.value::integer  into v_threshold        from public.app_config c where c.key = 'submission_publish_threshold';
  select c.value::numeric  into v_mult_step        from public.app_config c where c.key = 'trust_multiplier_step';
  select c.value::numeric  into v_publish_start    from public.app_config c where c.key = 'confidence_publish_start';

  v_cooldown_s       := coalesce(v_cooldown_s, 3);
  v_accuracy_floor   := coalesce(v_accuracy_floor, 50);
  v_accuracy_span    := coalesce(v_accuracy_span, 100);
  v_max_age_s        := coalesce(v_max_age_s, 60);
  v_verify_radius    := coalesce(v_verify_radius, 100);
  v_discovery_radius := coalesce(v_discovery_radius, 500);
  v_retention_days   := coalesce(v_retention_days, 30);   -- MUST equal the seeded raw_gps_retention_days
  v_threshold        := coalesce(v_threshold, 2);
  v_mult_step        := coalesce(v_mult_step, 0.05);
  v_publish_start    := coalesce(v_publish_start, 50);

  -- ── Step 2 — durable cooldown claim BEFORE any domain validation (D-36) ───
  -- Round-3 Codex finding (real, reproduced via phase5_verify_publish.test.sql RACE
  -- 5): a plain `select ... for update` against a NONEXISTENT row acquires NO lock —
  -- there is nothing to lock — so two concurrent calls by the SAME brand-new caller
  -- (no row yet) could both read a null v_last_attempt and both bypass the cooldown.
  -- Fixed with the same atomic ensure-row-then-lock pattern already proven in
  -- 20260717120100_phase5_discovery_rpc.sql's search_pending_submissions_nearby:
  -- first ensure the row exists (idempotent, no-op if a concurrent caller already
  -- created it), THEN lock + read + overwrite it in a single statement via a `with
  -- ... for update` CTE feeding an `update ... from` — that lock is never inlined by
  -- the planner, so it is real and held until this call's transaction ends. Two
  -- concurrent calls by the SAME user therefore cannot both observe a stale/absent
  -- timestamp: the second genuinely blocks on this row lock until the first's whole
  -- transaction resolves, then correctly reads the first's just-committed claim. A
  -- REJECTED attempt must still consume the cooldown, which is why the write happens
  -- before validation and why every expected rejection below RETURNS rather than
  -- raises. v_now (not clock_timestamp()) is used deliberately, matching every other
  -- timestamp in this function and this file's own single-transaction pgTAP fixtures'
  -- reliance on now() being frozen for the transaction's duration.
  insert into private.verification_rate_limits (user_id, last_verify_attempt_at)
  values (v_uid, null)
  on conflict (user_id) do nothing;

  with locked as (
    select last_verify_attempt_at
      from private.verification_rate_limits
     where user_id = v_uid
       for update
  )
  update private.verification_rate_limits t
     set last_verify_attempt_at = greatest(locked.last_verify_attempt_at, v_now)  -- never rewinds a newer claim
    from locked
   where t.user_id = v_uid
  returning locked.last_verify_attempt_at into v_last_attempt;

  if v_last_attempt is not null
     and (v_now - v_last_attempt) < make_interval(secs => v_cooldown_s) then
    return jsonb_build_object('accepted', false);   -- too soon; no reason leaked
  end if;

  -- ── Step 3 — lock + authorize the target BEFORE inserting any event ───────
  -- Submission-row-first lock order, matching withdraw_submission. Discovery
  -- filtering is NOT authorization: own / non-pending / expired / cancelled /
  -- rejected / published / missing targets all return the SAME reason-free shape.
  select s.submitter_id, s.status, s.expires_at
    into v_submitter_id, v_status, v_expires_at
    from public.submissions s
   where s.id = p_submission_id
   for update;

  if not found
     or v_status is distinct from 'pending'
     or v_expires_at <= v_now
     or v_submitter_id is not distinct from v_uid then
    return jsonb_build_object('accepted', false);
  end if;

  -- ── Step 4 — GPS validation, same reason-free result ─────────────────────
  if p_mocked is not false then                                   -- D-45 mock reject; NULL is unproven
    return jsonb_build_object('accepted', false);
  end if;
  if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > v_accuracy_floor then  -- D-46 hard floor; <0 is not a measurement
    return jsonb_build_object('accepted', false);
  end if;
  if p_captured_at is null
     or (v_now - p_captured_at) > make_interval(secs => v_max_age_s)
     or p_captured_at > v_now + interval '5 seconds' then          -- WR-02 future-date
    return jsonb_build_object('accepted', false);
  end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return jsonb_build_object('accepted', false);
  end if;

  -- ── Step 5a — server-computed distance + HARD proximity gate ─────────────
  -- lng FIRST. This is the SINGLE distance authority; the client never supplies it.
  select extensions.st_distance(
           s.coordinates,
           extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
         )::numeric
    into v_distance
    from public.submissions s
   where s.id = p_submission_id;

  -- Distinct from the D-56 decay keyed to discovery_radius_m: this is an
  -- admit/reject gate. No lock taken and no event recorded on rejection.
  if v_distance is null or v_distance > v_verify_radius then
    return jsonb_build_object('accepted', false);
  end if;

  -- ── Step 5b — THE single user-row lock pass (see the header's lock order) ──
  -- Every public.users row this decision may READ or WRITE is locked here, now, at
  -- final strength, in ascending users.id order: creator + current caller + every
  -- historical qualifying verifier.
  --
  -- The explicit loop is deliberate. `SELECT ... ORDER BY ... FOR NO KEY UPDATE` does
  -- NOT guarantee acquisition in sorted order — PostgreSQL may lock rows during the
  -- scan, before the sort is applied — and a non-deterministic acquisition order is
  -- exactly what the global lock order exists to prevent. Locking one row per
  -- iteration, driven by an ordered set, makes the order observable and guaranteed.
  for v_lock_id in
    select x.uid
      from (
        select v_uid as uid
        union
        select v_submitter_id where v_submitter_id is not null
        union
        select ve.user_id
          from public.verification_events ve
         where ve.submission_id = p_submission_id
           and ve.weight > 0
           and ve.user_id is not null
      ) x
     order by x.uid
  loop
    perform 1 from public.users u where u.id = v_lock_id for no key update;
  end loop;

  -- ── Step 6 — read shadowban state FROM THE LOCKED ROWS, then compute weight ─
  -- These plain SELECTs are race-safe ONLY because the rows are already locked above.
  select u.shadowban_status, coalesce(u.trust_multiplier, 0.5)
    into v_caller_shadowban, v_multiplier
    from public.users u
   where u.id = v_uid;

  if v_submitter_id is not null then
    select coalesce(u.shadowban_status, false) into v_creator_shadowban
      from public.users u
     where u.id = v_submitter_id;
  end if;
  v_creator_shadowban := coalesce(v_creator_shadowban, false);

  -- Linear decay (D-56). Both spans are strictly looser than their hard gates, so an
  -- ADMITTED event always has strictly positive decay on both axes — see the
  -- app_config seeds migration for why that invariant matters (a weight-0 accepted
  -- event would silently burn the caller's one D-43 slot for this submission).
  v_prox := greatest(0, 1 - (v_distance / v_discovery_radius));
  v_acc  := greatest(0, 1 - (p_accuracy_m / v_accuracy_span));

  if v_caller_shadowban is true then
    v_weight := 0;                                   -- D-38: silent zero, still accepted
  else
    v_weight := v_multiplier * v_prox * v_acc;
  end if;

  -- ── Step 7 — insert the immutable verifier event ─────────────────────────
  begin
    insert into public.verification_events
      (submission_id, user_id, event_type, weight,
       distance_from_location_meters, gps_accuracy_m, captured_at,
       gps_location, raw_gps_purge_after)
    values
      (p_submission_id, v_uid, 'verification', v_weight,
       v_distance, p_accuracy_m, p_captured_at,
       extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
       v_now + (v_retention_days || ' days')::interval);
  exception when unique_violation then
    -- D-43: this user already has a counted event for this submission. Idempotent,
    -- reason-free, and NO second count or side effect.
    return jsonb_build_object('accepted', true);
  end;

  -- ── Step 7b — verifier trust effects (nonzero-weight events ONLY) ────────
  -- Two DISTINCT axes (D-48): trust_multiplier ramps on events GIVEN; trust_score is
  -- the reputation counter driven by the D-49 action/delta table. A shadowbanned
  -- (weight=0) event gets NEITHER, plus no trust_score change.
  -- Both UPDATEs re-touch the caller's row already held FOR NO KEY UPDATE from step
  -- 5b — no new lock, no upgrade, no deadlock surface.
  if v_weight > 0 then
    update public.users
       set trust_multiplier = least(1.0, greatest(0.5, coalesce(trust_multiplier, 0.5) + v_mult_step))
     where id = v_uid;

    insert into public.trust_events (user_id, action_type, delta, context_ref)
    values (v_uid, 'verification_given_nonzero', 1, p_submission_id::text);

    -- SC6: the ledger append alone does NOT move the score — no trigger or helper
    -- exists anywhere in this codebase. coalesce(trust_score, 9) is MANDATORY:
    -- users.trust_score is NULLABLE, and GREATEST/LEAST silently ignore NULL
    -- arguments, so a bare `trust_score + 1` on a NULL row would collapse to exactly
    -- 0 regardless of delta sign — the opposite of an increment.
    update public.users
       set trust_score = least(9, greatest(0, coalesce(trust_score, 9) + 1))
     where id = v_uid;
  end if;

  -- ── Step 8 — decision-time qualifying count (D-52) ───────────────────────
  -- The leading 1 is the creator's IMPLICIT initial claim, which counts for both
  -- grandfathered (D-42) and future rows — no synthetic creator event is fabricated.
  -- Each counted verifier must satisfy BOTH the immutable recorded weight>0 AND
  -- CURRENT eligibility: the recorded weight reflects eligibility at INSERT time
  -- only, so a user shadowbanned after recording a genuine event must stop counting
  -- WITHOUT their immutable event being rewritten. u.shadowban_status is read from
  -- the rows locked in step 5b, so this is not a stale lock-free JOIN.
  -- event_type='verification' plus the submitter_id exclusion doubly ensures the
  -- creator_claim evidence row (weight=0) can never count as an independent verifier.
  select 1 + count(distinct ve.user_id)
    into v_count
    from public.verification_events ve
    join public.users u on u.id = ve.user_id
   where ve.submission_id = p_submission_id
     and ve.event_type = 'verification'
     and ve.weight > 0
     and (v_submitter_id is null or ve.user_id is distinct from v_submitter_id)
     and u.shadowban_status is not true;

  update public.submissions
     set confirmation_count = v_count,
         updated_at = v_now
   where id = p_submission_id;                       -- D-61 progress is real, not faked

  -- ── Step 9 — the atomic publish ──────────────────────────────────────────
  -- status is still 'pending' here because step 3 verified it UNDER the row lock, so
  -- a concurrent deciding verifier blocked there and will re-read 'published' —
  -- exactly one locations row, never a double publish (D-57).
  if v_count >= v_threshold then

    -- D-69: the location still publishes (the creator's claim counted and the
    -- verifier's real work is preserved) but INHERITS the creator's CURRENT
    -- shadowban state, reusing the exact `shadowban_status = false` suppression the
    -- Phase 3 public readers already apply. This changes the PUBLISHED ROW only —
    -- never the threshold/count above.
    insert into public.locations
      (name, coordinates, address, policy_tag, access_sensitivity, hours,
       access_instructions, access_code_confirmed_at,
       confidence_value, verification_count, last_verified_at, shadowban_status)
    select s.name, s.coordinates, s.address, s.policy_tag, s.access_sensitivity, s.hours,
           s.access_instructions, s.access_code_confirmed_at,
           v_publish_start,          -- D-55 mid-tier start, never the maximum
           v_count, v_now, v_creator_shadowban
      from public.submissions s
     where s.id = p_submission_id
    returning id into v_location_id;

    update public.submissions
       set status = 'published',
           location_id = v_location_id,
           publication_seen_at = null,               -- D-68: unacknowledged
           updated_at = v_now
     where id = p_submission_id;

    -- Copy staged accessibility selections into the LIVE tags vocabulary.
    -- The staging keys are NOT the public vocabulary: public.tags uses
    -- (key='amenity', value='changing_table') and (key='accessibility',
    -- value='wheelchair') — that is what the Phase 3 filter subqueries match. A
    -- verbatim key copy would produce tags no reader can ever find, so the mapping is
    -- explicit here. Grandfathered rows with no staged tags stay untagged (D-64).
    insert into public.tags (location_id, key, value)
    select v_location_id,
           case st.key when 'changing_table' then 'amenity'
                       when 'wheelchair'     then 'accessibility'
           end,
           st.key
      from public.submission_tags st
     where st.submission_id = p_submission_id
       and st.value = 'true'
       and st.key in ('changing_table', 'wheelchair');

    -- Creator trust — D-50 (only on publish) AND D-69 (withheld when suppressed).
    -- A currently-shadowbanned creator whose location publishes SUPPRESSED earns no
    -- credit, exactly as a shadowbanned verifier earns neither a ramp nor an append.
    -- A null submitter (deleted/anonymized account) is likewise uncreditable.
    if v_creator_shadowban is not true and v_submitter_id is not null then
      insert into public.trust_events (user_id, action_type, delta, context_ref)
      values (v_submitter_id, 'published_contribution', 1, p_submission_id::text);

      -- Same coalesce-anchored clamp as step 7b, for the same nullable-column reason.
      update public.users
         set trust_score = least(9, greatest(0, coalesce(trust_score, 9) + 1))
       where id = v_submitter_id;
    end if;

    -- D-65 impact stat: increment each qualifying INDEPENDENT verifier exactly once
    -- (distinct users, creator excluded, currently-eligible only).
    update public.users u
       set gps_verified_contribution_count = coalesce(u.gps_verified_contribution_count, 0) + 1
     where u.id in (
       select distinct ve.user_id
         from public.verification_events ve
        where ve.submission_id = p_submission_id
          and ve.event_type = 'verification'
          and ve.weight > 0
          and ve.user_id is not null
          and (v_submitter_id is null or ve.user_id is distinct from v_submitter_id)
     )
       and u.shadowban_status is not true;

    -- D-67: creator-only notification. unique(submission_id) makes the ENQUEUE
    -- idempotent. Skipped entirely when there is no creator to notify.
    if v_submitter_id is not null then
      insert into public.notification_outbox
        (submission_id, location_id, recipient_user_id)
      values (p_submission_id, v_location_id, v_submitter_id)
      on conflict (submission_id) do nothing;
    end if;
  end if;

  -- ── Step 10 — accepted, with no reason field ─────────────────────────────
  return jsonb_build_object('accepted', true);
end;
$$;

revoke execute on function public.verify_location(uuid,numeric,numeric,numeric,boolean,timestamptz) from public;
revoke execute on function public.verify_location(uuid,numeric,numeric,numeric,boolean,timestamptz) from anon;
grant  execute on function public.verify_location(uuid,numeric,numeric,numeric,boolean,timestamptz) to authenticated;

create or replace function public.submit_location(
  p_name                 text,
  p_lat                  numeric,
  p_lng                  numeric,
  p_accuracy_m           numeric,
  p_mocked               boolean,
  p_captured_at          timestamptz,
  p_policy_tag           text,
  p_address              text        default null,
  p_access_sensitivity   text        default null,   -- 'sensitive' or null (D-09)
  p_hours                jsonb       default null,
  p_access_code          text        default null,   -- only when policy_tag='code_required' (D-17)
  p_timing_tip           text        default null,
  p_changing_table       boolean     default false,  -- D-62/D-63: staged, no longer discarded
  p_wheelchair           boolean     default false   -- D-62/D-63: staged, no longer discarded
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_accuracy   numeric;
  v_max_age_s      numeric;
  v_retention_days integer;
  v_now            timestamptz := now();
  v_id             uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';                 -- D-18
  end if;

  select c.value::numeric into v_max_accuracy   from public.app_config c where c.key = 'max_accuracy_m';
  select c.value::numeric into v_max_age_s      from public.app_config c where c.key = 'max_gps_age_s';
  select c.value::integer into v_retention_days from public.app_config c where c.key = 'raw_gps_retention_days';
  v_max_accuracy   := coalesce(v_max_accuracy, 50);
  v_max_age_s      := coalesce(v_max_age_s, 60);
  v_retention_days := coalesce(v_retention_days, 30);   -- MUST equal the seeded value

  -- SC2/SC7 — server-side rejection. Single generic error; no PII/coords/reason
  -- echoed. submit_location RAISES (unlike verify_location, which must return so its
  -- cooldown write survives) — this RPC has no pre-validation write to preserve.
  if p_name is null or p_name !~ '[^[:space:]]' then  -- btrim() strips only spaces; reject tab/newline-only too
    raise exception 'invalid submission';                -- locations.name is NOT NULL; it could never publish
  end if;
  if p_mocked is not false then
    raise exception 'gps rejected';                      -- mock provider; NULL is unproven
  end if;
  if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > v_max_accuracy then
    raise exception 'gps rejected';                      -- accuracy (<0 is not a measurement)
  end if;
  if p_captured_at is null
     or (v_now - p_captured_at) > make_interval(secs => v_max_age_s)
     or p_captured_at > v_now + interval '5 seconds' then  -- WR-02: future-dated fixes
    raise exception 'gps rejected';                      -- freshness
  end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'gps rejected';                      -- coordinates (NaN/Infinity fail the range check)
  end if;

  insert into public.submissions
    (submitter_id, status, confirmation_count,
     name, coordinates, address, policy_tag, access_sensitivity, hours,
     access_instructions, access_code_confirmed_at, timing_tip)
  values
    (auth.uid(), 'pending', 1,                           -- confirmation_count=1 = creator-initial (SC3)
     p_name,
     extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,   -- lng FIRST
     p_address, p_policy_tag, p_access_sensitivity, p_hours,
     p_access_code, v_now, p_timing_tip)                 -- D-22: code_confirmed_at defaults to created_at
  returning id into v_id;

  -- D-62/D-63: stage ONLY the selected options. A row's presence means "selected";
  -- the publish transaction copies present rows into the live tags vocabulary. The
  -- table's CHECK constrains the key set to exactly these two.
  if p_changing_table is true then
    insert into public.submission_tags (submission_id, key, value)
    values (v_id, 'changing_table', 'true')
    on conflict (submission_id, key) do nothing;
  end if;
  if p_wheelchair is true then
    insert into public.submission_tags (submission_id, key, value)
    values (v_id, 'wheelchair', 'true')
    on conflict (submission_id, key) do nothing;
  end if;

  -- D-40: immutable creator_claim evidence, same weight-input shape a verifier
  -- records, so the creator's own claim is auditable and purge-scheduled too.
  --
  -- weight = 0 is EXPLICIT AND INTENTIONAL, for two independent reasons:
  --   (1) verification_events.weight is `numeric NOT NULL` in the live schema, so
  --       omitting it is an outright NOT-NULL violation at execution time.
  --   (2) The creator's claim is already excluded from the qualifying-verifier count
  --       (verify_location step 8 filters on event_type='verification' AND
  --       submitter_id), so its weight is never read. Pinning it to 0 rather than a
  --       computed nonzero value means that even if that exclusion is ever refactored
  --       away, this row still cannot inflate a count or any trust/impact math.
  -- distance_from_location_meters is also NOT NULL; the creator is at the location by
  -- definition, hence 0.
  insert into public.verification_events
    (submission_id, user_id, event_type, weight,
     distance_from_location_meters, gps_accuracy_m, captured_at,
     gps_location, raw_gps_purge_after)
  values
    (v_id, auth.uid(), 'creator_claim', 0,
     0, p_accuracy_m, p_captured_at,
     extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
     v_now + (v_retention_days || ' days')::interval);

  return v_id;
end;
$$;

revoke execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text,boolean,boolean) from public;
revoke execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text,boolean,boolean) from anon;
grant  execute on function public.submit_location(text,numeric,numeric,numeric,boolean,timestamptz,text,text,text,jsonb,text,text,boolean,boolean) to authenticated;
