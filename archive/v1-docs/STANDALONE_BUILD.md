# Why the App Stuck on Splash Screen (and How to Fix It)

## What Happened

You built with the **development** profile. Development builds:

- Do **not** include the JavaScript bundle inside the APK
- Expect to load the app from the **Metro dev server** (when you run `expo start`)
- When you install the APK and open it **without** Metro running, the app has no JS to run, so it stays on the splash screen

So the splash screen issue was caused by using a **development** build as if it were a standalone app.

## Fix: Use a Standalone (Preview) Build

For an APK that runs **without** a dev server (install and open, no computer needed), use a **preview** build. It embeds the JavaScript so the app runs on its own.

### Build a standalone Android APK

In PowerShell (in your project folder):

```bash
eas build --profile preview --platform android
```

Or use the npm script:

```bash
npm run build:android:standalone
```

When the build finishes, install that APK on your device. It should:

- Open past the splash screen
- Show login (or your app UI)
- Work without `expo start` or a computer

## What Was Changed in the App

1. **Splash screen handling** in `app/_layout.tsx`:
   - Splash is hidden as soon as the app mounts (after first frame), not when auth finishes.
   - If we waited for auth, a slow or failing Supabase call could leave the splash stuck.
   - Auth has an 8-second timeout so the loading spinner doesn’t run forever.

2. **Build scripts** in `package.json`:
   - `build:android` – development build (needs Metro for JS)
   - `build:android:standalone` – preview build (JS included, no Metro needed)

## When to Use Which Build

| Build type              | Command                              | Use case                                      |
|-------------------------|--------------------------------------|-----------------------------------------------|
| **Development**         | `npm run build:android`              | You + device, with Metro running (`expo start`) |
| **Preview (standalone)** | `npm run build:android:standalone`   | Share APK with others; run without Metro      |
| **Production**          | `eas build --profile production ...` | Store releases                                 |

## Next Step

Run a **preview** build and install that APK:

```bash
npm run build:android:standalone
```

Or open a new PowerShell window and run:

```bash
cd C:\Users\jpmit\Code\LunchMeet
eas build --profile preview --platform android
```

Use the APK from this build for testing on your Android device and for sharing with friends; it will load past the splash screen and run without a dev server.

---

## If Splash Still Sticks: EAS Environment Variables

The standalone app needs Supabase URL and key at **build time**. EAS does not use your local `.env` file.

1. Open [expo.dev](https://expo.dev) → your project → **Settings** (or **Secrets**).
2. Add environment variables for the **preview** (and production) environment:
   - `EXPO_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
3. Run a new preview build so the app is built with these values.

Without these, the app may have no Supabase config and auth (and thus the UI) can hang or fail.
