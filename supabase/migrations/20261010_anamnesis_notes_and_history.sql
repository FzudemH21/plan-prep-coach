-- Anamnesis: notes as separate entries (typed or dictated) and a change history.
--
-- 1. note_entries: the notes of an anamnesis as a list ({ id, text, createdAt, updatedAt?, source:
--    'typed' | 'dictated' }). The plain `notes` column stays and is kept in step as text (read by the
--    AI analysis and the PDF). Older records keep their `notes` text; the app shows it as one note.
-- 2. anamnesis_change_log: who changed what and when (answers edited in edit mode, notes added /
--    edited / deleted, AI summary). Append-only: the coach can read and add entries, but not change
--    or delete them (no update/delete policies). Entries go with their anamnesis when it is deleted
--    (also when the athlete is deleted).
--
-- Dictation audio is never stored here: it is turned into text (Mistral, EU) and deleted.

alter table public.athlete_anamneses
  add column if not exists note_entries jsonb not null default '[]'::jsonb;

create table if not exists public.anamnesis_change_log (
  id              uuid primary key default gen_random_uuid(),
  anamnesis_id    uuid not null references public.athlete_anamneses(id) on delete cascade,
  coach_user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  changed_at      timestamptz not null default now(),
  changed_by      uuid default auth.uid(),
  changed_by_name text,
  summary         text not null,
  changes         jsonb not null default '[]'::jsonb
);

create index if not exists anamnesis_change_log_anamnesis_idx
  on public.anamnesis_change_log (anamnesis_id, changed_at desc);

alter table public.anamnesis_change_log enable row level security;

drop policy if exists "Coaches read the history of their anamneses" on public.anamnesis_change_log;
create policy "Coaches read the history of their anamneses"
  on public.anamnesis_change_log
  for select to authenticated
  using (coach_user_id = auth.uid());

drop policy if exists "Coaches add to the history of their anamneses" on public.anamnesis_change_log;
create policy "Coaches add to the history of their anamneses"
  on public.anamnesis_change_log
  for insert to authenticated
  with check (
    coach_user_id = auth.uid()
    and changed_by = auth.uid()
    -- the time is the server's (no back-dated entries)
    and changed_at between now() - interval '1 minute' and now() + interval '1 minute'
    and exists (
      select 1 from public.athlete_anamneses a
      where a.id = anamnesis_id and a.coach_user_id = auth.uid()
    )
  );
