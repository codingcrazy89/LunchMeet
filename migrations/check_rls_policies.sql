-- Check current RLS policies on lunch_attendees table
-- Run this to see what policies currently exist

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'lunch_attendees'
ORDER BY policyname;

-- Also check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'lunch_attendees';
