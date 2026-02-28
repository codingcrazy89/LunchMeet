# Android build – same behavior as Expo Go

The Android build uses the **same** Host tab (restaurant search + map), same proxy, and same env as your current setup. No separate Android-only code paths.

## What carries over to the Android build

- **Host tab:** `host.native.tsx` is used on Android (same as iOS in Expo Go). Restaurant search, map, nearby places, and place details all work the same.
- **Places proxy:** The app calls `EXPO_PUBLIC_PLACES_PROXY_URL` for autocomplete, nearby, and details. That value is **baked in at build time** from `.env` or EAS secrets.
- **Tunnel bypass headers:** Requests to localtunnel (`.loca.lt`) and ngrok (`.ngrok-free.dev` / `.ngrok-free.app`) include the correct bypass headers so the app gets JSON, not the tunnel’s interstitial page.
- **Map:** Android uses the same Google Maps config; `GOOGLE_PLACES_API_KEY` (or `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`) in `app.config.js` is used for the map. Ensure **Maps SDK for Android** is enabled for your key in Google Cloud Console.
- **Supabase, auth, profile, chat, etc.:** Unchanged; same env and behavior.

## Before you start the Android build

1. **Set a stable proxy URL**  
   The built app will use whatever `EXPO_PUBLIC_PLACES_PROXY_URL` is at build time. If you use a **temporary** ngrok URL, it will stop working when the tunnel restarts. For a build you plan to ship or share:
   - Use a **stable** URL: deploy the places proxy to a server (e.g. Railway, Render, Fly.io) and set `EXPO_PUBLIC_PLACES_PROXY_URL` to that URL, or
   - Use **ngrok reserved domain** (paid) and set that URL in `.env`, or
   - For internal/testing only: put your current ngrok URL in `.env` and run the build; the app will work until that ngrok URL changes.

2. **Ensure `.env` has the proxy URL**  
   In project root, `.env` should contain:
   ```env
   EXPO_PUBLIC_PLACES_PROXY_URL=https://your-stable-proxy-url
   ```
   No trailing slash.

3. **EAS / cloud build**  
   If you use `eas build`, sync secrets so the cloud builder gets the same values:
   ```bash
   node scripts/setup-eas-secrets.js
   ```
   That script now includes `EXPO_PUBLIC_PLACES_PROXY_URL`. Your `.env` is read and pushed to EAS project secrets.

4. **Build**  
   From project root:
   ```bash
   eas build --profile preview --platform android
   ```
   or your chosen profile (`development`, `production`, etc.). The app will behave like Expo Go with the same proxy and map features.

## Summary

- **Yes:** All current features (search, map, nearby, tunnel/ngrok proxy, error handling) translate to the Android build.
- **Requirement:** Set `EXPO_PUBLIC_PLACES_PROXY_URL` (and optionally run `setup-eas-secrets.js`) before building so the built app has a working proxy URL. Use a stable URL for production; temporary ngrok is fine for testing.
