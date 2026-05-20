-- Remote schema capture: pulled from live project ebmzhjmmtmldhrojkdqw
-- This migration represents the state of the remote DB as of 2026-05-19.
-- It was NOT applied via supabase db push — the schema already existed on remote
-- before local migrations were established.
-- Mark as applied: supabase migration repair --status applied 20260519010000

-- Extensions
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ─── users ───────────────────────────────────────────────────────────────────
create table users (
  id                             uuid primary key references auth.users(id) on delete cascade,
  email                          text,
  display_name                   text,
  created_at                     timestamptz default now(),
  updated_at                     timestamptz default now(),
  gps_consent                    boolean,
  gps_consent_at                 timestamptz,
  gamification_points            integer default 0,
  trust_score                    integer default 9,
  trust_multiplier               numeric default 0.5,
  gps_verified_contribution_count integer default 0,
  leaderboard_position           integer,
  shadowban_status               boolean default false,
  admin_override                 boolean default false,
  family_mode                    boolean default false
);

create index idx_users_email        on users (email);
create index idx_users_id           on users (id);
create index idx_users_shadowban    on users (shadowban_status) where shadowban_status = true;
create index idx_users_trust_score  on users (trust_score);

alter table users enable row level security;

create policy "service_role_all"
  on users for all
  using ((auth.jwt() ->> 'role') = 'service_role');

create policy "users_select_own"
  on users for select
  using (auth.uid() = id);

create policy "users_update_own"
  on users for update
  using (auth.uid() = id);

-- ─── locations ───────────────────────────────────────────────────────────────
create table locations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  address               text,
  coordinates           geography not null,
  policy_tag            text,
  access_sensitivity    text,
  hours                 jsonb,
  is_open_now           boolean,
  data_source           text not null default 'community',
  confidence_score      text,
  confidence_tier       text,
  verification_count    integer default 0,
  last_verified_at      timestamptz,
  decay_tier            text,
  respect_signal_score  numeric default 0,
  chill_spot            boolean default false,
  failure_event_count   integer default 0,
  access_instructions   text,
  shadowban_status      boolean default false,
  deleted_at            timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  timezone              text not null default 'America/Los_Angeles'
);

create index idx_locations_confidence_tier  on locations (confidence_tier);
create index idx_locations_coordinates      on locations using gist (coordinates);
create index idx_locations_coordinates_active
  on locations using gist (coordinates)
  where deleted_at is null and shadowban_status = false;
create index idx_locations_data_source      on locations (data_source);
create index idx_locations_deleted_at       on locations (deleted_at) where deleted_at is null;
create index idx_locations_shadowban        on locations (shadowban_status) where shadowban_status = false;

alter table locations enable row level security;

create policy "locations_insert_auth"
  on locations for insert
  with check (auth.uid() is not null);

create policy "locations_select_public"
  on locations for select
  using (deleted_at is null and shadowban_status = false);

create policy "locations_service_all"
  on locations for all
  using ((auth.jwt() ->> 'role') = 'service_role');

create policy "locations_update_auth"
  on locations for update
  using (auth.uid() is not null);

-- ─── trust_events ─────────────────────────────────────────────────────────────
create table trust_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  action_type  text not null,
  delta        integer not null,
  timestamp    timestamptz default now(),
  context_ref  text
);

create index idx_trust_events_timestamp on trust_events (timestamp desc);
create index idx_trust_events_user_id   on trust_events (user_id);

alter table trust_events enable row level security;

create policy "trust_events_select_own"
  on trust_events for select
  using (auth.uid() = user_id);

create policy "trust_events_service_insert"
  on trust_events for insert
  with check ((auth.jwt() ->> 'role') = 'service_role');

-- ─── tags ─────────────────────────────────────────────────────────────────────
create table tags (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  key         text not null,
  value       text not null,
  created_at  timestamptz default now()
);

create index idx_tags_location_id on tags (location_id);

alter table tags enable row level security;

create policy "tags_insert_auth"
  on tags for insert
  with check (auth.uid() is not null);

