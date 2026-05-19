-- Materialized view: rolling 90-day weighted verification aggregate per location.
-- Excludes deleted, suppressed, shadowbanned locations and shadowbanned users.
-- Refresh strategy: call refresh_respect_signal_90d() on a scheduled job or after
-- bulk verification ingestion. Not auto-refreshed on every write (too expensive).
create materialized view respect_signal_90d as
  select
    ve.location_id,
    count(ve.id) as verification_count,
    sum(ve.weighted_value) as weighted_score,
    max(ve.verified_at) as last_verified_at,
    now() as refreshed_at
  from verification_events ve
  join profiles p on p.id = ve.user_id
  join bathroom_locations bl on bl.id = ve.location_id
  where
    ve.verified_at >= now() - interval '90 days'
    and p.is_shadowbanned = false
    and bl.deleted_at is null
    and bl.suppressed_at is null
    and bl.is_shadowbanned = false
  group by ve.location_id
with no data;

create unique index respect_signal_90d_location_id_idx on respect_signal_90d (location_id);

-- Populate on first deploy
refresh materialized view respect_signal_90d;

create or replace function refresh_respect_signal_90d()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  refresh materialized view concurrently respect_signal_90d;
end;
$$;
