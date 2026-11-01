-- Version history of training programs. All programs of a coach share one row in
-- training_programs, so one bad save could overwrite every program (happened on 2026-11-01).
-- Every program now keeps earlier versions here (at most one per hour while it is edited, plus one
-- whenever it is deleted or restored; the 15 newest per program are kept), so any program can be
-- put back to an earlier state from the program library ("Version history").
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.program_versions (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references auth.users (id) on delete cascade,
  program_id text not null,
  program_name text,
  reason text not null default 'edit',      -- 'edit' | 'deleted' | 'before-restore'
  saved_at timestamptz not null default now(),
  data jsonb not null
);

create index if not exists program_versions_coach_program_idx
  on public.program_versions (coach_user_id, program_id, saved_at desc);

alter table public.program_versions enable row level security;

drop policy if exists "Coach reads own program versions" on public.program_versions;
create policy "Coach reads own program versions" on public.program_versions
  for select using (auth.uid() = coach_user_id);

drop policy if exists "Coach inserts own program versions" on public.program_versions;
create policy "Coach inserts own program versions" on public.program_versions
  for insert with check (auth.uid() = coach_user_id);

drop policy if exists "Coach deletes own program versions" on public.program_versions;
create policy "Coach deletes own program versions" on public.program_versions
  for delete using (auth.uid() = coach_user_id);
