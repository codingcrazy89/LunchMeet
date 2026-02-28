#!/usr/bin/env node
/**
 * Generates a QR code image for the Expo Go URL.
 * Open the image on your computer, then scan it with your phone's camera.
 * The phone should offer to open the link in Expo Go.
 */
const os = require("os");
const path = require("path");
const fs = require("fs");

const PORT = process.env.RCT_METRO_PORT || "8081";

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
const outPath = path.join(__dirname, "..", "expo-go-qr.png");

require("qrcode").toFile(outPath, url, { width: 400, margin: 2 }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("\n  QR code saved to: expo-go-qr.png");
  console.log("  URL:", url);
  console.log("\n  1. Run 'npm start' in another terminal (if not already running).");
  console.log("  2. Open expo-go-qr.png on this computer (double-click or drag into browser).");
  console.log("  3. Scan the QR code with your phone's camera (not Expo Go).");
  console.log("  4. Tap the notification to open in Expo Go.\n");
});
