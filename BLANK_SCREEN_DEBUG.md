# Blank white screen on Android – causes and fixes

If you still see a blank white screen after login on the built Android app, use this to narrow it down.

---

## What we’ve already fixed

| Cause | Fix |
|-------|-----|
| **No SafeAreaProvider** | Root layout wraps the app in `SafeAreaProvider` so `useSafeAreaInsets()` doesn’t throw on Android. |
| **White splash never hides** | Splash is forced to hide after 2.5s. Splash background is `#FAFAFA` so if it’s stuck, you see grey, not white. |
| **White screen containers** | Root, Stack, and tabs use `Colors.background` so screens are never default white. |
| **Unclear where it breaks** | Tabs layout shows “Opening…” for ~250ms so you can tell if the crash is before or after tabs. |

---

## Other possible causes

### 1. Stuck on splash (looks like white)

- **Symptom:** Screen looks white; might be the **native splash** if it never hid.
- **What we did:** Splash now hides after 2.5s no matter what, and splash `backgroundColor` is `#FAFAFA`.
- **If it persists:** In `app/_layout.tsx`, lower the fallback (e.g. 1500ms) or call `SplashScreen.hideAsync()` earlier (e.g. in a `requestAnimationFrame`).

### 2. Deep link / magic link

- **Symptom:** You open the app from the magic link in email and see white.
- **Possible cause:** Initial route or auth state when opening from a link is wrong on Android.
- **Check:** In EAS build, confirm **Android intent filters** and **scheme** `lunchmeet` are set (they are in `app.config.js`). Try logging in **inside the app** (enter email, then open the link on the same device) and see if the screen is still white.

### 3. Missing env in the build

- **Symptom:** App builds but Supabase (or other) config is missing, so auth or data never loads.
- **What to do:** In [expo.dev](https://expo.dev) → project → **Environment variables**, ensure **preview** (and **production** if you use it) have `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_PLACES_PROXY_URL`. Rebuild after changing env.

### 4. Crash before any React UI

- **Symptom:** No “Opening…”, no “Something went wrong”, just white.
- **Possible cause:** Crash in native code or in JS before the first paint (e.g. in a provider or root layout).
- **What to do:** Build a **development** APK and connect the device to your computer: `npx expo run:android` then check Logcat for the crash. Or use EAS Build with a **development** profile and inspect the build logs.

### 5. Wrong build installed

- **Symptom:** You expect the latest fixes but still see the old behavior.
- **What to do:** Uninstall the app, download the **latest** APK from the EAS build page, and install again. Confirm the build date/version matches the one that includes the fixes above.

---

## Quick checklist when you see white

1. **Do you see “Opening…” at all?**
   - **No** → Problem is before tabs (splash, auth, redirect, or Stack). Splash timeout + grey splash should reduce “stuck white” from splash.
   - **Yes** → Problem is in tabs (header or first tab). ErrorBoundary should show “Something went wrong” if a render error is thrown.

2. **After “Opening…”, do you see “Something went wrong”?**
   - **Yes** → Read the error message; that’s the failing code path.
   - **No** → Could be a native crash or an error that doesn’t hit the React error boundary. Use a dev build + Logcat or EAS build logs.

3. **Splash:** With the latest build, the splash background is grey (`#FAFAFA`). If the screen is **pure white**, it may be the old splash or a different screen; confirm you’re on the latest build.

---

## If you add more debugging

- **Temporary “step” text:** In `(tabs)/_layout.tsx` you can show a step (e.g. “Step 2: Tabs”) next to “Opening…” or after it, or in the first tab, to see exactly how far the app gets.
- **Logcat:** `adb logcat *:E` or filter by your app’s package to see native/JS errors.
- **EAS Build logs:** Open the build on expo.dev and check the build and runtime logs for errors.
