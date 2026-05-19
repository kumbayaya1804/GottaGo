create table trust_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  event_type text not null,
  score_delta numeric not null,
  reason text,
  created_at timestamptz not null default now()
);

create index trust_events_user_id_idx on trust_events (user_id);
create index trust_events_created_at_idx on trust_events (created_at);

alter table trust_events enable row level security;

-- Not readable by normal clients — service/admin only
-- (no select policy = authenticated role gets nothing)
