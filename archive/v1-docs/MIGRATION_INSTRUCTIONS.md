# Migration: Add looking_for Column

## Option 1: Run via Script (Recommended)

1. Get your Supabase service role key:
   - Go to https://supabase.com/dashboard
   - Select your project
   - Go to **Settings > API**
   - Copy the **service_role** key (it's the secret key, not the anon key)

2. Add it to your `.env` file:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. Run the migration script:
   ```bash
   node scripts/execute-migration.js
   ```

## Option 2: Run Manually in Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Paste this SQL:
   ```sql
   ALTER TABLE profiles 
   ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT '{}';
   ```
5. Click **Run** (or press Ctrl+Enter)

## Verify the Migration

After running the migration, you can verify it worked by:
- Going to **Table Editor** in Supabase
- Selecting the `profiles` table
- Checking that `looking_for` column appears in the columns list

The column should be of type `text[]` (array of text).
