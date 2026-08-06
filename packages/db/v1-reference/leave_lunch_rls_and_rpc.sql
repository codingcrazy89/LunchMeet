-- Migration: Allow attendees to leave a lunch (persist delete + seats update)
-- Run this SQL in your Supabase SQL Editor

-- 1) RLS: Allow users to DELETE their own attendee record (for "Leave Lunch")
CREATE POLICY "Users can delete their own attendee record"
ON lunch_attendees
FOR DELETE
USING (auth.uid() = user_id);

-- 2) RPC: Leave lunch in one transaction (delete attendee row + increment seats)
-- Use this so seats update works even if lunches table RLS only allows host to update
CREATE OR REPLACE FUNCTION leave_lunch(p_lunch_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendee_id UUID;
  v_seats INT;
BEGIN
  -- Must be the attendee leaving (accepted or legacy null status)
  SELECT id INTO v_attendee_id
  FROM lunch_attendees
  WHERE lunch_id = p_lunch_id
    AND user_id = auth.uid()
    AND (status = 'accepted' OR status IS NULL)
  LIMIT 1;

  IF v_attendee_id IS NULL THEN
    RAISE EXCEPTION 'No accepted attendance record found for this lunch';
  END IF;

  DELETE FROM lunch_attendees WHERE id = v_attendee_id;

  SELECT seats INTO v_seats FROM lunches WHERE id = p_lunch_id;
  UPDATE lunches SET seats = COALESCE(v_seats, 0) + 1 WHERE id = p_lunch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION leave_lunch(UUID) TO authenticated;
