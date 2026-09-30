-- Body metrics moved to the parameter database.
--
-- Body metrics (Height, Weight, Body Fat, Resting Heart Rate, custom ones) used to be a separate
-- list; tests linked to them were stored as "bio:{id}". They are now parameters marked "Biometric"
-- with the SAME id (the coach app moves them on its next load). Results the athletes entered in the
-- athlete app for such tests are re-linked to the parameter id, so they show up with the parameter.

update public.athlete_test_results
set parameter_id = substring(parameter_id from 5)
where parameter_id like 'bio:%';
