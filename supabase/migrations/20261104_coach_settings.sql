-- Small per-coach settings shared by the coach's devices (desktop + coach mobile),
-- e.g. which notifications are read. One row per coach; only the coach can read / write it.

create table if not exists public.coach_settings (
  coach_user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.coach_settings enable row level security;

drop policy if exists "Coach manages own settings" on public.coach_settings;
create policy "Coach manages own settings" on public.coach_settings
  for all using (auth.uid() = coach_user_id) with check (auth.uid() = coach_user_id);
