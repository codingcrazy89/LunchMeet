#!/usr/bin/env node
/**
 * Prints the Expo Go URL for this machine (LAN).
 * Run this while "npm start" or "expo start" is running.
 * Default Metro port is 8081.
 */
const os = require("os");

const PORT = process.env.RCT_METRO_PORT || process.env.EXPO_DEVTOOLS_LISTEN_ADDRESS?.split(":")[1] || "8081";

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const ip = getLocalIP();
const url = `exp://${ip}:${PORT}`;
console.log("\n  Expo Go link (use when Metro is running):");
console.log("  " + url);
console.log("\n  In Expo Go: tap \"Enter URL manually\" and paste the link above.");
console.log("  Ensure your phone is on the same Wi-Fi as this computer.\n");
