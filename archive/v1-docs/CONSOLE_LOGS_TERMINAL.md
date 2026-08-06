# See Live Workflow in PowerShell

To see `[Auth]`, `[Login]`, `[Host]`, and other logs **in the PowerShell terminal** (not just in the app):

## 1. Start Expo so logs stream to the terminal

**Option A – New window (recommended)**  
From your project folder, run:

```powershell
npm run start:console
```

This opens a **new PowerShell window** running the Expo dev server. All app logs will appear in that window.

**Option B – Current terminal**  
In any PowerShell window:

```powershell
cd C:\Users\jpmit\Code\LunchMeet
npx expo start --port 8083
```

Leave this terminal open.

## 2. Open the app in Expo Go

- On your phone: open **Expo Go** and scan the **QR code** from the terminal (or enter the URL).
- Same Wi‑Fi as your PC.
- The app connects to Metro; logs from the app stream to the **same terminal** where Expo is running.

## 3. Use the app and watch the terminal

- Tap **Send Login Link** on the login screen.
- In the terminal you should see lines like:
  - `[Auth] signInWithEmail called, email length: 14`
  - `[Auth] redirectTo: ...`
  - `[Auth] Supabase URL configured: true Anon key configured: true`
  - `[Auth] signInWithOtp response - error: null data: present`
  - `[Auth] Magic link sent successfully`
- If something fails, you’ll see `[Auth] Magic link error: ...` or `[Login] signInWithEmail error: ...`.

## Important

- **Standalone (preview) build:** The installed APK does **not** connect to Metro. Logs will **not** appear in the terminal. Use the in‑app **“View debug logs”** / **“Logs”** instead.
- **Expo Go or dev build + `npx expo start`:** Logs **do** stream to the terminal where Expo is running.
- If port 8081 is in use, the script uses **8083**. Scan the QR code from the terminal that shows “Metro waiting on …”.

## Magic links not sending

If you see in the terminal:

- **`Supabase URL configured: false`** or **`Anon key configured: false`**  
  → Supabase env vars are missing (e.g. in EAS for standalone, or in `.env` for local). Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

- **`[Auth] Magic link error: ...`**  
  → The message after that is from Supabase (e.g. invalid redirect URL). Add your app’s redirect URL in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.

- **`Magic link sent successfully`** but no email  
  → Request reached Supabase; delivery issue (spam, Outlook, etc.). See `MAGIC_LINK_OUTLOOK.md`.
