# Agent 6: Co-Host Feature

**Task:** A lunch can have a co-host who can accept/deny requests and manage the lunch like the host.

**Scope:** New column, RPC for user lookup, host form, LunchContext, my-lunches, index.

**Files to create:**
- `migrations/add_co_host_to_lunches.sql` - Add co_host_id UUID to lunches. RPC get_user_by_email(p_email) returns id, name from auth.users + profiles.

**Files to modify:**
- `app/(tabs)/host.web.tsx` - Add optional "Co-host email" TextInput. On create, call get_user_by_email; if found and not self, add co_host_id to insert.
- `src/LunchContext.tsx` - Add co_host_id to select and LunchMeet type; fetch co_host_profile; in acceptRequest, denyRequest, closeLunch check host_id OR co_host_id; add co_host_profile to normalized data
- `app/(tabs)/my-lunches.tsx` - Filter: host_id OR co_host_id; show Co-host in card when present
- `app/(tabs)/index.tsx` - isCoHost = co_host_id === user?.id; pending requests, close button, chat for co-host same as host

**Instructions:**
1. Co-host has same powers as host: accept/deny, close lunch, access chat.
2. Host enters co-host email; lookup via RPC; insert co_host_id.
3. My Lunches shows lunches where user is host OR co-host.

**Permissions:** You have full permission to create and edit these files. Implement this feature completely.
