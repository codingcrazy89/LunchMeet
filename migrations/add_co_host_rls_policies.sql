-- Migration: Update RLS policies to allow co-hosts same powers as hosts
-- Run this after add_co_host_to_lunches.sql
-- Run this SQL in your Supabase SQL Editor

-- 1. lunch_attendees: Allow co-hosts to update and delete attendee requests
DROP POLICY IF EXISTS "Hosts can update attendee status for their lunches" ON lunch_attendees;
DROP POLICY IF EXISTS "Hosts can delete attendee requests for their lunches" ON lunch_attendees;

CREATE POLICY "Hosts and co-hosts can update attendee status for their lunches"
ON lunch_attendees
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM lunches
    WHERE lunches.id = lunch_attendees.lunch_id
    AND (lunches.host_id = auth.uid() OR lunches.co_host_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lunches
    WHERE lunches.id = lunch_attendees.lunch_id
    AND (lunches.host_id = auth.uid() OR lunches.co_host_id = auth.uid())
  )
);

CREATE POLICY "Hosts and co-hosts can delete attendee requests for their lunches"
ON lunch_attendees
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM lunches
    WHERE lunches.id = lunch_attendees.lunch_id
    AND (lunches.host_id = auth.uid() OR lunches.co_host_id = auth.uid())
  )
);

-- 2. chat_rooms: Allow co-hosts to view chat rooms
DROP POLICY IF EXISTS "Users can view chat rooms for their lunches" ON chat_rooms;

CREATE POLICY "Users can view chat rooms for their lunches"
ON chat_rooms
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM lunches
    WHERE lunches.id = chat_rooms.lunch_id
    AND (
      lunches.host_id = auth.uid()
      OR lunches.co_host_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM lunch_attendees
        WHERE lunch_attendees.lunch_id = lunches.id
        AND lunch_attendees.user_id = auth.uid()
        AND lunch_attendees.status = 'accepted'
      )
    )
  )
);

-- 3. messages: Allow co-hosts to view and send messages
DROP POLICY IF EXISTS "Users can view messages in their chat rooms" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their chat rooms" ON messages;

CREATE POLICY "Users can view messages in their chat rooms"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_rooms
    JOIN lunches ON lunches.id = chat_rooms.lunch_id
    WHERE chat_rooms.id = messages.chat_room_id
    AND (
      lunches.host_id = auth.uid()
      OR lunches.co_host_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM lunch_attendees
        WHERE lunch_attendees.lunch_id = lunches.id
        AND lunch_attendees.user_id = auth.uid()
        AND lunch_attendees.status = 'accepted'
      )
    )
  )
);

CREATE POLICY "Users can send messages in their chat rooms"
ON messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM chat_rooms
    JOIN lunches ON lunches.id = chat_rooms.lunch_id
    WHERE chat_rooms.id = messages.chat_room_id
    AND (
      lunches.host_id = auth.uid()
      OR lunches.co_host_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM lunch_attendees
        WHERE lunch_attendees.lunch_id = lunches.id
        AND lunch_attendees.user_id = auth.uid()
        AND lunch_attendees.status = 'accepted'
      )
    )
  )
);

-- 4. Update RPC functions to allow co-hosts (if they exist)
CREATE OR REPLACE FUNCTION accept_attendee_request(
  p_attendee_id UUID,
  p_lunch_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_host_id UUID;
  v_co_host_id UUID;
BEGIN
  SELECT host_id, co_host_id INTO v_host_id, v_co_host_id
  FROM lunches
  WHERE id = p_lunch_id;
  
  IF v_host_id != auth.uid() AND (v_co_host_id IS NULL OR v_co_host_id != auth.uid()) THEN
    RAISE EXCEPTION 'Only the host or co-host can accept requests';
  END IF;
  
  UPDATE lunch_attendees
  SET status = 'accepted'
  WHERE id = p_attendee_id
  AND lunch_id = p_lunch_id;
  
  UPDATE lunches
  SET seats = GREATEST(0, seats - 1)
  WHERE id = p_lunch_id;
END;
$$;

CREATE OR REPLACE FUNCTION deny_attendee_request(
  p_attendee_id UUID,
  p_lunch_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_host_id UUID;
  v_co_host_id UUID;
BEGIN
  SELECT host_id, co_host_id INTO v_host_id, v_co_host_id
  FROM lunches
  WHERE id = p_lunch_id;
  
  IF v_host_id != auth.uid() AND (v_co_host_id IS NULL OR v_co_host_id != auth.uid()) THEN
    RAISE EXCEPTION 'Only the host or co-host can deny requests';
  END IF;
  
  DELETE FROM lunch_attendees
  WHERE id = p_attendee_id
  AND lunch_id = p_lunch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_attendee_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION deny_attendee_request(UUID, UUID) TO authenticated;
