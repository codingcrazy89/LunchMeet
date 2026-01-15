# Quick Migration Guide

## The SQL You Need:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT '{}';
```

## Fastest Way to Run It:

### Option A: Supabase Dashboard (2 minutes)
1. Open https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Paste the SQL above
5. Click **Run** ✅

### Option B: Automatic Script (if you have service role key)
1. Get service role key: Dashboard → Settings → API → service_role key
2. Add to `.env`: `SUPABASE_SERVICE_ROLE_KEY=your_key`
3. Run: `node scripts/execute-migration.js`

The dashboard method is fastest if you just want to get it done now!
