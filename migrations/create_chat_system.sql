-- Migration: Create chat system for lunch meets
-- Run this SQL in your Supabase SQL Editor

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_rooms table (one per lunch)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lunch_id UUID NOT NULL REFERENCES lunches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lunch_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_chat_room_id ON messages(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_lunch_id ON chat_rooms(lunch_id);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_rooms
-- Allow users to view chat rooms for lunches they're part of (host or attendee)
CREATE POLICY "Users can view chat rooms for their lunches"
ON chat_rooms
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM lunches
    WHERE lunches.id = chat_rooms.lunch_id
    AND (
      lunches.host_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM lunch_attendees
        WHERE lunch_attendees.lunch_id = lunches.id
        AND lunch_attendees.user_id = auth.uid()
        AND lunch_attendees.status = 'accepted'
      )
    )
  )
);

-- Allow system to create chat rooms (we'll use a function for this)
CREATE POLICY "Allow chat room creation"
ON chat_rooms
FOR INSERT
WITH CHECK (true);

-- RLS Policies for messages
-- Allow users to view messages in chat rooms they have access to
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
      OR EXISTS (
        SELECT 1 FROM lunch_attendees
        WHERE lunch_attendees.lunch_id = lunches.id
        AND lunch_attendees.user_id = auth.uid()
        AND lunch_attendees.status = 'accepted'
      )
    )
  )
);

-- Allow users to send messages in chat rooms they have access to
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
      OR EXISTS (
        SELECT 1 FROM lunch_attendees
        WHERE lunch_attendees.lunch_id = lunches.id
        AND lunch_attendees.user_id = auth.uid()
        AND lunch_attendees.status = 'accepted'
      )
    )
  )
);

-- Function to create or get chat room for a lunch
CREATE OR REPLACE FUNCTION get_or_create_chat_room(p_lunch_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id UUID;
BEGIN
  -- Try to get existing room
  SELECT id INTO v_room_id
  FROM chat_rooms
  WHERE lunch_id = p_lunch_id;
  
  -- If no room exists, create one
  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (lunch_id)
    VALUES (p_lunch_id)
    RETURNING id INTO v_room_id;
  END IF;
  
  RETURN v_room_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_or_create_chat_room(UUID) TO authenticated;
