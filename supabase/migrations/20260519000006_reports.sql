create table reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references bathroom_locations(id) on delete cascade,
  reported_by uuid references profiles(id) on delete set null,
  report_type text not null,
  status text not null default 'open',
  details text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index reports_location_id_idx on reports (location_id);
create index reports_status_idx on reports (status);

alter table reports enable row level security;

-- Reporter can see their own reports
create policy "reports_select_own"
  on reports for select
  to authenticated
  using (auth.uid() = reported_by);

-- Any authenticated user can file a report
create policy "reports_insert_authenticated"
  on reports for insert
  to authenticated
  with check (auth.uid() = reported_by);

-- Status transitions (open → resolved etc.) require service role only
revoke update (status, resolved_at) on reports from authenticated;
