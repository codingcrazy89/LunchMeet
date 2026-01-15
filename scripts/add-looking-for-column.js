// Simple script to add looking_for column using Supabase Management API
// This requires the Supabase service role key

const https = require('https');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - EXPO_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n📝 To get your service role key:');
  console.error('   1. Go to your Supabase dashboard');
  console.error('   2. Settings > API');
  console.error('   3. Copy the "service_role" key (secret)');
  console.error('   4. Add it to your .env file as SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n📝 Or run this SQL manually in Supabase SQL Editor:');
  console.error('\n   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT \'{}\';\n');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Could not extract project ref from Supabase URL');
  process.exit(1);
}

const sql = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT '{}';`;

// Use Supabase Management API to execute SQL
const options = {
  hostname: `${projectRef}.supabase.co`,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseServiceKey,
    'Authorization': `Bearer ${supabaseServiceKey}`
  }
};

console.log('🔄 Attempting to add looking_for column...');

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.error(`❌ Migration failed with status ${res.statusCode}`);
      console.error('Response:', data);
      console.log('\n📝 Please run this SQL manually in your Supabase SQL Editor:');
      console.log('\n   ' + sql + '\n');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('\n📝 Please run this SQL manually in your Supabase SQL Editor:');
  console.log('\n   ' + sql + '\n');
});

req.write(JSON.stringify({ sql }));
req.end();
