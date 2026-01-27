

## Plan: Simplify Athletes Navigation to Direct Link

### Summary
Remove the collapsible dropdown for "Athletes" in the navigation sidebar and make it a direct link to the Athlete Database, since there's only one item in that section.

---

### Current Behavior
```
▼ Athletes                    (collapsible header)
    └── Athlete Database      (sub-item)
```

### Proposed Behavior
```
Athlete Database              (direct link, same level as Home/Analytics)
```

---

### Implementation

**File**: `src/components/layout/NavigationSidebar.tsx`

**Change**: Replace the `renderNavGroup(athletesGroup, "athletes")` call with a standalone button, similar to how "Home" and "Analytics" are rendered.

#### Remove
- The `athletesGroup` definition (lines 98-104)
- The `athletes: true` from initial `openGroups` state (line 62)
- The `{renderNavGroup(athletesGroup, "athletes")}` call (line 257)

#### Add
A standalone button for "Athlete Database" between Home and Templates:

```tsx
{/* Athlete Database - standalone */}
<Button
  variant="ghost"
  className={cn(
    "w-full justify-start h-10",
    isActive("/athletes") && "bg-accent text-accent-foreground font-medium"
  )}
  onClick={() => handleNavigate("/athletes")}
>
  <Users className="h-4 w-4 mr-2" />
  Athlete Database
</Button>
```

---

### Visual Result

**Before:**
```
Home
▼ Athletes
    Athlete Database
▼ Templates & Library
    Training Programs
    ...
Analytics
```

**After:**
```
Home
Athlete Database
▼ Templates & Library
    Training Programs
    ...
Analytics
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/layout/NavigationSidebar.tsx` | Replace Athletes collapsible group with direct link button |

