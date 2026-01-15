-- Enable real-time for messages table
-- Run this in your Supabase SQL Editor

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- If the above doesn't work, try:
-- CREATE PUBLICATION supabase_realtime FOR TABLE messages;

-- Verify realtime is enabled
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'messages';
