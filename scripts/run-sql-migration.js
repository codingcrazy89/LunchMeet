// Run SQL migration to add looking_for column
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_URL not found');
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

const sql = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT '{}';`;

async function runMigration() {
  console.log('🔄 Running migration...\n');
  console.log('SQL:', sql, '\n');

  try {
    // Try using RPC if a function exists, otherwise we'll need manual execution
    // Supabase doesn't allow direct SQL execution via JS client for security
    
    // Alternative: Try to insert a test value to see if column exists
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('looking_for')
      .limit(1);
    
    if (testError && testError.message.includes('column') && testError.message.includes('looking_for')) {
      console.log('✅ Column does not exist - migration needed');
      console.log('❌ Cannot execute ALTER TABLE via Supabase JS client');
      console.log('\n📝 Please run this SQL in Supabase SQL Editor:\n');
      console.log('   ' + sql + '\n');
      console.log('Steps:');
      console.log('   1. Go to https://supabase.com/dashboard');
      console.log('   2. Select your project');
      console.log('   3. Click "SQL Editor" in left sidebar');
      console.log('   4. Paste the SQL above');
      console.log('   5. Click "Run"\n');
    } else if (!testError) {
      console.log('✅ Column already exists! No migration needed.');
    } else {
      console.log('⚠️  Could not verify column status');
      console.log('📝 Please run this SQL manually:\n');
      console.log('   ' + sql + '\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:\n');
    console.log('   ' + sql + '\n');
  }
}

runMigration();
