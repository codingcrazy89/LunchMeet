# Database Schema

This document describes the complete database schema for LunchMeet. The base tables (`profiles`, `lunches`, `lunch_attendees`) should be created first, then run the migrations in the `migrations/` directory.

## Base Tables

These tables are expected to exist before running migrations. If they don't exist, create them using the SQL below.

### profiles

User profile information linked to Supabase Auth users.

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  age INTEGER,
  bio TEXT,
  photo_url TEXT,
  looking_for TEXT[] DEFAULT '{}',  -- Added by migration: add_looking_for_column.sql
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view all profiles
CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
USING (true);

-- RLS Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);
```

### lunches

Lunch meetup events created by hosts.

```sql
CREATE TABLE IF NOT EXISTS lunches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant TEXT NOT NULL,
  restaurant_address TEXT,
  place_id TEXT,  -- Google Places API place_id
  date_time TIMESTAMP WITH TIME ZONE NOT NULL,
  seats INTEGER NOT NULL,  -- Total number of seats available
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lunches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can view lunches
CREATE POLICY "Everyone can view lunches"
ON lunches FOR SELECT
USING (true);

-- RLS Policy: Users can create lunches
CREATE POLICY "Users can create lunches"
ON lunches FOR INSERT
WITH CHECK (auth.uid() = host_id);

-- RLS Policy: Hosts can update their own lunches
CREATE POLICY "Hosts can update their own lunches"
ON lunches FOR UPDATE
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

-- RLS Policy: Hosts can delete their own lunches
CREATE POLICY "Hosts can delete their own lunches"
ON lunches FOR DELETE
USING (auth.uid() = host_id);
```

### lunch_attendees

Users who have requested to join or are attending lunches.

```sql
CREATE TABLE IF NOT EXISTS lunch_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lunch_id UUID NOT NULL REFERENCES lunches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lunch_id, user_id)  -- Prevent duplicate requests
);

-- Enable RLS
ALTER TABLE lunch_attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies are set up by migration: fix_lunch_attendees_rls_v2.sql
```

## Migration Files

Run these migrations in order after creating the base tables:

1. **`create_chat_system.sql`** - Creates `chat_rooms` and `messages` tables for group chat
2. **`add_looking_for_column.sql`** - Adds `looking_for` array column to `profiles` table
3. **`add_status_to_lunch_attendees.sql`** - Adds `status` column to `lunch_attendees` (if not already added)
4. **`fix_lunch_attendees_rls_v2.sql`** - Sets up RLS policies for `lunch_attendees` table
5. **`alternative_rls_fix.sql`** - Creates RPC functions for accepting/denying attendee requests
6. **`enable_realtime_messages.sql`** - Enables Supabase Realtime for messages table

## Complete Schema Overview

### Tables

- **profiles** - User profiles (linked to auth.users)
- **lunches** - Lunch meetup events
- **lunch_attendees** - Join table for users attending lunches
- **chat_rooms** - Chat rooms (one per lunch)
- **messages** - Chat messages

### Relationships

```
auth.users (1) ──→ (1) profiles
auth.users (1) ──→ (N) lunches (as host)
lunches (1) ──→ (N) lunch_attendees
auth.users (1) ──→ (N) lunch_attendees
lunches (1) ──→ (1) chat_rooms
chat_rooms (1) ──→ (N) messages
auth.users (1) ──→ (N) messages (as sender)
```

### Key Features

- **Row Level Security (RLS)** enabled on all tables
- **Real-time subscriptions** enabled for messages
- **Status workflow** for lunch attendees: `pending` → `accepted`/`denied`
- **Cascade deletes** to maintain referential integrity

## Setup Instructions

1. Create a new Supabase project
2. Run the base table creation SQL above (if tables don't exist)
3. Run migrations in order from `migrations/` directory
4. Verify RLS policies are active
5. Test authentication and data access

## Verification Queries

After setup, you can verify the schema:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
