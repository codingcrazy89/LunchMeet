# Agent 1: Confirmation Prompt for Closing Lunch

**Task:** Add an "Are you sure?" confirmation before a host closes a lunch meet.

**Scope:** UI only. No database changes.

**Files to modify:**
- `app/(tabs)/my-lunches.tsx`
- `app/(tabs)/index.tsx`

**Instructions:**
1. Wrap the `closeLunch` call in both files with `Alert.alert` (native) or `window.confirm` (web).
2. Copy the pattern from the existing "Leave Lunch" button (which already has confirmation).
3. Message: "Are you sure you want to close this lunch meet? This cannot be undone."
4. Buttons: Cancel (style: cancel) and Close Lunch (style: destructive).

**Reference:** Leave Lunch uses this pattern in `index.tsx` around lines 291-314.

**Permissions:** You have full permission to edit the specified files. Implement this feature completely.
