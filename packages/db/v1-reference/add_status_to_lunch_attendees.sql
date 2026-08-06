-- Migration: Add status column to lunch_attendees table
-- Run this SQL in your Supabase SQL Editor

-- Add the status column with default value 'accepted' for backward compatibility
ALTER TABLE lunch_attendees 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'denied'));

-- Update existing records to have 'accepted' status if they don't have one
UPDATE lunch_attendees 
SET status = 'accepted' 
WHERE status IS NULL;

-- Make status NOT NULL after setting defaults
ALTER TABLE lunch_attendees 
ALTER COLUMN status SET DEFAULT 'pending';
