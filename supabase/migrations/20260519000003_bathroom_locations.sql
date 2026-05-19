create table bathroom_locations (
  id uuid primary key default gen_random_uuid(),
  name text,
  location geography(Point, 4326) not null,
  created_by uuid references profiles(id) on delete set null,
  confidence_score numeric not null default 0,
  is_shadowbanned boolean not null default false,
  suppressed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Spatial index for fast proximity queries
create index bathroom_locations_location_idx
  on bathroom_locations using gist (location);

alter table bathroom_locations enable row level security;

-- Public search: excludes deleted, suppressed, shadowbanned
create policy "bathroom_locations_select_public"
  on bathroom_locations for select
  using (
    deleted_at is null
    and suppressed_at is null
    and is_shadowbanned = false
  );

-- Authenticated users can insert (GPS validation enforced server-side)
create policy "bathroom_locations_insert_authenticated"
  on bathroom_locations for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and deleted_at is null
    and suppressed_at is null
    and is_shadowbanned = false
  );

-- Moderation fields only writable by service role
revoke update (is_shadowbanned, suppressed_at, deleted_at, confidence_score) on bathroom_locations from authenticated;
