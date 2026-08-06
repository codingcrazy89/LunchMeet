-- Migration: Fix Row Level Security policies for lunch_attendees table
-- This allows hosts to accept/deny requests for their lunches
-- Run this SQL in your Supabase SQL Editor

-- First, check if RLS is enabled
ALTER TABLE lunch_attendees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Hosts can update attendee status for their lunches" ON lunch_attendees;
DROP POLICY IF EXISTS "Hosts can delete attendee requests for their lunches" ON lunch_attendees;
DROP POLICY IF EXISTS "Users can insert their own attendee requests" ON lunch_attendees;
DROP POLICY IF EXISTS "Users can view attendees for lunches" ON lunch_attendees;

-- Policy 1: Allow hosts to update attendee status for their lunches
-- Using both USING and WITH CHECK for UPDATE operations
CREATE POLICY "Hosts can update attendee status for their lunches"
ON lunch_attendees
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM lunches
    WHERE lunches.id = lunch_attendees.lunch_id
    AND lunches.host_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lunches
    WHERE lunches.id = lunch_attendees.lunch_id
    AND lunches.host_id = auth.uid()
  )
);

-- Policy 2: Allow hosts to delete attendee requests for their lunches
CREATE POLICY "Hosts can delete attendee requests for their lunches"
ON lunch_attendees
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM lunches
    WHERE lunches.id = lunch_attendees.lunch_id
    AND lunches.host_id = auth.uid()
  )
);

-- Policy 3: Allow users to insert their own attendee requests
CREATE POLICY "Users can insert their own attendee requests"
ON lunch_attendees
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Allow users to view attendees for lunches (everyone can see who's attending)
CREATE POLICY "Users can view attendees for lunches"
ON lunch_attendees
FOR SELECT
USING (true);

-- Policy 5: Allow users to view their own attendee records
CREATE POLICY "Users can view their own attendee records"
ON lunch_attendees
FOR SELECT
USING (auth.uid() = user_id);
