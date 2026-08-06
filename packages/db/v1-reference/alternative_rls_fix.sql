-- Alternative approach: Create a database function to update attendee status
-- This bypasses RLS by using SECURITY DEFINER
-- Run this if the RLS policies still don't work

-- Create a function that allows hosts to update attendee status
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
BEGIN
  -- Verify the current user is the host
  SELECT host_id INTO v_host_id
  FROM lunches
  WHERE id = p_lunch_id;
  
  IF v_host_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can accept requests';
  END IF;
  
  -- Update the attendee status
  UPDATE lunch_attendees
  SET status = 'accepted'
  WHERE id = p_attendee_id
  AND lunch_id = p_lunch_id;
  
  -- Decrement seats
  UPDATE lunches
  SET seats = GREATEST(0, seats - 1)
  WHERE id = p_lunch_id;
END;
$$;

-- Create a function to deny/delete attendee requests
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
BEGIN
  -- Verify the current user is the host
  SELECT host_id INTO v_host_id
  FROM lunches
  WHERE id = p_lunch_id;
  
  IF v_host_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can deny requests';
  END IF;
  
  -- Delete the attendee request
  DELETE FROM lunch_attendees
  WHERE id = p_attendee_id
  AND lunch_id = p_lunch_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_attendee_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION deny_attendee_request(UUID, UUID) TO authenticated;
