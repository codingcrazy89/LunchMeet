-- Migration: Add looking_for column to profiles table
-- Run this SQL in your Supabase SQL Editor

-- Add the looking_for column as a text array
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT '{}';

-- Add a comment to document the column
COMMENT ON COLUMN profiles.looking_for IS 'Array of interests: Networking, Friendship, Dating';
