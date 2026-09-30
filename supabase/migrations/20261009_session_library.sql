-- Session Library in Supabase (was only in the browser: localStorage 'ppc-session-library').
--
-- Same one-row-per-coach JSONB layout as the other stores (useSupabaseStore): the whole library
-- ({ version, columns, entries }) in `data`. The app uploads the browser's library on first load and
-- merges libraries from other browsers/devices into it.

create table if not exists public.session_library (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz default now()
);

alter table public.session_library enable row level security;

drop policy if exists "Coaches manage their own session library" on public.session_library;
create policy "Coaches manage their own session library"
  on public.session_library
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
