// Execute SQL migration using Supabase REST API
// Requires SUPABASE_SERVICE_ROLE_KEY in .env

require('dotenv').config();
const https = require('https');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_URL not found in .env');
  process.exit(1);
}

if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
  console.error('\nTo get your service role key:');
  console.error('1. Go to https://supabase.com/dashboard');
  console.error('2. Select your project');
  console.error('3. Go to Settings > API');
  console.error('4. Copy the "service_role" key (secret)');
  console.error('5. Add to .env: SUPABASE_SERVICE_ROLE_KEY=your_key_here\n');
  process.exit(1);
}

// Extract project ref
const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
  console.error('❌ Invalid Supabase URL format');
  process.exit(1);
}

const projectRef = urlMatch[1];
const sql = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT '{}';`;

console.log('🔄 Executing migration...\n');
console.log('SQL:', sql);
console.log('');

// First, create a function to execute SQL (if it doesn't exist)
const createFunctionSQL = `
CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;
`;

// Try to execute via REST API using the function
const executeSQL = async () => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ sql_text: sql });
    
    const options = {
      hostname: `${projectRef}.supabase.co`,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data });
        } else {
          reject({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

// Try executing
executeSQL()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    console.log('   The looking_for column has been added to the profiles table.');
  })
  .catch((error) => {
    console.error('❌ Could not execute via API:', error.status || error.message);
    console.error('\n📝 Please run this SQL manually in Supabase SQL Editor:\n');
    console.error('   ' + sql + '\n');
    console.error('Steps:');
    console.error('   1. Go to https://supabase.com/dashboard');
    console.error('   2. Select your project');
    console.error('   3. Go to SQL Editor (left sidebar)');
    console.error('   4. Paste the SQL above');
    console.error('   5. Click Run\n');
  });
