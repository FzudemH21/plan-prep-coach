-- AI summary of an anamnesis (2026-11-21): the coach's answers to the AI's questions are kept with
-- the anamnesis, so a later "Regenerate" (after adding notes, a new appointment …) uses them again
-- instead of asking everything anew. A list of { question, answer }; only read and written by the
-- coaches who reach the anamnesis (the existing rules of athlete_anamneses apply), never shown to
-- the athlete. Adds one column; nothing existing changes. Safe to run more than once.

alter table public.athlete_anamneses
  add column if not exists ai_clarifications jsonb;

-- Check: the column exists (expect 1)
select count(*) as ai_clarifications_column
  from information_schema.columns
 where table_schema = 'public' and table_name = 'athlete_anamneses' and column_name = 'ai_clarifications';
