
# Enhanced Exercise Addition for Athlete Calendar Ad-hoc Sessions

## Overview

Create a new enhanced workflow for adding exercises to ad-hoc sessions in the Athlete Calendar. This allows coaches to select from ALL training methods in the Training Toolbox (not just those configured in periodization) and customize which parameters appear in the workout grid.

## User Flow

```text
1. Click "Add Exercise" in an ad-hoc session
        ↓
2. Exercise Library Popup opens → Select exercise(s)
        ↓
3. NEW: Enhanced Method & Parameter Selection Dialog
   ┌────────────────────────────────────────────────┐
   │  Select Training Method                         │
   │  ─────────────────────────────────────────────  │
   │  🔍 Search methods...                          │
   │                                                 │
   │  ▼ Sprinting                                   │
   │     ○ Acceleration                             │
   │     ○ Top Speed                                │
   │     ○ Resisted Sprinting                       │
   │                                                 │
   │  ▼ Lower Body Resistance Training              │
   │     ● Strength  ← Selected                     │
   │     ○ Power                                    │
   │                                                 │
   │  ─────────────────────────────────────────────  │
   │  Configure Parameters (for "LB RT - Strength") │
   │  ─────────────────────────────────────────────  │
   │  ☑ Sets [#]              (always on, disabled) │
   │  ☑ Reps [#]              ← visible by default  │
   │  ☑ Intensity [%1RM]      ← visible by default  │
   │  ☐ Set Type              ← hidden by default   │
   │  ☐ Organization          ← hidden by default   │
   │  ☑ Inter-Set Rest [s]    ← toggled on          │
   │                                                 │
   │            [Cancel]  [Add Exercise]            │
   └────────────────────────────────────────────────┘
        ↓
4. Exercise added to session with selected parameters
```

## Technical Design

### New Component: `AdHocMethodSelectionDialog.tsx`

A new dialog component specifically for ad-hoc sessions that:

1. **Lists ALL methods from Training Toolbox** (grouped by category, searchable)
2. **Shows parameter configuration** when a method is selected
3. **Set parameter is always checked and disabled** (cannot be hidden)
4. **Other parameters default** to their `showInGridByDefault` value from toolbox
5. **User can toggle** any parameter on/off before confirming
6. Returns both the selected method AND the parameter visibility overrides

### Props Interface

```typescript
interface AdHocMethodSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMethodSelected: (
    methodId: string,
    categoryName: string | undefined,
    parameterVisibility: ParameterVisibilityOverrides,
    initialParameters: Record<string, string | number>
  ) => void;
  toolboxData: ToolboxDatabase;
  needsExplicitOverlay?: boolean;
}
```

### Method Selection Logic

```typescript
// Get all unique methods from toolbox
const allMethods = useMemo(() => {
  const methodMap = new Map<string, ToolboxEntry[]>();
  
  toolboxData.entries.forEach(entry => {
    const methodId = entry.subCategory 
      ? `${entry.category} - ${entry.subCategory}`
      : entry.category;
    
    if (!methodMap.has(methodId)) {
      methodMap.set(methodId, []);
    }
    methodMap.get(methodId)!.push(entry);
  });
  
  return methodMap;
}, [toolboxData]);
```

### Parameter Configuration Logic

```typescript
// When a method is selected, show its parameters
const selectedMethodParams = useMemo(() => {
  if (!selectedMethodId) return [];
  
  const entries = allMethods.get(selectedMethodId) || [];
  return entries.map(entry => ({
    name: entry.parameterName,
    type: entry.parameterType,
    options: entry.options,
    isSetParameter: entry.isSetParameter,
    isFrequencyParameter: entry.isFrequencyParameter,
    showInGridByDefault: entry.showInGridByDefault ?? true,
  }));
}, [selectedMethodId, allMethods]);

// Initialize parameter visibility from defaults
const [paramVisibility, setParamVisibility] = useState<Record<string, boolean>>({});

useEffect(() => {
  if (selectedMethodParams.length > 0) {
    const initial: Record<string, boolean> = {};
    selectedMethodParams.forEach(p => {
      // Set parameter is ALWAYS visible
      if (p.isSetParameter) {
        initial[p.name] = true;
      } else if (!p.isFrequencyParameter) {
        // Non-frequency params use their default
        initial[p.name] = p.showInGridByDefault;
      }
    });
    setParamVisibility(initial);
  }
}, [selectedMethodParams]);
```

### Initial Parameters Generation

Since there's no periodization table for ad-hoc sessions, generate empty/default parameters:

```typescript
const generateInitialParameters = () => {
  const params: Record<string, string | number> = {};
  
  selectedMethodParams.forEach(p => {
    if (p.isFrequencyParameter) return; // Skip frequency
    
    if (p.isSetParameter) {
      params[p.name] = 3; // Default 3 sets
    } else {
      params[p.name] = ''; // Empty value for user to fill
    }
  });
  
  return params;
};
```

## Files to Create/Modify

### New File: `src/components/microcycle-planning/AdHocMethodSelectionDialog.tsx`

New dialog component with:
- Searchable method list from toolbox (grouped by category)
- Parameter visibility checkboxes when method selected
- Set parameter always checked and disabled
- Frequency parameter excluded
- Returns method + visibility overrides + initial parameters

### Modify: `src/components/microcycle-planning/WorkoutSessionSheet.tsx`

1. Add prop `isAdHocSession?: boolean` to indicate athlete calendar context
2. When `isAdHocSession` is true AND no `availableMethods`:
   - Use `AdHocMethodSelectionDialog` instead of `MethodSelectionDialog`
   - Pass `toolboxData` to the new dialog
3. Handle the extended callback with parameter visibility

### Modify: `src/components/athletes/AthleteCalendarView.tsx`

1. Pass `isAdHocSession={true}` to `WorkoutSessionSheet` when opened for ad-hoc sessions
2. Ensure `toolboxData` is available and passed through

## Implementation Sequence

1. **Create `AdHocMethodSelectionDialog.tsx`**
   - Two-panel layout: method selection (left/top) + parameter config (right/bottom)
   - Method list from toolbox, grouped and searchable
   - Parameter checkboxes with set param locked on
   - Confirm button returns all needed data

2. **Update `WorkoutSessionSheet.tsx`**
   - Add `isAdHocSession` prop
   - Conditional dialog rendering based on context
   - Handle extended callback with visibility overrides

3. **Update `AthleteCalendarView.tsx`**
   - Pass `isAdHocSession={true}` flag
   - Ensure toolbox data flows through

## Edge Cases Handled

- **Methods without sub-category**: Use just category as method ID
- **Methods with no parameters**: Show info message, allow adding exercise anyway
- **Set parameter not defined**: Default to 3 sets with generic "Sets" parameter
- **Empty toolbox**: Show helpful message directing to Training Toolbox