create policy "tags_select_public"
  on tags for select
  using (true);

create policy "tags_service_all"
  on tags for all
  using ((auth.jwt() ->> 'role') = 'service_role');

-- ─── verification_events ──────────────────────────────────────────────────────
create table verification_events (
  id                           uuid primary key default gen_random_uuid(),
  location_id                  uuid not null references locations(id),
  user_id                      uuid not null references users(id),
  gps_lat                      numeric,
  gps_lon                      numeric,
  distance_from_location_meters numeric not null,
  weight                       numeric not null,
  event_type                   text not null,
  timestamp                    timestamptz default now()
);

create index idx_verification_events_location_id on verification_events (location_id);
create index idx_verification_events_timestamp   on verification_events (timestamp desc);
create index idx_verification_events_user_id     on verification_events (user_id);

alter table verification_events enable row level security;

create policy "verification_events_insert_auth"
  on verification_events for insert
  with check (auth.uid() = user_id);

create policy "verification_events_insert_service"
  on verification_events for insert
  with check ((auth.jwt() ->> 'role') = 'service_role');

create policy "verification_events_select_own"
  on verification_events for select
  using (auth.uid() = user_id);

create policy "verification_events_select_service"
  on verification_events for select
  using ((auth.jwt() ->> 'role') = 'service_role');

