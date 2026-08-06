-- Migration: Create user_reports table and notify admin
-- Run this SQL in your Supabase SQL Editor
-- After running, set your admin user ID: INSERT INTO app_config (key, value) VALUES ('admin_user_id', 'YOUR_USER_UUID_HERE');

-- App config for admin user ID (used for report notifications)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE policies: only service role can modify. Trigger reads via SECURITY DEFINER.

-- User reports table
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reports_reported_id ON user_reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at DESC);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own reports
CREATE POLICY "Users can insert their own reports"
ON user_reports FOR INSERT
WITH CHECK (reporter_id = auth.uid());

-- Users cannot read reports (admin will use service role)
CREATE POLICY "No public read on user_reports"
ON user_reports FOR SELECT
USING (false);

-- Add 'user_report' to notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('invite', 'join_request', 'cohost_added', 'new_message', 'request_accepted', 'rate_attendees', 'user_report'));

-- Function: Notify admin when a report is submitted
CREATE OR REPLACE FUNCTION notify_admin_on_user_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_reporter_name TEXT;
  v_reported_name TEXT;
BEGIN
  SELECT value::uuid INTO v_admin_id FROM app_config WHERE key = 'admin_user_id' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_reporter_name FROM profiles WHERE id = NEW.reporter_id;
  SELECT name INTO v_reported_name FROM profiles WHERE id = NEW.reported_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_admin_id,
    'user_report',
    'User Report',
    COALESCE(v_reporter_name, 'Someone') || ' reported ' || COALESCE(v_reported_name, 'a user') || '. Tap to view details.',
    jsonb_build_object('report_id', NEW.id, 'reporter_id', NEW.reporter_id, 'reported_id', NEW.reported_id, 'comment', NEW.comment)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_user_report ON user_reports;
CREATE TRIGGER trg_notify_admin_on_user_report
AFTER INSERT ON user_reports
FOR EACH ROW EXECUTE FUNCTION notify_admin_on_user_report();
