-- Migration: Create notifications table and triggers for in-app notifications
-- Run this SQL in your Supabase SQL Editor
-- Users receive notifications for: direct invites, join requests, co-host added, new chat messages, request accepted

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('invite', 'join_request', 'cohost_added', 'new_message', 'request_accepted')),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications (mark read)"
ON notifications FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Trigger: Direct lunch invite
CREATE OR REPLACE FUNCTION notify_lunch_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant TEXT;
  v_inviter_name TEXT;
BEGIN
  SELECT restaurant INTO v_restaurant FROM lunches WHERE id = NEW.lunch_id;
  SELECT name INTO v_inviter_name FROM profiles WHERE id = NEW.inviter_id;
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.invitee_id,
    'invite',
    'Lunch invite',
    COALESCE(v_inviter_name, 'Someone') || ' invited you to ' || COALESCE(v_restaurant, 'a lunch'),
    jsonb_build_object('lunch_id', NEW.lunch_id, 'invite_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lunch_invite ON lunch_invites;
CREATE TRIGGER trg_notify_lunch_invite
AFTER INSERT ON lunch_invites
FOR EACH ROW EXECUTE FUNCTION notify_lunch_invite();

-- Trigger: New join request (notify host and co-host)
CREATE OR REPLACE FUNCTION notify_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant TEXT;
  v_requester_name TEXT;
  v_host_id UUID;
  v_co_host_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;
  SELECT restaurant, host_id, co_host_id INTO v_restaurant, v_host_id, v_co_host_id
  FROM lunches WHERE id = NEW.lunch_id;
  SELECT name INTO v_requester_name FROM profiles WHERE id = NEW.user_id;
  IF v_host_id IS NOT NULL AND v_host_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_host_id,
      'join_request',
      'New lunch request',
      COALESCE(v_requester_name, 'Someone') || ' wants to join ' || COALESCE(v_restaurant, 'your lunch'),
      jsonb_build_object('lunch_id', NEW.lunch_id, 'attendee_id', NEW.id)
    );
  END IF;
  IF v_co_host_id IS NOT NULL AND v_co_host_id != NEW.user_id AND v_co_host_id != v_host_id THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_co_host_id,
      'join_request',
      'New lunch request',
      COALESCE(v_requester_name, 'Someone') || ' wants to join ' || COALESCE(v_restaurant, 'your lunch'),
      jsonb_build_object('lunch_id', NEW.lunch_id, 'attendee_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_join_request ON lunch_attendees;
CREATE TRIGGER trg_notify_join_request
AFTER INSERT ON lunch_attendees
FOR EACH ROW EXECUTE FUNCTION notify_join_request();

-- Trigger: Request accepted (notify the requester)
CREATE OR REPLACE FUNCTION notify_request_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant TEXT;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') AND NEW.user_id IS NOT NULL THEN
    SELECT restaurant INTO v_restaurant FROM lunches WHERE id = NEW.lunch_id;
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'request_accepted',
      'Request accepted',
      'You were accepted to ' || COALESCE(v_restaurant, 'a lunch'),
      jsonb_build_object('lunch_id', NEW.lunch_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_request_accepted ON lunch_attendees;
CREATE TRIGGER trg_notify_request_accepted
AFTER UPDATE ON lunch_attendees
FOR EACH ROW EXECUTE FUNCTION notify_request_accepted();

-- Trigger: Co-host added (notify new co-host)
CREATE OR REPLACE FUNCTION notify_cohost_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant TEXT;
  v_host_name TEXT;
BEGIN
  IF NEW.co_host_id IS NOT NULL AND (OLD.co_host_id IS NULL OR OLD.co_host_id != NEW.co_host_id) THEN
    SELECT restaurant INTO v_restaurant FROM lunches WHERE id = NEW.id;
    SELECT name INTO v_host_name FROM profiles WHERE id = NEW.host_id;
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.co_host_id,
      'cohost_added',
      'You were added as co-host',
      COALESCE(v_host_name, 'The host') || ' added you as co-host for ' || COALESCE(v_restaurant, 'a lunch'),
      jsonb_build_object('lunch_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cohost_added ON lunches;
CREATE TRIGGER trg_notify_cohost_added
AFTER UPDATE ON lunches
FOR EACH ROW EXECUTE FUNCTION notify_cohost_added();

-- Trigger: New chat message (notify participants except sender)
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lunch_id UUID;
  v_host_id UUID;
  v_co_host_id UUID;
  v_sender_name TEXT;
  v_restaurant TEXT;
  r RECORD;
BEGIN
  SELECT lunch_id INTO v_lunch_id FROM chat_rooms WHERE id = NEW.chat_room_id;
  SELECT host_id, co_host_id, restaurant INTO v_host_id, v_co_host_id, v_restaurant FROM lunches WHERE id = v_lunch_id;
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  IF v_host_id IS NOT NULL AND v_host_id != NEW.sender_id THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_host_id,
      'new_message',
      'New chat message',
      COALESCE(v_sender_name, 'Someone') || ': ' || left(NEW.message, 50) || CASE WHEN length(NEW.message) > 50 THEN '...' ELSE '' END,
      jsonb_build_object('chat_room_id', NEW.chat_room_id, 'lunch_id', v_lunch_id)
    );
  END IF;
  IF v_co_host_id IS NOT NULL AND v_co_host_id != NEW.sender_id AND v_co_host_id != v_host_id THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_co_host_id,
      'new_message',
      'New chat message',
      COALESCE(v_sender_name, 'Someone') || ': ' || left(NEW.message, 50) || CASE WHEN length(NEW.message) > 50 THEN '...' ELSE '' END,
      jsonb_build_object('chat_room_id', NEW.chat_room_id, 'lunch_id', v_lunch_id)
    );
  END IF;
  FOR r IN
    SELECT user_id FROM lunch_attendees
    WHERE lunch_id = v_lunch_id AND status = 'accepted' AND user_id IS NOT NULL
    AND user_id != NEW.sender_id
    AND (v_host_id IS NULL OR user_id != v_host_id)
    AND (v_co_host_id IS NULL OR user_id != v_co_host_id)
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      r.user_id,
      'new_message',
      'New chat message',
      COALESCE(v_sender_name, 'Someone') || ': ' || left(NEW.message, 50) || CASE WHEN length(NEW.message) > 50 THEN '...' ELSE '' END,
      jsonb_build_object('chat_room_id', NEW.chat_room_id, 'lunch_id', v_lunch_id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON messages;
CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_new_message();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
