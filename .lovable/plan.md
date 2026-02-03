# Fix: Parameter Grid Auto-Fill and Intensity Coupling Issues

## Status: ✅ COMPLETED

Both issues have been fixed:

1. **Parameter Grid Auto-Fill Bug** - FIXED
   - Added `parameterSource: 'toolbox'` check in the fallback branch of `buildSectionsFromExercises()` (WorkoutSessionSheet.tsx lines 495-568)
   - Ad-hoc exercises now generate blank parameters instead of pulling from periodization table

2. **Intensity Coupling Bug** - FIXED
   - Updated `handleSessionIntensityChange` to use `daySplitStates` as source of truth (useAthleteCalendarEditing.ts lines 1273-1284)
   - 1-session days: Day and session intensity remain linked (bidirectional sync)
   - Multi-session days: Independent - changing session intensity does NOT affect day intensity

## Changes Made

### WorkoutSessionSheet.tsx
- Added toolbox-sourced exercise check at the beginning of the fallback forEach loop
- Exercises with `parameterSource: 'toolbox'` now get blank parameters (Sets=3, other params empty)
- Skips periodization lookup entirely for ad-hoc exercises

### useAthleteCalendarEditing.ts
- Changed `handleSessionIntensityChange` to check `daySplitStates[dayDate]` instead of `trainingDays[].sessions`
- Multi-session days now have independent session intensities (stored via sheet's local state)
