# Agent 4: User Ranking (1-5 Stars)

**Task:** Allow users to rate each other 1-5 stars after participating in a lunch meet.

**Scope:** New table, migrations, components, LunchContext, UI in my-lunches and index.

**Files to create:**
- `migrations/create_user_ratings.sql` - Table: id, rater_id, rated_id, lunch_id, rating (1-5), created_at. Unique(rater_id, rated_id, lunch_id). RLS. RPC get_user_average_rating.
- `components/StarRating.tsx` - Reusable 1-5 star picker
- `components/RateAttendeeModal.tsx` - Modal to rate one person

**Files to modify:**
- `src/LunchContext.tsx` - Add submitRating(ratedId, lunchId, rating), add to type and provider
- `app/(tabs)/my-lunches.tsx` - Add "Rate" button for past lunches (host rates attendees)
- `app/(tabs)/index.tsx` - Add "Rate" for past lunches (attendee rates host and other attendees)
- `app/profile/[id].tsx` - Show average rating via get_user_average_rating RPC

**Instructions:**
1. Only allow rating after lunch date_time has passed.
2. Host can rate accepted attendees. Attendees can rate host and other attendees.
3. Use upsert with onConflict for rater_id, rated_id, lunch_id.
4. Display average rating on public profile when > 0.

**Permissions:** You have full permission to create and edit these files. Implement this feature completely.
