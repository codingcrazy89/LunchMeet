# Agent 5: Lunch Meet Visibility Filtering

**Task:** Hosts can filter who sees their lunch by gender or "looking for".

**Scope:** New columns on lunches, host form UI, filter logic in fetchLunches.

**Files to create:**
- `migrations/add_lunch_visibility.sql` - Add visibility_gender TEXT[], visibility_looking_for TEXT[] to lunches

**Files to modify:**
- `app/(tabs)/host.web.tsx` - Add optional checkboxes for "Show to: Gender" (male, female, nonbinary, other) and "Show to: Looking for" (Networking, Friendship, Dating)
- `src/LunchContext.tsx` - Add visibility_gender, visibility_looking_for to select; fetch current user profile; filter lunches client-side: if lunch has visibility rules, only show to users whose profile matches (gender in list, looking_for overlaps)

**Instructions:**
1. Null = show to everyone. Non-null = filter.
2. For gender: user's profile.gender must be in visibility_gender list (case-insensitive).
3. For looking_for: user's profile.looking_for must overlap with visibility_looking_for.
4. Add state: visibilityGender, visibilityLookingFor. Include in insert when creating lunch.

**Permissions:** You have full permission to create and edit these files. Implement this feature completely.
