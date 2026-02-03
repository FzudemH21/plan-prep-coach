
# Enhanced Exercise Addition for Athlete Calendar Ad-hoc Sessions

## Status: ✅ IMPLEMENTED

## Overview

Created a new enhanced workflow for adding exercises to ad-hoc sessions in the Athlete Calendar. This allows coaches to select from ALL training methods in the Training Toolbox (not just those configured in periodization) and customize which parameters appear in the workout grid.

## User Flow

```text
1. Click "Add Exercise" in an ad-hoc session
        ↓
2. Exercise Library Popup opens → Select exercise(s)
        ↓
3. AdHocMethodSelectionDialog opens:
   - Left panel: Searchable method list from toolbox (grouped by category)
   - Right panel: Parameter visibility checkboxes when method selected
   - Set parameter always checked and disabled
   - Frequency parameter excluded
        ↓
4. Exercise added to session with selected parameters
```

## Files Created/Modified

### Created: `src/components/microcycle-planning/AdHocMethodSelectionDialog.tsx`
- Two-panel dialog layout
- Method selection from all toolbox entries
- Parameter visibility configuration
- Set parameter always required
- Returns methodId, categoryName, visibility overrides, and initial parameters

### Modified: `src/components/microcycle-planning/WorkoutSessionSheet.tsx`
- Added `isAdHocSession?: boolean` prop
- Added `handleAdHocMethodSelected` handler
- Conditional dialog rendering based on `isAdHocSession`

### Modified: `src/components/athletes/AthleteCalendarView.tsx`
- Passes `isAdHocSession={true}` to WorkoutSessionSheet
