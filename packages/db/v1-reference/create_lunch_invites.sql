-- Migration: Create lunch_invites table for direct private invites
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS lunch_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lunch_id UUID NOT NULL REFERENCES lunches(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lunch_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_lunch_invites_invitee ON lunch_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_lunch_invites_lunch ON lunch_invites(lunch_id);

ALTER TABLE lunch_invites ENABLE ROW LEVEL SECURITY;

-- Inviters (host/co-host) can insert invites for their lunches
CREATE POLICY "Hosts and co-hosts can create invites"
ON lunch_invites FOR INSERT
WITH CHECK (
  inviter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM lunches
    WHERE lunches.id = lunch_id
    AND (lunches.host_id = auth.uid() OR lunches.co_host_id = auth.uid())
  )
);

-- Invitees can update their own invites (accept/decline)
CREATE POLICY "Invitees can update their invites"
ON lunch_invites FOR UPDATE
USING (invitee_id = auth.uid())
WITH CHECK (invitee_id = auth.uid());

-- Users can read invites they sent or received
CREATE POLICY "Users can read their invites"
ON lunch_invites FOR SELECT
USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- RPC to search users by email (partial match, for invite flow)
CREATE OR REPLACE FUNCTION search_users_by_email(p_search TEXT)
RETURNS TABLE(id UUID, name TEXT, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(trim(p_search)) < 2 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT au.id, COALESCE(p.name, split_part(au.email, '@', 1)), au.email
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE lower(au.email) LIKE '%' || lower(trim(p_search)) || '%'
  LIMIT 10;
END;
$$;
GRANT EXECUTE ON FUNCTION search_users_by_email(TEXT) TO authenticated;
