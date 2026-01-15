// Script to run SQL migration for adding looking_for column
// Usage: node scripts/run-migration.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL in .env file');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env file');
  console.error('   You can find this in your Supabase dashboard:');
  console.error('   Settings > API > service_role key (secret)');
  process.exit(1);
}

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🔄 Running migration: Add looking_for column to profiles table...');
  
  const sql = `
    ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT '{}';
    
    COMMENT ON COLUMN profiles.looking_for IS 'Array of interests: Networking, Friendship, Dating';
  `;

  try {
    // Use Supabase's REST API to execute SQL via rpc or direct query
    // Note: Supabase JS client doesn't support raw SQL, so we'll use the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      // If rpc doesn't exist, try alternative approach
      console.log('⚠️  Direct SQL execution not available via REST API');
      console.log('📝 Please run this SQL manually in your Supabase SQL Editor:');
      console.log('\n' + sql + '\n');
      console.log('Or add SUPABASE_SERVICE_ROLE_KEY to your .env file and we can try a different method.');
      return;
    }

    const result = await response.json();
    console.log('✅ Migration completed successfully!');
    console.log('Result:', result);
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.log('\n📝 Please run this SQL manually in your Supabase SQL Editor:');
    console.log('\n' + sql + '\n');
  }
}

runMigration();
