#!/usr/bin/env node
/**
 * Helper for start-remote.ps1: Start localtunnel, capture URL, update .env
 * Spawns localtunnel as detached process so it keeps running after we exit.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const envPath = path.join(projectRoot, ".env");

const isWin = process.platform === "win32";
const lt = spawn("npx", ["localtunnel", "--port", "8787"], {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  cwd: projectRoot,
  shell: isWin,
});

let output = "";
function checkOutput() {
  const match = output.match(/https:\/\/[^\s]+\.loca\.lt/);
  if (match) {
    const url = match[0].trim();
    try {
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
      if (envContent.match(/EXPO_PUBLIC_PLACES_PROXY_URL=/m)) {
        envContent = envContent.replace(/EXPO_PUBLIC_PLACES_PROXY_URL=.*/m, `EXPO_PUBLIC_PLACES_PROXY_URL=${url}`);
      } else {
        envContent += `\nEXPO_PUBLIC_PLACES_PROXY_URL=${url}`;
      }
      fs.writeFileSync(envPath, envContent);
      console.log(url);
    } catch (e) {
      console.error("Could not update .env:", e.message);
    }
    lt.unref();
    process.exit(0);
  }
}
function onData(chunk) {
  output += chunk.toString();
  checkOutput();
}
lt.stdout.on("data", onData);
lt.stderr.on("data", onData);

lt.unref();

setTimeout(() => {
  console.error("Timeout waiting for localtunnel URL");
  process.exit(1);
}, 15000);
