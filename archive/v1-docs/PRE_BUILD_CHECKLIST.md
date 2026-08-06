# Pre-build checklist (save EAS builds)

Use this to confirm the app works **before** running another EAS build.

---

## 1. Test on Android without using an EAS build

**Option A: Expo Go on an Android device (recommended)**

- Same JavaScript bundle as a production build; catches the SafeAreaProvider/blank-screen fix.
- Does **not** use your EAS build quota.

Steps:

1. On your computer: `npm run proxy` (optional, for Host tab). Start Expo: `npx expo start --tunnel` (or same Wi‑Fi and use the printed `exp://` URL).
2. On your **Android phone**: Install **Expo Go** from the Play Store if needed. Open the `exp://` URL (e.g. in Chrome) or scan the QR code.
3. In the app: **Log in** (magic link or your normal flow).
4. After login you should see the **Lunches** tab (list), header, and bottom tabs — **no blank white screen**.

If you see the tabs and content after login, the SafeAreaProvider fix is working and the next EAS build should behave the same.

**Option B: Local Android build (no EAS)**

- Uses your machine and Android SDK only; **does not** use EAS build quota.

```bash
npx expo run:android
```

- Requires Android Studio / SDK and a device or emulator.
- Builds and runs the app locally so you can test the full native build path.

---

## 2. Code/config checklist (already done)

| Item | Status |
|------|--------|
| `SafeAreaProvider` in `app/_layout.tsx` | ✅ Wraps app so `useSafeAreaInsets()` works on Android |
| `eas.json` has `environment` per profile | ✅ Builds use EAS env vars (Supabase, proxy URL) |
| `EXPO_PUBLIC_PLACES_PROXY_URL` in EAS (preview/production) | ✅ Set in dashboard or via script |
| Supabase env vars in EAS | ✅ Already configured |
| ErrorBoundary wraps root | ✅ Shows "Something went wrong" if a render error occurs |

---

## 3. When you’re ready to build

After confirming in Expo Go (or `expo run:android`) that login → tabs works on Android:

```bash
eas build --profile preview --platform android
```

---

## Summary

- **Blank white screen fix:** Root layout now wraps the app in `SafeAreaProvider`. All screens that use `useSafeAreaInsets()` (tabs, header, login, chat, profile) have a provider on Android.
- **Visible "Opening…" step:** After login, the tabs layout shows "Opening…" for ~250 ms before rendering the header and tabs. When testing the built APK:
  - If you **never** see "Opening…" → the issue is before the tabs (redirect or Stack).
  - If you see **"Opening…" then blank** → the issue is in the tabs layout (AppHeader or Tabs) or the first tab screen.
  - If you see **"Opening…" then the app** → the flow is working.
- **Confirm without spending a build:** Run the app in **Expo Go on your Android phone**, log in, and check that the main screen and tabs appear. If they do, the next EAS build should be fine.
