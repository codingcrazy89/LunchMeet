-- Migration: Add social_media_url column to profiles table
-- Run this SQL in your Supabase SQL Editor
-- Allows users to add a link to their social media profile (Instagram, LinkedIn, Twitter, etc.)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_media_url TEXT;
COMMENT ON COLUMN profiles.social_media_url IS 'Optional URL to user social media profile (Instagram, LinkedIn, Twitter, etc.)';
