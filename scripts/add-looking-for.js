// Script to add looking_for column to profiles table
// This will use Supabase CLI if available, otherwise provide instructions

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Adding looking_for column to profiles table...\n');

// Check if Supabase CLI is installed
try {
  execSync('supabase --version', { stdio: 'ignore' });
  console.log('✅ Supabase CLI detected\n');
  
  // Try to run the migration using Supabase CLI
  const sql = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT '{}';`;
  
  console.log('📝 Attempting to run migration via Supabase CLI...');
  console.log('   If this fails, you may need to link your project first:');
  console.log('   supabase link --project-ref YOUR_PROJECT_REF\n');
  
  // Write SQL to temp file
  const tempFile = path.join(__dirname, 'temp_migration.sql');
  fs.writeFileSync(tempFile, sql);
  
  try {
    // Try to execute via Supabase CLI
    execSync(`supabase db execute -f "${tempFile}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('\n✅ Migration completed successfully!');
    fs.unlinkSync(tempFile);
  } catch (error) {
    console.log('\n⚠️  Could not execute via CLI. Please run manually:\n');
    console.log(sql);
    console.log('\nOr use the Supabase dashboard SQL Editor.');
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
} catch (error) {
  // Supabase CLI not installed
  console.log('⚠️  Supabase CLI not found.\n');
  console.log('📝 Please run this SQL in your Supabase SQL Editor:\n');
  console.log('   ALTER TABLE profiles');
  console.log('   ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT \'{}\';\n');
  console.log('Steps:');
  console.log('   1. Go to https://supabase.com/dashboard');
  console.log('   2. Select your project');
  console.log('   3. Go to SQL Editor');
  console.log('   4. Paste the SQL above');
  console.log('   5. Click Run\n');
  console.log('Or install Supabase CLI:');
  console.log('   npm install -g supabase\n');
}