-- ─── submissions ──────────────────────────────────────────────────────────────
create table submissions (
  id                 uuid primary key default gen_random_uuid(),
  location_id        uuid references locations(id),
  submitter_id       uuid not null references users(id),
  status             text not null default 'pending'
    check (status = any(array['pending','published','expired','rejected'])),
  confirmation_count integer default 0,
  expires_at         timestamptz not null default (now() + interval '14 days'),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index idx_submissions_expires_at    on submissions (expires_at);
create index idx_submissions_location_id   on submissions (location_id);
create index idx_submissions_status        on submissions (status);
create index idx_submissions_submitter_id  on submissions (submitter_id);

alter table submissions enable row level security;

create policy "submissions_insert_auth"
  on submissions for insert
  with check (auth.uid() = submitter_id);

create policy "submissions_select_published"
  on submissions for select
  using (status = 'published' or auth.uid() = submitter_id);

create policy "submissions_service_all"
  on submissions for all
  using ((auth.jwt() ->> 'role') = 'service_role');

create policy "submissions_update_own"
  on submissions for update
  using (auth.uid() = submitter_id);

-- ─── reports ──────────────────────────────────────────────────────────────────
create table reports (
  id                        uuid primary key default gen_random_uuid(),
  location_id               uuid not null references locations(id),
  user_id                   uuid not null references users(id),
  report_type               text not null
    check (report_type = any(array[
      'permanently_closed','moved_relocated','currently_locked',
      'now_requires_purchase','staff_pushed_back','access_tightened',
      'dirty_unsafe','changing_station_unusable','inaccurate_information'
    ])),
  trust_weight              numeric not null default 1.0,
  geographic_distance_meters numeric,
  details                   text,
  created_at                timestamptz default now()
);

create index idx_reports_created_at  on reports (created_at desc);
create index idx_reports_location_id on reports (location_id);
create index idx_reports_report_type on reports (report_type);
create index idx_reports_user_id     on reports (user_id);

alter table reports enable row level security;

create policy "reports_insert_auth"
  on reports for insert
  with check (auth.uid() = user_id);

create policy "reports_select_public"
  on reports for select
  using (true);

create policy "reports_service_all"
  on reports for all
  using ((auth.jwt() ->> 'role') = 'service_role');

-- ─── failure_events ───────────────────────────────────────────────────────────
create table failure_events (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  user_id     uuid not null references users(id),
  type        text not null
    check (type = any(array['locked','staff_denied','dirty','no_longer_exists'])),
  timestamp   timestamptz default now()
);

create index idx_failure_events_location_id on failure_events (location_id);
create index idx_failure_events_timestamp   on failure_events (timestamp desc);
create index idx_failure_events_user_id     on failure_events (user_id);

alter table failure_events enable row level security;

create policy "failure_events_insert_auth"
  on failure_events for insert
  with check (auth.uid() = user_id);

create policy "failure_events_insert_service"
  on failure_events for insert
  with check ((auth.jwt() ->> 'role') = 'service_role');

create policy "failure_events_select_own"
  on failure_events for select
  using (auth.uid() = user_id);

create policy "failure_events_select_service"
  on failure_events for select
  using ((auth.jwt() ->> 'role') = 'service_role');

-- ─── availability_flags ───────────────────────────────────────────────────────
create table availability_flags (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  reporter_id uuid not null references users(id),
  type        text not null
    check (type = any(array['currently_closed','inaccessible'])),
  created_at  timestamptz default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);

create index idx_availability_flags_expires_at   on availability_flags (expires_at);
create index idx_availability_flags_location_id  on availability_flags (location_id);
create index idx_availability_flags_reporter_id  on availability_flags (reporter_id);

alter table availability_flags enable row level security;

create policy "availability_flags_insert_auth"
  on availability_flags for insert
  with check (auth.uid() = reporter_id);

create policy "availability_flags_select_public"
  on availability_flags for select
  using (true);

create policy "availability_flags_service_all"
  on availability_flags for all
  using ((auth.jwt() ->> 'role') = 'service_role');

-- ─── respect_signal_log ───────────────────────────────────────────────────────
create table respect_signal_log (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  event_type  text not null,
  weight      numeric not null,
  timestamp   timestamptz default now()
);

create index idx_respect_signal_log_location_timestamp
  on respect_signal_log (location_id, timestamp desc);

alter table respect_signal_log enable row level security;

create policy "respect_signal_log_insert_service"
  on respect_signal_log for insert
  with check ((auth.jwt() ->> 'role') = 'service_role');

create policy "respect_signal_log_select_service"
  on respect_signal_log for select
  using ((auth.jwt() ->> 'role') = 'service_role');

-- ─── confidence_scores ────────────────────────────────────────────────────────
create table confidence_scores (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null unique references locations(id),
  score       text not null default 'Low'
    check (score = any(array['High','Medium','Low'])),
  computed_at timestamptz default now()
);

create index idx_confidence_scores_location_id on confidence_scores (location_id);

alter table confidence_scores enable row level security;

create policy "confidence_scores_insert_service"
  on confidence_scores for insert
  with check ((auth.jwt() ->> 'role') = 'service_role');

create policy "confidence_scores_select_public"
  on confidence_scores for select
  using (true);

create policy "confidence_scores_service_all"
  on confidence_scores for all
  using ((auth.jwt() ->> 'role') = 'service_role');

create policy "confidence_scores_update_service"
  on confidence_scores for update
  using ((auth.jwt() ->> 'role') = 'service_role');

-- ─── ratings ──────────────────────────────────────────────────────────────────
create table ratings (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id),
  user_id       uuid not null references users(id),
  cleanliness   integer check (cleanliness >= 1 and cleanliness <= 5),
  accessibility integer check (accessibility >= 1 and accessibility <= 5),
  convenience   integer check (convenience >= 1 and convenience <= 5),
  review_text   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (user_id, location_id)
);

create index idx_ratings_location_id on ratings (location_id);
create index idx_ratings_user_id     on ratings (user_id);

alter table ratings enable row level security;

create policy "ratings_insert_auth"
  on ratings for insert
  with check (auth.uid() = user_id);

create policy "ratings_select_public"
  on ratings for select
  using (true);

create policy "ratings_service_all"
  on ratings for all
  using ((auth.jwt() ->> 'role') = 'service_role');

create policy "ratings_update_own"
  on ratings for update
  using (auth.uid() = user_id);

-- ─── app_config ───────────────────────────────────────────────────────────────
create table app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

alter table app_config enable row level security;

create policy "app_config_service_only"
  on app_config for all
  using ((auth.jwt() ->> 'role') = 'service_role');

insert into app_config (key, value) values
  ('submission_publish_threshold', '2');
