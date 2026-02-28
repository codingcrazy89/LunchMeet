-- Migration: Add visibility filtering to lunches table
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE lunches
ADD COLUMN IF NOT EXISTS visibility_gender TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS visibility_looking_for TEXT[] DEFAULT NULL;

COMMENT ON COLUMN lunches.visibility_gender IS 'If set, only users with matching gender see this lunch. Null = everyone.';
COMMENT ON COLUMN lunches.visibility_looking_for IS 'If set, only users with overlapping looking_for see this lunch. Null = everyone.';
