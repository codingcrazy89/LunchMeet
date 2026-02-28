# Magic Link Troubleshooting

## Emails not arriving (e.g. Outlook)

If **magic link emails never show up** in your inbox (common with Outlook):

- See **[MAGIC_LINK_OUTLOOK.md](./MAGIC_LINK_OUTLOOK.md)** for:
  - Using **Custom SMTP** in Supabase (required for reliable delivery to Outlook)
  - Checking Junk/Spam and Safe senders in Outlook
  - Verifying Supabase Auth logs

---

## Browser not loading when you click the link

If the browser window doesn't load when you click the magic link in your email, try these solutions:

## Solution 1: Open Link in System Browser (Recommended)

Many email apps (Gmail, Outlook, etc.) open links in an **in-app browser** that can't handle deep links properly. 

**On iOS:**
1. In your email app, **long-press** the magic link
2. Select **"Open in Safari"**
3. The link should now open in Safari, which can properly redirect to Expo Go

**On Android:**
1. In your email app, **long-press** the magic link  
2. Select **"Open in Chrome"** or **"Open in Browser"**
3. The link should now open in Chrome, which can properly redirect to Expo Go

## Solution 2: Copy Link and Open Manually

1. **Copy the magic link** from your email
2. **Open Safari (iOS)** or **Chrome (Android)** manually
3. **Paste the link** in the address bar
4. Tap Go - it should redirect to Expo Go and log you in

## Solution 3: Check Supabase Redirect URLs

Make sure you've added these in **Supabase Dashboard** → **Authentication** → **URL Configuration** → **Redirect URLs**:

- `lunchmeet://**`
- `exp://**`

**Important:** The `**` wildcard is required to allow all paths under those schemes.

## Solution 4: Check Console Logs

The app now logs helpful information. When you:
1. **Request a magic link** - Check the console for: `📧 Sending magic link with redirect URL: exp://...`
2. **Click the link** - Check the console for: `🔗 Deep link received: ...`

If you see errors, share them for debugging.

## Solution 5: Verify Redirect URL Format

The redirect URL should look like:
- **Expo Go:** `exp://192.168.0.61:8081` (or similar)
- **Production:** `lunchmeet://`

If the URL looks wrong, the app might be generating an incorrect redirect URL.

## Solution 6: Try Tunnel Mode

If you're having network issues, try using Expo's tunnel mode:

1. Stop the Expo server
2. Run: `npx expo start --tunnel`
3. Request a new magic link
4. The redirect URL will use Expo's tunnel (e.g., `exp://u.expo.dev/...`)
5. Add `exp://u.expo.dev/**` to Supabase redirect URLs

## Still Not Working?

1. **Check the email link** - Does it open at all? If not, the link might be malformed
2. **Check Supabase logs** - Go to Supabase Dashboard → Authentication → Logs to see if the verification is happening
3. **Try a different email client** - Some email apps handle links better than others
4. **Restart Expo Go** - Close and reopen the Expo Go app
5. **Request a new magic link** - Old links expire after a few minutes

## Expected Flow

1. ✅ You request magic link in Expo Go app
2. ✅ Email arrives with link
3. ✅ You click link → Opens in browser (Safari/Chrome)
4. ✅ Browser goes to Supabase verification page
5. ✅ Supabase redirects to `exp://...` or `lunchmeet://...`
6. ✅ Your phone opens Expo Go with the app
7. ✅ App reads tokens from URL and logs you in

If step 3-4 fails (browser doesn't load), use Solution 1 or 2 above.
