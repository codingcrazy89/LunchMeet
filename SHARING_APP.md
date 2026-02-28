# Sharing LunchMeet for Testing

## Current Setup (Expo Go)
✅ **What you have now:**
- Friends need to install **Expo Go** app
- They scan your QR code or enter the URL
- Works for basic testing

❌ **Limitations:**
- Requires Expo Go app (extra step)
- Some native modules may have limited functionality
- Not the "real" app experience

---

## Better Options for Easy Sharing

### Option 1: EAS Build (Development Build) - **RECOMMENDED FOR TESTING**

This creates a **standalone app** your friends can install directly - no Expo Go needed!

#### Setup Steps:

1. **Install EAS CLI** (one-time setup):
```bash
npm install -g eas-cli
eas login
```

2. **Configure EAS Build**:
```bash
eas build:configure
```

3. **Build Development Version for Testing**:

**For iOS** (iPhone users):
```bash
eas build --profile development --platform ios
```
- Creates an `.ipa` file
- Friends install via TestFlight or direct link
- Works on their devices (requires adding their device UDID first)

**For Android** (easier for testing):
```bash
eas build --profile development --platform android
```
- Creates an `.apk` file
- EAS gives you a direct download link
- Friends can install directly from link (no Google Play needed)
- Just send them the URL!

#### After Build Completes:
- EAS provides a shareable URL
- Friends click link → Download → Install
- **No Expo Go required!**
- App runs standalone

**Cost:** Free tier includes limited builds per month (enough for testing)

---

### Option 2: Expo Publish + Custom Dev Client

Use your existing `expo-dev-client` for a better experience:

1. **Build custom dev client once**:
```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

2. **Publish updates instantly**:
```bash
npx expo publish
```
- Friends install dev client once (from step 1)
- You can push updates without rebuilding
- Better than Expo Go, uses your actual native code

---

### Option 3: EAS Update (For Installed Builds)

Once friends have the development build installed:
```bash
eas update --branch development
```
- Push instant updates over-the-air
- No need to reinstall
- Great for iterative testing

---

### Option 4: Production Builds (App Stores)

When ready for real users:

**TestFlight (iOS):**
```bash
eas build --profile production --platform ios
eas submit --platform ios
```
- Apple TestFlight allows up to 10,000 testers
- Professional distribution
- Requires Apple Developer account ($99/year)

**Google Play Internal Testing (Android):**
```bash
eas build --profile production --platform android
eas submit --platform android
```
- Unlimited testers
- Requires Google Play Developer account ($25 one-time)

---

## Quick Start: Easiest Path for Testing (Android)

**For the simplest friend testing on Android:**

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login to Expo account
eas login

# 3. Configure (first time only)
eas build:configure

# 4. Build Android APK
eas build --profile development --platform android
```

After ~10-15 minutes, EAS gives you a URL like:
`https://expo.dev/artifacts/eas/abc123.apk`

**Send that URL to friends** → They download → Install → Done! ✅

---

## What I Recommend

**For testing with friends RIGHT NOW:**
1. Use **EAS Build** with **Android** (easiest - no device registration needed)
2. Send them the APK download link
3. They install directly - no Expo Go needed

**For iOS testing:**
1. Need Apple Developer account or collect device UDIDs
2. Use TestFlight for cleaner experience
3. Or use Expo Go for quick testing (requires Expo Go app)

**For production launch:**
1. Create production builds
2. Submit to App Store & Google Play
3. Public availability

---

## Commands Reference

```bash
# Development builds (for testing)
eas build --profile development --platform android
eas build --profile development --platform ios

# Production builds (for app stores)
eas build --profile production --platform android
eas build --profile production --platform ios

# Push updates to installed builds
eas update --branch production

# Check build status
eas build:list
```

---

## Next Steps

Let me know which option you'd like to pursue and I can:
1. Set up EAS configuration files
2. Create build profiles for development/production
3. Help with TestFlight setup
4. Configure automatic updates

**Recommended:** Start with Android development build - it's the fastest path to get a shareable link!
