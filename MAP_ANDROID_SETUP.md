# Map View on Android

## Why the map might not load

1. **Missing Google Maps API key (Android)**  
   On Android, `react-native-maps` needs a Google Maps API key in the native app. Without it, the map can stay blank or show an error.

2. **No coordinates for lunches**  
   The map shows lunch locations from stored `latitude`/`longitude`. If no lunches have coordinates (e.g. migration not run, or lunches created before coordinates were added), the map still opens but shows a message: *"No locations for lunches yet..."*.

---

## Fix 1: Google Maps API key (requires rebuild)

1. **Google Cloud Console**
   - Open [Google Cloud Console](https://console.cloud.google.com/) and select your project.
   - Enable **Maps SDK for Android** (APIs & Services → Library → search "Maps SDK for Android").
   - Use your existing API key (the one used for Places) or create a new key.
   - If you use a new key, restrict it to "Maps SDK for Android" and your app (package name `com.lunchmeet.app`).

2. **EAS / app config**
   - The app reads the key from `GOOGLE_PLACES_API_KEY` or `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` in `app.config.js`.
   - For EAS builds, set one of these in EAS **Secrets** (or Environment variables) for the **preview** (and production) environment.

3. **Rebuild the app**
   - The Maps API key is baked into the native Android app at build time.
   - OTA updates do **not** change it.
   - Run a new build and install that build:
     ```bash
     eas build --profile preview --platform android
     ```
   - Install the new APK on your device; then open the app and try the map again.

---

## Fix 2: Lunch coordinates (for markers)

So that lunches show on the map, they need `latitude` and `longitude` in the database.

1. **Run the migration** (if you haven’t):
   - In Supabase → SQL Editor, run:
     ```sql
     ALTER TABLE lunches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
     ALTER TABLE lunches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
     ```

2. **New lunches**
   - Lunches created from the **Host** tab with a place selected get coordinates saved automatically.

3. **Existing lunches**
   - Old lunches without coordinates won’t have markers. Either create new lunches from Host or backfill coordinates (e.g. with a one-off script using the Places API).

---

## Summary

| Issue              | Fix                                                                 |
|--------------------|---------------------------------------------------------------------|
| Blank / no map     | Enable Maps SDK for Android, set API key in EAS, **rebuild** APK.   |
| Map loads, no pins | Run migration, create lunches from Host tab (with a place selected). |

After adding the API key and rebuilding, the map view should load. After running the migration and creating lunches with a place, markers should appear.
