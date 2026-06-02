-- Add monitoring_enabled flag to athlete_connections
-- Controls whether the daily check-in (wellness + pain + illness) is shown in the athlete app

alter table public.athlete_connections
  add column if not exists monitoring_enabled boolean not null default true;
