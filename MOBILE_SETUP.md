# Mobile Setup Guide for LunchMeet

This guide will help you run LunchMeet on both web and mobile devices (iOS/Android).

## Prerequisites

1. **Node.js** installed (v18 or higher)
2. **Expo CLI** installed globally: `npm install -g expo-cli`
3. **Expo Go app** installed on your mobile device:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

## Running on Web

```bash
# Start the proxy server (in one terminal)
npm run proxy

# Start the web server (in another terminal)
npm run web
```

The app will open at `http://localhost:8081` (or the port shown in the terminal).

## Running on Mobile

### Step 1: Start the Development Server

```bash
# Start Expo development server
npm start
```

This will show a QR code in your terminal.

### Step 2: Connect Your Mobile Device

**Option A: Using Expo Go (Easiest)**
1. Open the Expo Go app on your phone
2. Scan the QR code from the terminal
3. The app will load on your device

**Option B: Using Development Build**
```bash
# For iOS (requires Mac and Xcode)
npm run ios

# For Android (requires Android Studio)
npm run android
```

### Step 3: Configure Proxy Server for Mobile

The proxy server needs to be accessible from your mobile device. By default, it listens on `0.0.0.0:8787`, which means it's accessible from your local network.

**Important:** Make sure your computer and mobile device are on the same Wi-Fi network.

**Find your computer's IP address:**
- **Windows:** Run `ipconfig` and look for "IPv4 Address"
- **Mac/Linux:** Run `ifconfig` or `ip addr` and look for your local IP (usually starts with 192.168.x.x or 10.0.x.x)

The app will automatically detect the correct proxy URL based on the platform:
- **Web:** Uses `http://localhost:8787`
- **Mobile:** Uses your computer's IP address (e.g., `http://192.168.1.100:8787`)

## Features Optimized for Mobile

### Map View
- Uses `react-native-maps` on mobile (native maps)
- Uses Google Maps iframe on web
- Shows user location on mobile
- Interactive markers for each restaurant

### Host Screen
- Mobile-optimized input fields
- Native date/time pickers
- Touch-friendly buttons
- Keyboard-aware scrolling

### General
- Safe area handling for notched devices
- Platform-specific styling
- Optimized touch targets
- Responsive layouts

## Troubleshooting

### "Connection Refused" on Mobile

1. **Check proxy server is running:**
   ```bash
   npm run proxy
   ```

2. **Verify same Wi-Fi network:**
   - Computer and phone must be on the same network

3. **Check firewall:**
   - Windows: Allow Node.js through Windows Firewall
   - Mac: System Preferences > Security & Privacy > Firewall

4. **Set proxy URL manually (device can't reach proxy):**
   - Find your computer's IP (e.g. 192.168.1.100)
   - In the project root, add to `.env`: `EXPO_PUBLIC_PLACES_PROXY_URL=http://192.168.1.100:8787` (use your IP)
   - Restart Expo (`npm start` or `npx expo start`) so the app picks up the new URL
   - The Host tab shows "Using proxy: ..." when there are no results so you can confirm the URL

### Maps Not Showing on Mobile

1. **Check Google Maps API key:**
   - Ensure `GOOGLE_PLACES_API_KEY` is set in `.env`
   - For iOS, you may need to configure the API key in `app.config.js`

2. **Check react-native-maps setup:**
   - For iOS: May need to run `cd ios && pod install`
   - For Android: Ensure Google Play Services is installed

### Build Errors

```bash
# Clear cache and reinstall
npm start -- --clear

# Rebuild native code (if using development build)
npx expo prebuild --clean
```

## Next Steps

1. **Add location permissions** (if needed):
   ```bash
   npx expo install expo-location
   ```
   Then uncomment the location plugin in `app.config.js`

2. **Configure app icons and splash screens:**
   - Update `assets/images/logo.png` with your app icon
   - The app will automatically use it for icons and splash

3. **Test on physical devices:**
   - iOS: Requires Apple Developer account for physical device testing
   - Android: Enable Developer Options and USB Debugging

## Development Tips

- Use **Expo Go** for quick testing during development
- Use **Development Build** for testing native modules and custom configurations
- The app automatically adapts between web and mobile platforms
- Check the terminal for helpful error messages and connection info
