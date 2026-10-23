-- Assigned plans (the coach-side plan of an athlete's program assignment: sessions per day,
-- exercises, parameter values, intensities) were stored ONLY in the localStorage of the browser
-- where the program was assigned / edited. Other browsers and devices showed a different
-- calendar and their syncs overwrote the athlete app with a different copy.
--
-- One row per assignment; `data` is the same JSON the browser keeps under
-- localStorage "athlete-assignment-<assignment id>" (the browser keeps it as a cache).
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.athlete_assignment_plans (
  assignment_id text primary key,
  coach_user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists athlete_assignment_plans_coach_idx
  on public.athlete_assignment_plans (coach_user_id);

alter table public.athlete_assignment_plans enable row level security;

drop policy if exists "Coach reads own assignment plans" on public.athlete_assignment_plans;
create policy "Coach reads own assignment plans" on public.athlete_assignment_plans
  for select using (auth.uid() = coach_user_id);

drop policy if exists "Coach inserts own assignment plans" on public.athlete_assignment_plans;
create policy "Coach inserts own assignment plans" on public.athlete_assignment_plans
  for insert with check (auth.uid() = coach_user_id);

drop policy if exists "Coach updates own assignment plans" on public.athlete_assignment_plans;
create policy "Coach updates own assignment plans" on public.athlete_assignment_plans
  for update using (auth.uid() = coach_user_id) with check (auth.uid() = coach_user_id);

drop policy if exists "Coach deletes own assignment plans" on public.athlete_assignment_plans;
create policy "Coach deletes own assignment plans" on public.athlete_assignment_plans
  for delete using (auth.uid() = coach_user_id);
