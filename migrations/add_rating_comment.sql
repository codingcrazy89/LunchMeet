-- Migration: Add comment column to user_ratings (required when rating < 3)
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE user_ratings
  ADD COLUMN IF NOT EXISTS comment TEXT;
