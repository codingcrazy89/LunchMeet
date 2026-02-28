# 🚀 Build Your First Shareable APK

## Quick Start - 3 Steps

### Step 1: Login to EAS
Open PowerShell and run:
```bash
eas login
```
Enter your Expo credentials.

### Step 2: Start the Build
```bash
npm run build:android
```

This will:
- Upload your project to EAS servers
- Build an Android APK (~10-15 minutes)
- Include all your Supabase credentials automatically

### Step 3: Get Your Shareable Link
When the build completes, you'll see:
```
✔ Build finished successfully
📱 Install and run the development build
   https://expo.dev/artifacts/eas/[unique-id].apk
```

**Copy that URL and send it to your friends!** 

They can:
1. Click the link on their Android phone
2. Download the APK
3. Install it (may need to allow "Install from Unknown Sources")
4. Use your app - no Expo Go needed! ✅

---

## What's Included in the Build?

✅ Your app code (React Native)
✅ Supabase credentials (already configured)
✅ Google Maps API key
✅ App icons and splash screen
✅ All native dependencies (expo-image-picker, etc.)

---

## During the Build

Watch the progress:
```bash
# Check build status
eas build:list

# Or view in browser
https://expo.dev/accounts/jpmitchell89/projects/lunchmeet/builds
```

The build runs in the cloud, so you can close your terminal and check back later.

---

## After Your Friends Install

They can:
- Use the app immediately
- No Expo Go required
- Full native app experience
- Login with magic links
- Upload photos, join lunches, etc.

When you make updates:
1. Push OTA updates: `eas update --branch development` (instant)
2. Or rebuild: `npm run build:android` (for native changes)

---

## For iOS Testing

iOS is more complex (requires Apple Developer account or device UDIDs).

**Easiest iOS options:**
1. **Expo Go** (for quick testing)
2. **TestFlight** (requires $99/year Apple Developer account)

For now, Android APK is the simplest way to share!

---

## Troubleshooting

**"Build failed"**
- Check build logs at expo.dev
- Ensure all icons exist in assets/images/
- Verify Supabase credentials are valid

**"Installation blocked"**
- Friends need to enable "Install from Unknown Sources" on Android
- Settings → Security → Unknown Sources

**"App crashes on launch"**
- Check if Supabase credentials are correct
- View logs in EAS dashboard

---

## Ready? Let's Build!

Run this command now:

```bash
npm run build:android
```

In 10-15 minutes, you'll have a shareable link! 🎉
