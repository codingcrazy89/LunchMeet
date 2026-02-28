# Agent 7: Direct Private Invites

**Task:** Users can search for others by email and send a private invite to a specific lunch.

**Scope:** New table, RPC, modal, LunchContext, my-lunches, index.

**Files to create:**
- `migrations/create_lunch_invites.sql` - Table lunch_invites: id, lunch_id, inviter_id, invitee_id, status (pending/accepted/declined). Unique(lunch_id, invitee_id). RLS. RPC search_users_by_email(p_search) for invite flow.
- `components/InviteUserModal.tsx` - Search input, results list, Invite button per user

**Files to modify:**
- `src/LunchContext.tsx` - Add invites state, fetchInvites, acceptInvite, declineInvite. Fetch pending invites for current user with lunch details. acceptInvite: insert lunch_attendees, update invite, decrement seats. declineInvite: update status.
- `app/(tabs)/my-lunches.tsx` - Add "Invite by email" button; open InviteUserModal with lunchId, lunchRestaurant; onInviteSent refresh
- `app/(tabs)/index.tsx` - Show invites section at top with Accept/Decline buttons when invites.length > 0

**Instructions:**
1. Only host (or co-host) can send invites.
2. Invitee sees "You have lunch invites" with restaurant name and inviter. Accept adds them to lunch_attendees (accepted), decrements seats. Decline updates invite status.
3. search_users_by_email returns id, name, email for partial email match (limit 10).

**Permissions:** You have full permission to create and edit these files. Implement this feature completely.
