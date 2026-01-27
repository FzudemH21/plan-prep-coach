

## Plan: Fix Duplicate Description in Exercise Detail Dialog

### Problem Analysis
In the Exercise Detail Dialog, "Description" appears twice:
1. **Dedicated section** (line 411-428): "Description / Execution Instructions" - uses `exercise.description` (the special field on `CustomExercise`)
2. **Properties section** (line 440-448): Shows all columns except the first (exercise name), which includes a "Description" column with id `description`

This happens because:
- `CustomExercise` type has a special `description?: string` field (line 29 of `CustomLibrariesContext.tsx`)
- Default library columns include `{ id: 'description', name: 'Description', type: 'textarea' }` (line 142)

So the same concept is stored in two places and displayed twice.

### Solution
Filter out columns that are "reserved" special fields (like `description` and `videoUrl`) from the Properties section since they're already handled by their own dedicated UI sections.

### File to Modify
`src/components/shared/ExerciseDetailDialog.tsx`

---

### Change 1: Filter Reserved Columns in Edit Mode (Line 441)

**Current:**
```tsx
{columns.slice(1).map(column => (
  <div key={column.id} className="space-y-1">
    <Label className="text-xs text-muted-foreground">{column.name}</Label>
    {renderColumnInput(column, localData[column.id], (val) => 
      setLocalData(prev => ({ ...prev, [column.id]: val }))
    )}
  </div>
))}
```

**After:**
```tsx
{columns.slice(1)
  .filter(column => !['description', 'videoUrl', 'video_url', 'video'].includes(column.id.toLowerCase()))
  .map(column => (
    <div key={column.id} className="space-y-1">
      <Label className="text-xs text-muted-foreground">{column.name}</Label>
      {renderColumnInput(column, localData[column.id], (val) => 
        setLocalData(prev => ({ ...prev, [column.id]: val }))
      )}
    </div>
  ))}
```

This filters out:
- `description` - already shown in the dedicated Description/Execution Instructions section
- `videoUrl` / `video_url` / `video` - already shown in the Video section

---

### Change 2: Filter Reserved Columns in View Mode (Line 455)

**Current:**
```tsx
const firstColumnId = columns.length > 0 ? columns[0].id : null;
const filteredEntries = Object.entries(exerciseData).filter(([key]) => key !== firstColumnId);
```

**After:**
```tsx
const firstColumnId = columns.length > 0 ? columns[0].id : null;
const reservedKeys = ['description', 'videoUrl', 'video_url', 'video'];
const filteredEntries = Object.entries(exerciseData).filter(([key]) => 
  key !== firstColumnId && !reservedKeys.includes(key.toLowerCase())
);
```

This ensures the read-only characteristics view also excludes description/video fields.

---

### Visual Result

**Before:**
```
Description / Execution Instructions
[ textarea with description ]

Properties
Description: [ textarea - DUPLICATE! ]
Pattern: Hinge
```

**After:**
```
Description / Execution Instructions
[ textarea with description ]

Properties
Pattern: Hinge
```

The description appears only once in its dedicated section.

---

### Scope
This fix applies universally to the Exercise Detail Dialog, regardless of where it's opened from:
- Exercise Library table
- Workout Session Sheet
- Master Planner
- Any other location that uses this dialog

