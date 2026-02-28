#!/usr/bin/env node
/**
 * Fetches the Expo tunnel URL from ngrok and displays it with a QR code.
 * Run while Expo is running with --tunnel.
 */
const http = require("http");
const qrcode = require("qrcode");

http.get("http://127.0.0.1:4040/api/tunnels", (res) => {
  let data = "";
  res.on("data", (c) => (data += c));
  res.on("end", () => {
    try {
      const j = JSON.parse(data);
      const t = j.tunnels?.find((x) => x.public_url?.includes("exp.direct") || x.public_url?.includes("8081"));
      const pub = t?.public_url || j.tunnels?.[0]?.public_url;
      if (pub) {
        const expUrl = pub.replace(/^https?:\/\//, "exp://");
        console.log("\n  Expo tunnel URL:\n");
        console.log("  " + expUrl + "\n");
        qrcode.toString(expUrl, { type: "terminal", small: true }, (err, str) => {
          if (!err) console.log(str);
          console.log("  Share this URL or scan the QR code with your phone.\n");
        });
      } else {
        console.log("No tunnel found. Is Expo running with --tunnel?");
      }
    } catch (e) {
      console.log("Could not parse ngrok response:", e.message);
    }
  });
}).on("error", (e) => {
  console.log("Ngrok API not available (port 4040). Is Expo running with --tunnel?");
  console.log("Error:", e.message);
});
