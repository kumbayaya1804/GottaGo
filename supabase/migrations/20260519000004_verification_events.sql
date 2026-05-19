create table verification_events (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references bathroom_locations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  verified_at timestamptz not null default now(),
  gps_accuracy_meters numeric,
  distance_from_location_meters numeric,
  weighted_value numeric not null default 1,
  result text not null,
  created_at timestamptz not null default now()
);

create index verification_events_location_id_idx on verification_events (location_id);
create index verification_events_user_id_idx on verification_events (user_id);
create index verification_events_verified_at_idx on verification_events (verified_at);

alter table verification_events enable row level security;

-- Raw visit history is not public — only aggregates are exposed
create policy "verification_events_select_own"
  on verification_events for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserts only from non-shadowbanned authenticated users
create policy "verification_events_insert_authenticated"
  on verification_events for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and is_shadowbanned = false
    )
    and exists (
      select 1 from bathroom_locations
      where id = location_id
      and deleted_at is null
      and suppressed_at is null
      and is_shadowbanned = false
    )
  );
