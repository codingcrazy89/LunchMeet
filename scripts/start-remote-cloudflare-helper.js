#!/usr/bin/env node
/**
 * Helper for start-remote-cloudflare.ps1: Start cloudflared tunnel using the library API.
 * Gets URL reliably via the "url" event, updates .env, keeps tunnel running.
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const urlFile = path.join(projectRoot, ".cloudflare-tunnel-url");

async function main() {
  const { Tunnel } = require("cloudflared");

  const tunnel = Tunnel.quick("http://localhost:8787");

  const url = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Timeout waiting for tunnel URL")), 25000);
    tunnel.once("url", (u) => {
      clearTimeout(t);
      resolve(u);
    });
    tunnel.once("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  try {
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    if (envContent.match(/EXPO_PUBLIC_PLACES_PROXY_URL=/m)) {
      envContent = envContent.replace(/EXPO_PUBLIC_PLACES_PROXY_URL=.*/m, `EXPO_PUBLIC_PLACES_PROXY_URL=${url}`);
    } else {
      envContent += `\nEXPO_PUBLIC_PLACES_PROXY_URL=${url}`;
    }
    fs.writeFileSync(envPath, envContent);
    fs.writeFileSync(urlFile, url);
    console.log(url);
  } catch (e) {
    console.error("Could not update .env:", e.message);
    process.exit(1);
  }

  // Keep process alive so tunnel stays running
  tunnel.on("exit", () => process.exit(0));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
