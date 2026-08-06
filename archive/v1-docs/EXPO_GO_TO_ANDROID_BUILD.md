# Why Expo Go Config Doesn’t Show Up in the Android Build (and how to fix it)

In **Expo Go**, your app reads config from your **local machine** (e.g. `.env` and `app.config.js` using `process.env`).  
An **EAS Android build** runs on **Expo’s servers**. Those servers don’t have your `.env` file, so any feature that depends on environment variables can be missing or broken in the built APK.

---

## What usually breaks in the build

- **Supabase (auth, data, chat)** – needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Google Maps / Places (Android)** – needs `GOOGLE_PLACES_API_KEY` or `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` for the native Maps API key in `app.config.js`
- **Any other `EXPO_PUBLIC_*` or `process.env`** used in app or config

If those aren’t set **for the EAS build**, the built app won’t have them and features that rely on them will fail (e.g. no login, no map, no places).

---

## Fix: give EAS the same config (environment variables)

You need to set the **same variables** that your `.env` has, but **for EAS**, in one of these ways:

### Option A – EAS Secrets (recommended for keys)

Secrets are encrypted and used only at build time. Good for Supabase and API keys.

1. In the project folder, run (one per variable):

   ```bash
   npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --scope project
   npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key" --scope project
   npx eas secret:create --name EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY --value "your-google-api-key" --scope project
   ```

   Or set **Google Maps** under the name your config uses:

   ```bash
   npx eas secret:create --name GOOGLE_PLACES_API_KEY --value "your-google-api-key" --scope project
   ```

2. Use the **same names** your `app.config.js` and app code use (e.g. `EXPO_PUBLIC_SUPABASE_URL`, not something else).

3. Re-run the Android build:

   ```bash
   eas build --profile preview --platform android
   ```

Secrets are shared by all build profiles (development, preview, production) unless you use different names or scopes.

### Option B – Build-specific env in `eas.json`

For non-sensitive values or if you prefer not to use secrets:

1. Open `eas.json`.
2. Under the **build** profile you use (e.g. `preview`), set `env`:

   ```json
   "build": {
     "preview": {
       "distribution": "internal",
       "android": { "buildType": "apk" },
       "channel": "preview",
       "env": {
         "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
         "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key",
         "EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY": "your-google-maps-key"
       }
     }
   }
   ```

3. **Don’t commit real keys** if the repo is public; use EAS Secrets instead for those.

---

## How your app gets config

- **Expo Go:**  
  - `process.env.EXPO_PUBLIC_*` and other `process.env` come from your **local** `.env` (and shell).  
  - `app.config.js` runs locally, so `process.env` there is also from your machine.

- **EAS build:**  
  - `process.env` in `app.config.js` and in the bundled JS comes from **EAS**: either **Secrets** or **env** in `eas.json`.  
  - So you must set every variable the app or `app.config.js` needs **in EAS** (per profile or via project secrets).

After you set the same variables in EAS and rebuild, the Android build should behave like Expo Go for those features.

---

## Checklist

1. List every `EXPO_PUBLIC_*` and other env var your app and `app.config.js` use (e.g. Supabase URL/key, Google Maps key).
2. Add each one as an **EAS Secret** (or in `env` in `eas.json` for the profile you build with).
3. Run a **new** Android build: `eas build --profile preview --platform android`.
4. Install the new APK and test (login, map, places, etc.).

---

## Optional: confirm what’s in the build

- In [expo.dev](https://expo.dev) → your project → **Builds** → select the build, you can see which **environment** (and thus which env) was used.
- In the app, you can temporarily log (or show in a debug screen) `Constants.expoConfig?.extra` and the Supabase URL (with the key redacted) to confirm the built app has the right config.

Once the same env vars are set for EAS as in your local Expo Go setup, the Android build should match Expo Go for those features.
