#!/usr/bin/env node
/**
 * Reads .env and pushes required variables to EAS Environment Variables
 * so Android/iOS builds have the same config as Expo Go.
 * Run from project root: node scripts/setup-eas-secrets.js
 *
 * Uses: eas env:create (EAS env vars). Set for "preview" and "production" environments.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { execSync } = require("child_process");

const vars = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "GOOGLE_PLACES_API_KEY",
  "EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY",
  "EXPO_PUBLIC_PLACES_PROXY_URL",
];

const environments = ["preview", "production"];
const visibility = "plaintext";

function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit", cwd: require("path").resolve(__dirname, "..") });
    return true;
  } catch (e) {
    return false;
  }
}

console.log("Setting EAS environment variables from your .env (preview + production)...\n");

let set = 0;
for (const name of vars) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.log(`  Skip ${name} (not set in .env)`);
    continue;
  }
  for (const env of environments) {
    console.log(`  Setting ${name} [${env}]...`);
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const ok = run(
      `npx eas env:create --name ${name} --value "${escaped}" --environment ${env} --visibility ${visibility} --non-interactive --force`
    );
    if (ok) {
      set++;
      console.log(`  Done ${name} [${env}]\n`);
    } else {
      console.log(`  Failed ${name} [${env}] (may already exist or EAS not logged in)\n`);
    }
  }
}

console.log(`\nDone. Run: eas build --profile preview --platform android`);
console.log("Ensure your eas.json build profiles use the right environment (e.g. preview/profile has env).");
process.exit(set > 0 ? 0 : 1);
