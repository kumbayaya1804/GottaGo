create table availability_flags (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references bathroom_locations(id) on delete cascade,
  reported_by uuid references profiles(id) on delete set null,
  flag_type text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index availability_flags_location_id_idx on availability_flags (location_id);
create index availability_flags_expires_at_idx on availability_flags (expires_at);

alter table availability_flags enable row level security;

-- Public reads: only non-expired flags from non-shadowbanned reporters on valid locations
create policy "availability_flags_select_public"
  on availability_flags for select
  using (
    expires_at > now()
    and (
      reported_by is null
      or exists (
        select 1 from profiles
        where id = reported_by
        and is_shadowbanned = false
      )
    )
    and exists (
      select 1 from bathroom_locations
      where id = location_id
      and deleted_at is null
      and suppressed_at is null
      and is_shadowbanned = false
    )
  );

create policy "availability_flags_insert_authenticated"
  on availability_flags for insert
  to authenticated
  with check (
    auth.uid() = reported_by
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and is_shadowbanned = false
    )
  );
