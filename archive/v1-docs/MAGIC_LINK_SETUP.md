# Magic Link Login on Mobile (Expo Go)

When you tap the magic link in your email on your phone, the link must be allowed to redirect back into the app. Follow these steps so the link opens the app and logs you in.

## 1. Add redirect URLs in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add these (one per line):
   - `lunchmeet://**`
   - `exp://**`
4. Save.

- `lunchmeet://**` is for the production/debug app when using the custom scheme.
- `exp://**` is for Expo Go so links like `exp://192.168.0.61:8081` are allowed.

## 2. How it works now

- When you request a login link **in the app** (web or Expo Go), the app sends the correct redirect URL:
  - **Web:** your site origin (e.g. `http://localhost:8081`).
  - **Expo Go:** a URL like `exp://192.168.0.61:8081`.
  - **Built app:** `lunchmeet://`.
- The email link goes to Supabase, then Supabase redirects to that URL with the session tokens.
- On the phone, opening that URL launches Expo Go (or your app) and the app reads the tokens and logs you in.

## 3. If the link still doesn’t open the app

- **“Browser does not load”:**  
  Often the email app opens the link in its in-app browser. After adding the redirect URLs above, try again. If it still fails, tap the “Open in Safari” / “Open in Chrome” option (if your email app shows it), then the redirect should open Expo Go.

- **“Invalid redirect URL” or similar:**  
  Double-check that both `lunchmeet://**` and `exp://**` are listed in **Redirect URLs** in Supabase and that you saved.

- **Link opens but you’re not logged in:**  
  Make sure you’re opening the link on the **same device** where you have Expo Go (or the app) open. The redirect URL is tied to that environment.

## 4. Testing

1. In Expo Go, open the app and enter your email → “Send Login Link”.
2. On your phone, open the email and tap the magic link.
3. After Supabase verifies, it should redirect and open Expo Go (or your app) and log you in.

If anything still doesn’t work, check the exact error message (e.g. in the in-app browser or in Supabase Auth logs) and use that to debug.
