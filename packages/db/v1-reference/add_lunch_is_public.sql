-- Migration: Add is_public column to lunches table
-- Run this SQL in your Supabase SQL Editor
-- Public lunches appear in the main list (with optional visibility filters). Private lunches are invite-only.

ALTER TABLE lunches
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

COMMENT ON COLUMN lunches.is_public IS 'If true, lunch appears in main list (with optional visibility filters). If false, only invited users can see it.';
