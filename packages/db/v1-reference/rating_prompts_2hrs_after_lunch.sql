-- Migration: Send rating prompts 2 hours after lunch ends
-- 1. Add rating_prompt_sent_at to lunches
-- 2. Add 'rate_attendees' notification type
-- 3. Create function to send prompts (called by pg_cron)
-- 4. Schedule cron job (every 15 min)

-- Add column to track when rating prompt was sent
ALTER TABLE lunches
  ADD COLUMN IF NOT EXISTS rating_prompt_sent_at TIMESTAMP WITH TIME ZONE;

-- Add 'rate_attendees' to notification type (drop and recreate constraint)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('invite', 'join_request', 'cohost_added', 'new_message', 'request_accepted', 'rate_attendees'));

-- Function: Send rating prompts for lunches that ended 2+ hours ago
CREATE OR REPLACE FUNCTION send_rating_prompts_for_past_lunches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_attendee RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Find lunches where: date_time + 2 hours <= NOW(), prompt not yet sent, lunch is in the past
  FOR r IN
    SELECT l.id, l.restaurant, l.date_time, l.host_id, l.co_host_id
    FROM lunches l
    WHERE l.rating_prompt_sent_at IS NULL
      AND l.date_time + INTERVAL '2 hours' <= NOW()
      AND l.date_time < NOW()
  LOOP
    -- Get all accepted attendees: host, co-host, and accepted lunch_attendees
    FOR v_attendee IN
      SELECT DISTINCT uid AS user_id FROM (
        SELECT host_id AS uid FROM lunches WHERE id = r.id AND host_id IS NOT NULL
        UNION
        SELECT co_host_id FROM lunches WHERE id = r.id AND co_host_id IS NOT NULL
        UNION
        SELECT user_id FROM lunch_attendees
        WHERE lunch_id = r.id AND (status = 'accepted' OR status IS NULL) AND user_id IS NOT NULL
      ) AS attendees(uid)
      WHERE uid IS NOT NULL
    LOOP
      -- Send notification to this attendee: "Rate the people you met at [restaurant]"
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_attendee.user_id,
        'rate_attendees',
        'Rate your lunch meet',
        'How was your experience at ' || COALESCE(r.restaurant, 'the lunch') || '? Rate each attendee 1-5 stars.',
        jsonb_build_object('lunch_id', r.id)
      );
      v_count := v_count + 1;
    END LOOP;

    -- Mark this lunch as prompt sent
    UPDATE lunches SET rating_prompt_sent_at = NOW() WHERE id = r.id;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Enable pg_cron extension (Supabase has it; may already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule if exists (for re-running migration)
DO $$
BEGIN
  PERFORM cron.unschedule('send_rating_prompts');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job may not exist
END $$;

-- Schedule job to run every 15 minutes
SELECT cron.schedule(
  'send_rating_prompts',
  '*/15 * * * *',
  $$SELECT send_rating_prompts_for_past_lunches()$$
);
