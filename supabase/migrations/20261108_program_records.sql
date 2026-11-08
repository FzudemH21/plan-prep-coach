-- Training programs, one row per program. Until now all programs of a coach shared ONE row in
-- training_programs: every save rewrote all of them (~2 MB, loads started to time out), and one bad
-- save could overwrite every program (happened on 2026-11-01). Now a save writes only the program
-- that changed.
-- The app copies the programs over by itself on the next load; training_programs is left as it is
-- (a frozen backup). Deleting a program keeps its row with deleted_at set, so it can be brought back.
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.program_records (
  coach_user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,                          -- the program's id ("prog_…")
  data jsonb not null,                       -- the whole program
  last_modified_at timestamptz,              -- data.lastModifiedAt, for comparing without loading data
  deleted_at timestamptz,                    -- set when deleted on purpose
  updated_at timestamptz not null default now(),
  primary key (coach_user_id, id)
);

alter table public.program_records enable row level security;

drop policy if exists "Coach reads own programs" on public.program_records;
create policy "Coach reads own programs" on public.program_records
  for select using (auth.uid() = coach_user_id);

drop policy if exists "Coach inserts own programs" on public.program_records;
create policy "Coach inserts own programs" on public.program_records
  for insert with check (auth.uid() = coach_user_id);

drop policy if exists "Coach updates own programs" on public.program_records;
create policy "Coach updates own programs" on public.program_records
  for update using (auth.uid() = coach_user_id) with check (auth.uid() = coach_user_id);
