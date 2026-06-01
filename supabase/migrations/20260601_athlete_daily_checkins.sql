-- Daily check-in table
-- McLean 5-item wellness + body map pain areas + illness tracking

create table if not exists public.athlete_daily_checkins (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references public.athletes(id) on delete cascade,
  date                date not null,

  -- McLean 5-item wellbeing (1–5, higher = better)
  wellness_fatigue    smallint check (wellness_fatigue between 1 and 5),
  wellness_sleep      smallint check (wellness_sleep  between 1 and 5),
  wellness_soreness   smallint check (wellness_soreness between 1 and 5),
  wellness_stress     smallint check (wellness_stress  between 1 and 5),
  wellness_mood       smallint check (wellness_mood    between 1 and 5),

  -- Pain
  has_pain            boolean not null default false,
  pain_areas          jsonb   not null default '[]'::jsonb,
  -- pain_areas shape: [{areaId: number, areaLabel: string, severity: number (NRS 0-10)}]

  -- Illness
  has_illness         boolean not null default false,
  illness_type        text    check (illness_type in ('cold_flu','stomach','fever','other')),
  illness_type_other  text,
  illness_severity    text    check (illness_severity in ('mild','moderate','severe')),

  created_at          timestamptz not null default now(),

  unique (athlete_id, date)
);

-- RLS
alter table public.athlete_daily_checkins enable row level security;

-- Athletes can insert/update/read their own check-ins
create policy "athlete_daily_checkins_athlete_rw" on public.athlete_daily_checkins
  for all
  using (
    athlete_id in (
      select id from public.athletes where auth_user_id = auth.uid()
    )
  )
  with check (
    athlete_id in (
      select id from public.athletes where auth_user_id = auth.uid()
    )
  );

-- Coaches can read check-ins for their athletes
create policy "athlete_daily_checkins_coach_read" on public.athlete_daily_checkins
  for select
  using (
    athlete_id in (
      select id from public.athletes where coach_user_id = auth.uid()
    )
  );

-- Index for date-range queries in analysis tab
create index if not exists athlete_daily_checkins_athlete_date
  on public.athlete_daily_checkins (athlete_id, date desc);
