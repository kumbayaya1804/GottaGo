create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  trust_score numeric not null default 0,
  trust_multiplier numeric not null default 1,
  gps_verified_contribution_count integer not null default 0,
  is_shadowbanned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Users can read non-sensitive profile fields for any user
create policy "profiles_select_public"
  on profiles for select
  using (true);

-- Users can update only their own allowed fields
create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- trust_score, trust_multiplier, is_shadowbanned are writable only via service role
-- (enforced by not granting UPDATE on those columns to authenticated role)
revoke update (trust_score, trust_multiplier, is_shadowbanned) on profiles from authenticated;

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
