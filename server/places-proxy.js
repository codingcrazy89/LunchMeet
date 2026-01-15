require("dotenv").config();
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

    const url =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
      `?input=${encodeURIComponent(input)}` +
      `&types=restaurant` +
      `&location=38.9072,-77.0369` +
      `&radius=50000` +
      `&key=${apiKey}`;

    console.log("🌐 Calling Google Autocomplete:", url);

    const r = await fetch(url);
    const data = await r.json();

    console.log("✅ Google status:", data.status);
    if (data.error_message) {
      console.log("❌ Google error message:", data.error_message);
    }
    console.log("📦 Predictions count:", data.predictions?.length);

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

app.listen(8787, () => {
  console.log("🚀 Places proxy running on http://localhost:8787");
});