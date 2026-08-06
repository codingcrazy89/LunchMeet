-- Migration: Add co-host support to lunches table
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE lunches
ADD COLUMN IF NOT EXISTS co_host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN lunches.co_host_id IS 'Optional co-host who has same powers as host for this lunch';

-- RPC to find user by email (for co-host selection)
-- Returns id and name if a user with that email exists
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, COALESCE(p.name, split_part(au.email, '@', 1))
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE lower(trim(au.email)) = lower(trim(p_email))
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION get_user_by_email(TEXT) TO authenticated;
