

# Fix Dialog Overlay Styling for Nested Dialogs

## What Changes

Two visual fixes for the Manage Tests/Events dialog and its nested Add New Parameter dialog:

1. **Lighten the Manage Tests/Events overlay** -- change from `bg-black/80` (nearly opaque black) to `bg-black/30` so the background is only slightly grayed out and you can still see through it.

2. **Add a proper overlay for the Add New Parameter dialog** -- when the nested dialog opens, it should have its own semi-transparent overlay (at a higher z-index) so it visually separates from the Manage Tests/Events dialog behind it.

## Technical Details

### File: `src/components/microcycle-planning/CombinedTestEventDialog.tsx`
- Change the `DialogOverlay` className from `bg-black/80` to `bg-black/30` (line 215)

### File: `src/components/goals/AddParameterDialogV2.tsx`
- The `DialogContent` already accepts a `containerClassName` prop (passed as `z-[200]`), but the dialog's default overlay (from the `dialog.tsx` component) uses `bg-black/80` at `z-[100]` -- which sits *behind* the Manage Tests/Events dialog.
- Add an explicit `DialogOverlay` inside `AddParameterDialogV2` with `z-[190] bg-black/40` so the overlay renders above the Manage Tests/Events content, creating a clear visual separation.
- Update the `DialogContent` to use `DialogPortal` explicitly so we can insert the custom overlay alongside it, matching the pattern already used in `CombinedTestEventDialog`.

