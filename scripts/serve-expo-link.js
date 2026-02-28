#!/usr/bin/env node
/**
 * Serves expo-go-link.html so you can open it on your phone and tap "Open in Expo Go".
 * Run this in a separate terminal while "npm start" is running.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = parseInt(process.env.EXPO_LINK_PORT || "8766", 10);
const htmlPath = path.join(__dirname, "..", "expo-go-link.html");

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

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/expo-go-link.html") {
    fs.readFile(htmlPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error reading file");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIP();
  const url = "http://" + ip + ":" + PORT + "/";
  console.log("\n  Open this URL on your phone's browser (same Wi-Fi as this computer):\n");
  console.log("    " + url + "\n");
  console.log("  Then tap \"Open in Expo Go\". Keep this terminal open.\n");
});
