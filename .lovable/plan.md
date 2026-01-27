
## Plan: Replace "Next" Button with Final Action on Last Step of Microcycle Planning

### Summary
On the last step of Microcycle Planning (Step 2 - Training Calendar), replace the disabled "Next" button with a meaningful final action. The best option is to show a "Save & Finish" button that saves the program and navigates back to the library, since that's the logical conclusion of the planning workflow.

---

### Current Behavior
- **Step 1**: "Previous" goes to Mesocycle, "Next" goes to Step 2 ✓
- **Step 2**: "Previous" goes to Step 1, "Next" is **disabled** (confusing - implies there's more)

### Proposed Behavior
- **Step 1**: "Previous" goes to Mesocycle, "Next" goes to Step 2 (unchanged)
- **Step 2**: "Previous" goes to Step 1, **"Save & Finish"** saves and navigates to library

---

### Implementation

**File**: `src/pages/MicrocyclePlanningPage.tsx`

**Location**: Lines 2929-2955 (NavigationButtons component)

**Change**: Modify the NavigationButtons component to conditionally render different right-side buttons based on whether the user is on the last step.

```text
Current:
+------------------+     +------------------+
|  ← Previous      |     |   Next →         |  (disabled on Step 2)
+------------------+     +------------------+

After:
Step 1:
+------------------+     +------------------+
|  ← Back to       |     |   Next →         |
|    Mesocycle     |     |                  |
+------------------+     +------------------+

Step 2:
+------------------+     +------------------+
|  ← Previous      |     | ✓ Save & Finish  |
+------------------+     +------------------+
```

### Code Changes

```tsx
const NavigationButtons = () => {
  const isLastStep = currentStep >= totalSteps;
  
  return (
    <div className="flex flex-col md:flex-row md:justify-between items-stretch md:items-center gap-3 w-full">
      <Button 
        onClick={() => {
          if (currentStep <= 1) {
            localStorage.setItem('mesocycleStep', '5');
            navigate('/mesocycle');
          } else {
            setCurrentStep(Math.max(1, currentStep - 1));
          }
        }}
        variant="outline"
        className="w-full md:w-auto"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {currentStep <= 1 ? "Back to Mesocycle Planning" : "Previous"}
      </Button>
      
      {isLastStep ? (
        <Button 
          onClick={() => {
            saveCurrentSession();
            toast({
              title: "Program saved",
              description: "Your training program has been saved.",
            });
            navigate("/templates/programs");
          }}
          className="w-full md:w-auto"
        >
          <Check className="mr-2 h-4 w-4" />
          Save & Finish
        </Button>
      ) : (
        <Button 
          onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
          className="w-full md:w-auto"
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
```

### Import Required
Add `Check` to the existing lucide-react imports:
```tsx
import { ArrowLeft, ArrowRight, ..., Check } from 'lucide-react';
```

---

### Alternative Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Save & Finish** (navigates to library) | Clear completion, prevents "dead end" | User leaves the page |
| **Save Program** (same as header) | Duplicates existing functionality | Redundant with header button |
| **Complete Planning** (no navigation) | Stays on page | Less clear what happens |
| **Hide button entirely** | Simple | Unbalanced layout |

**Recommendation**: "Save & Finish" provides the clearest indication that the user has completed the planning workflow and gives them a smooth transition back to their program library.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/MicrocyclePlanningPage.tsx` | Modify NavigationButtons to show "Save & Finish" on last step |

---

### Visual Result

**Step 1 (Exercise Distribution)**:
```
[ ← Back to Mesocycle Planning ]                    [ Next → ]
```

**Step 2 (Training Calendar)**:
```
[ ← Previous ]                               [ ✓ Save & Finish ]
```

The "Save & Finish" button saves the program and navigates the user back to the Training Programs library, providing a clear conclusion to the planning workflow.
