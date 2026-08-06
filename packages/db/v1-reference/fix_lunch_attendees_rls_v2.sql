-- Migration: Fix Row Level Security policies for lunch_attendees table (Version 2)
-- This allows hosts to accept/deny requests for their lunches
-- Run this SQL in your Supabase SQL Editor

-- First, enable RLS if not already enabled
ALTER TABLE lunch_attendees ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh (to avoid conflicts)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lunch_attendees') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON lunch_attendees';
    END LOOP;
END $$;

-- Policy 1: Allow hosts to UPDATE attendee status for their lunches
-- Both USING and WITH CHECK are required for UPDATE
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

-- Policy 2: Allow hosts to DELETE attendee requests for their lunches
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

-- Policy 3: Allow users to INSERT their own attendee requests
CREATE POLICY "Users can insert their own attendee requests"
ON lunch_attendees
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Allow everyone to SELECT attendees (for viewing lunches)
CREATE POLICY "Everyone can view attendees"
ON lunch_attendees
FOR SELECT
USING (true);

-- Verify policies were created
SELECT 
  policyname,
  cmd as operation,
  CASE WHEN qual IS NOT NULL THEN 'Has USING clause' ELSE 'No USING' END as using_clause,
  CASE WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause' ELSE 'No WITH CHECK' END as with_check_clause
FROM pg_policies
WHERE tablename = 'lunch_attendees'
ORDER BY policyname;
