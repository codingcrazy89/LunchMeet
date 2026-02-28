try { require("dotenv").config(); } catch {}
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/places/autocomplete", async (req, res) => {
  console.log("➡️ Incoming request:", req.query);

  try {
    const input = req.query.input || "";
    if (input.length < 2) {
      return res.json({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GOOGLE_PLACES_API_KEY" });
    }

    // Restrict to restaurants only (Table 1 type - supported in Autocomplete)
    const url =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
      `?input=${encodeURIComponent(input)}` +
      `&types=restaurant` +
      `&key=${apiKey}`;

    console.log("🌐 Calling Google Autocomplete:", url);

    const r = await fetch(url);
    const data = await r.json();

    console.log("✅ Google status:", data.status);
    if (data.error_message) {
      console.log("❌ Google error message:", data.error_message);
    }
    console.log("📦 Predictions count:", data.predictions?.length ?? 0);

    // If Google returned an error, put message in .error so the client can show it
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      const msg = data.error_message || data.status;
      res.json({ ...data, error: typeof msg === "string" ? msg : data.status, predictions: data.predictions || [] });
    } else {
      res.json(data);
    }
  } catch (e) {
    console.error("🔥 Proxy error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/places/nearby", async (req, res) => {
  console.log("➡️ Nearby places request:", req.query);

  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = Math.min(parseInt(req.query.radius, 10) || 2000, 50000);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "Missing or invalid lat/lng" });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GOOGLE_PLACES_API_KEY" });
    }

    // Restrict to restaurants only (Nearby Search supports type=restaurant; Autocomplete does not).
    const url =
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json" +
      `?location=${lat},${lng}` +
      `&radius=${radius}` +
      `&type=restaurant` +
      `&key=${apiKey}`;

    console.log("🌐 Calling Google Nearby Search:", url);

    const r = await fetch(url);
    const data = await r.json();

    console.log("✅ Google status:", data.status, "results:", data.results?.length);

    if (data.error_message) {
      console.log("❌ Google error message:", data.error_message);
    }

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      const msg = data.error_message || data.status;
      console.log("❌ Returning error to client:", msg);
      return res.status(502).json({ error: msg, status: data.status });
    }

    res.json(data);
  } catch (e) {
    console.error("🔥 Proxy error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/places/details", async (req, res) => {
  console.log("➡️ Place details request:", req.query);

  try {
    const placeId = req.query.place_id;
    if (!placeId) {
      return res.status(400).json({ error: "Missing place_id" });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GOOGLE_PLACES_API_KEY" });
    }

    const url =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=place_id,name,formatted_address,geometry` +
      `&key=${apiKey}`;

    console.log("🌐 Calling Google Details:", url);

    const r = await fetch(url);
    const data = await r.json();

    console.log("✅ Google status:", data.status);
    if (data.error_message) {
      console.log("❌ Google error message:", data.error_message);
    }

    res.json(data);
  } catch (e) {
    console.error("🔥 Proxy error:", e);
    res.status(500).json({ error: String(e) });
  }
});

// 404 – wrong path (e.g. old proxy without /places/nearby – restart with: npm run proxy)
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    routes: ["/places/autocomplete", "/places/nearby", "/places/details"],
    hint: "Restart the proxy: npm run proxy",
  });
});

// Listen on all interfaces (0.0.0.0) so mobile devices can connect
// For localhost-only, use '127.0.0.1' instead
const HOST = process.env.PROXY_HOST || "0.0.0.0";
const PORT = process.env.PORT || process.env.PROXY_PORT || 8787;

app.listen(PORT, HOST, () => {
  console.log(`🚀 Places proxy running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`📱 For mobile devices, use your computer's IP address: http://<YOUR_IP>:${PORT}`);
});