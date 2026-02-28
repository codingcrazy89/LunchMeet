# Agent 2: Profile Tab Field Labels

**Task:** Add descriptive labels above each field on the profile edit screen.

**Scope:** UI only. No database changes.

**Files to modify:**
- `app/(tabs)/profile.tsx`

**Instructions:**
1. Add labels above each TextInput: "Name", "Age", "Gender", "Short bio".
2. Use the same structure as the public profile in `app/profile/[id].tsx` (fieldContainer with label and value).
3. Wrap each TextInput in a View with a Text label above it.
4. Add styles: fieldContainer, fieldLabel (Typography.titleSmall, color: Colors.textSecondary, marginBottom).

**Reference:** Public profile at `app/profile/[id].tsx` uses fieldContainer and label styles.

**Permissions:** You have full permission to edit profile.tsx. Implement this feature completely.
