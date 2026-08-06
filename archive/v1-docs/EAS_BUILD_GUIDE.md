# EAS Build Setup Complete! 🚀

## Configuration Files Created

✅ **eas.json** - Build profiles configured
✅ **app.json** - Updated with EAS project ID and Android permissions
✅ **package.json** - Added build scripts

---

## Build Profiles Configured

### 1. **Development** (for testing with friends)
- Includes dev tools and hot reload
- Android: Creates APK (easy to share)
- iOS: Requires device registration

### 2. **Preview** (pre-production testing)
- Production-like build without app store
- Good for final testing before release

### 3. **Production** (app store release)
- Optimized builds for App Store & Google Play

---

## 🎯 Next Steps: Build for Android

### Step 1: Login to EAS (if not already)
```bash
eas login
```

### Step 2: Build Android Development APK
```bash
npm run build:android
```

Or manually:
```bash
eas build --profile development --platform android
```

### What Happens:
1. EAS uploads your project to cloud
2. Builds the APK (~10-15 minutes)
3. Gives you a **download URL** like: `https://expo.dev/artifacts/eas/abc123.apk`

### Step 3: Share with Friends
- Copy the download URL from the build output
- Send to friends via text/email
- They click → Download → Install → Done! ✅

---

## 📱 For iOS Testing

```bash
npm run build:ios
```

**Note:** iOS is more restrictive:
- Requires Apple Developer account ($99/year) OR
- Need to register each tester's device UDID
- Better to use TestFlight for distribution

For quick iOS testing, Expo Go is still easiest.

---

## 🔄 Updating Your Build

After making code changes:

**Option 1: Rebuild (slow but thorough)**
```bash
npm run build:android
```

**Option 2: Push OTA update (instant!)**
```bash
eas update --branch development
```
- Users with installed build get updates automatically
- No need to reinstall
- Only works for JavaScript/React changes (not native code)

---

## 📊 Check Build Status

```bash
eas build:list
```

Or visit: https://expo.dev/accounts/jpmitchell89/projects/lunchmeet/builds

---

## 🎉 Ready to Build!

Run this command to create your first shareable build:

```bash
npm run build:android
```

The build will take 10-15 minutes. Once complete, EAS will provide a URL you can share with anyone to test your app!

---

## Troubleshooting

**Build fails?**
- Check that all assets exist (icons, splash screen)
- Ensure Supabase credentials are in environment
- Check build logs at expo.dev

**Need iOS build?**
- Use `npm run build:ios`
- Will need Apple Developer account or device UDIDs
- Consider TestFlight for easier distribution

**Want production builds?**
- Update `eas.json` production profile
- Run `eas build --profile production --platform android`
- Submit with `eas submit --platform android`
