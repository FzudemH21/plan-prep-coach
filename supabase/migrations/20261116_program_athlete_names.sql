-- Programs keep their athlete's name (data.athleteName), so coaches who aren't assigned to that
-- athlete (and can't look them up) still see whom a program is for. The app stores it on every save
-- from now on; this fills it in once for the programs saved before.
--
-- Only adds the name to programs that have an athlete and no name yet — nothing else changes (not
-- the program's content, its "last modified", or its author). Safe to run more than once.

update public.program_records p
   set data = jsonb_set(p.data, '{athleteName}', to_jsonb(nullif(trim(concat_ws(' ',
                 nullif(trim(a.data->'athlete'->>'firstName'), ''),
                 nullif(trim(a.data->'athlete'->>'middleName'), ''),
                 nullif(trim(a.data->'athlete'->>'lastName'), ''))), '')))
  from public.athlete_records a
 where a.coach_user_id = p.coach_user_id
   and a.id = p.data->>'athleteId'
   and coalesce(p.data->>'athleteName', '') = ''
   and nullif(trim(concat_ws(' ', a.data->'athlete'->>'firstName', a.data->'athlete'->>'lastName')), '') is not null;

-- Check: programs with an athlete, and how many of them now carry the name
select count(*) filter (where coalesce(data->>'athleteId', '') <> '') as programs_with_athlete,
       count(*) filter (where coalesce(data->>'athleteName', '') <> '') as with_name
  from public.program_records
 where deleted_at is null;
