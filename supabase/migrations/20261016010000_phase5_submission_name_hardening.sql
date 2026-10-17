-- Phase 5 — submit_location name rules: at least one visible character, at most 120.
--
-- Recreates submit_location from its 20261016000000 body (signature, grants, and every
-- other check unchanged) and replaces only the name check:
--
--   1. 20261016000000 rejected names matching no `[^[:space:]]`. Two gaps remained:
--      [:space:] membership depends on the database locale, and invisible formatting
--      characters (zero-width space U+200B, BOM U+FEFF, soft hyphen, bidi marks and isolates,
--      fillers, variation selectors, tag characters, ...)
--      are not whitespace at all, so a name made only of them was staged and later
--      published as a blank label. The check now requires a character outside an
--      explicit list of whitespace and invisible characters. The app's form applies
--      the identical list (app/src/features/submit/submitSchema.ts), so a name the
--      form accepts is never rejected here.
--   2. The 120-character limit existed only in the form. It is now enforced here too,
--      counted in characters (char_length), never bytes. The form counts UTF-16 units,
--      which is never fewer, so it remains the stricter of the two.
--
-- Covered by supabase/tests/phase5_submission_name_hardening.test.sql.

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
  -- Visible = any character outside this explicit list: every Unicode control (Cc),
  -- format (Cf) and separator (Z) character as of Unicode 17.0, plus characters that
  -- render blank without being in those categories (CGJ U+034F, Hangul fillers U+115F,
  -- U+1160, U+3164, U+FFA0, Khmer U+17B4/17B5, Mongolian selectors U+180B-180F,
  -- Braille blank U+2800, variation selectors U+FE00-FE0F and U+E0100-E01EF, and the
  -- whole tag block U+E0000-E007F). Listed explicitly because PostgreSQL regex has no
  -- Unicode property classes. Keep identical to VISIBLE_CHAR in submitSchema.ts; tests
  -- there compare the two on every code point and check the list against \p{Cc},
  -- \p{Cf} and \p{Z}.
  if p_name is null
     or p_name !~ '[^\u0000-\u0020\u007F-\u00A0\u00AD\u034F\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u115F-\u1160\u1680\u17B4-\u17B5\u180B-\u180F\u2000-\u200F\u2028-\u202F\u205F-\u2064\u2066-\u206F\u2800\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF9-\uFFFB\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E007F\U000E0100-\U000E01EF]'
     or char_length(p_name) > 120 then
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
