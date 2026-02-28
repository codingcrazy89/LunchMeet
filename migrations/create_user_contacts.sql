-- Migration: Create user_contacts table for personal contact list
-- Run this SQL in your Supabase SQL Editor
-- Users can add other users as contacts (for private lunch invites, etc.)

CREATE TABLE IF NOT EXISTS user_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, contact_id),
  CHECK (user_id != contact_id)
);

CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_contact_id ON user_contacts(contact_id);

ALTER TABLE user_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
ON user_contacts FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can add contacts"
ON user_contacts FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their contacts"
ON user_contacts FOR DELETE
USING (user_id = auth.uid());
