-- Phase 1 check (read-only): did every library arrive in coach_records?
-- Compares the old one-row tables (frozen backup) with the new rows, for the coach with the most
-- athletes (you). "old" and "new" should match. Two expected differences:
--   - exercises: an exercise without an id or with an id used twice stays inside its library's
--     order list instead of getting its own row (new can be a little lower)
--   - items added or deleted after the move (old tables are no longer updated)
-- A library shows up only after its page was opened once (the copy runs when it is first loaded).

with me as (
  select coach_user_id as uid from public.athlete_records group by coach_user_id order by count(*) desc limit 1
),
rec as (
  select c.store, c.id from public.coach_records c, me
  where c.coach_user_id = me.uid and c.deleted_at is null
),
old_lib as (select l.data from public.custom_libraries l, me where l.user_id = me.uid),
old_tb as (select t.data from public.toolbox_data t, me where t.user_id = me.uid),
old_par as (select p.data from public.parameters_database p, me where p.user_id = me.uid),
old_tpl as (select t.data from public.programming_templates t, me where t.user_id = me.uid),
old_ses as (select s.data from public.session_library s, me where s.user_id = me.uid),
old_cal as (select c.data from public.calendar_events c, me where c.user_id = me.uid)
select 'exercise libraries' as what,
  (select jsonb_array_length(coalesce(data->'libraries', '[]')) from old_lib) as old,
  (select count(*) from rec where store = 'exercises' and id like 'lib:%') as new,
  (select count(*) from rec where store = 'exercises' and id = '_meta') as meta_row
union all select 'exercises',
  (select sum(jsonb_array_length(coalesce(l->'exercises', '[]'))) from old_lib, jsonb_array_elements(coalesce(data->'libraries', '[]')) l),
  (select count(*) from rec where store = 'exercises' and id like 'ex:%'), null
union all select 'circuits',
  (select sum(jsonb_array_length(coalesce(l->'circuits', '[]'))) from old_lib, jsonb_array_elements(coalesce(data->'libraries', '[]')) l),
  (select count(*) from rec where store = 'exercises' and id like 'ci:%'), null
union all select 'training methods',
  (select count(distinct (e->>'category') || '|||' || (e->>'subCategory')) from old_tb, jsonb_array_elements(coalesce(data->'entries', '[]')) e),
  (select count(*) from rec where store = 'methods' and id like 'm:%'),
  (select count(*) from rec where store = 'methods' and id = '_meta')
union all select 'parameters',
  (select jsonb_array_length(coalesce(data->'parameters', '[]')) from old_par),
  (select count(*) from rec where store = 'parameters' and id like 'p:%'),
  (select count(*) from rec where store = 'parameters' and id = '_meta')
union all select 'parameter interactions',
  (select jsonb_array_length(coalesce(data->'interactions', '[]')) from old_par),
  (select count(*) from rec where store = 'parameters' and id like 'i:%'), null
union all select 'parameter method links',
  (select jsonb_array_length(coalesce(data->'parameterMethods', '[]')) from old_par),
  (select count(*) from rec where store = 'parameters' and id like 'pm:%'), null
union all select 'programming templates',
  (select jsonb_array_length(coalesce(data->'templates', '[]')) from old_tpl),
  (select count(*) from rec where store = 'templates' and id like 't:%'),
  (select count(*) from rec where store = 'templates' and id = '_meta')
union all select 'session library',
  (select jsonb_array_length(coalesce(data->'entries', '[]')) from old_ses),
  (select count(*) from rec where store = 'workouts' and id like 'w:%'),
  (select count(*) from rec where store = 'workouts' and id = '_meta')
union all select 'athletes with tests/events',
  (select count(*) from old_cal, jsonb_object_keys(coalesce(data, '{}')) k),
  (select count(*) from rec where store = 'calendar_events' and id like 'a:%'), null;
