-- Add allow_rearrange_workouts toggle to athlete_connections
-- Coach controls whether the athlete can move sessions between days in the Plan tab.

alter table public.athlete_connections
  add column if not exists allow_rearrange_workouts boolean not null default false;
