# How to Start the Servers

## Quick Start (Choose One)

### Option A: VS Code Tasks (Recommended)

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type **Run Task** and select it
3. Choose **Start Mobile Development** — opens two terminals automatically

Or run tasks individually:
- **Start Proxy Server** — Places API proxy (Terminal 1)
- **Start Expo (Mobile)** — Expo dev server with QR code (Terminal 2)

### Option B: PowerShell Script

```powershell
npm run start-mobile
```

Or from PowerShell in the project folder:

```powershell
.\scripts\start-mobile.ps1
```

Opens two PowerShell windows (proxy + Expo) for you to scan the QR code.

### Option C: Manual Terminals

Open **TWO separate terminal windows** and run:

**Terminal 1 - Proxy Server**
```powershell
cd C:\Users\jpmit\Code\LunchMeet
npm run proxy
```

You should see: `🚀 Places proxy running on http://localhost:8787`

**Terminal 2 - Expo Development Server**
```powershell
cd C:\Users\jpmit\Code\LunchMeet
npm start
```

You should see:
- A QR code
- Options to press 'i' for iOS, 'a' for Android, or 'w' for web

## Connect Your Mobile Device

1. **Install Expo Go** on your phone:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Make sure your phone and computer are on the same Wi-Fi network**

3. **Scan the QR code** that appears in Terminal 2 with:
   - **iOS**: Use the Camera app (it will open Expo Go automatically)
   - **Android**: Open Expo Go app and tap "Scan QR code"

4. The app will load on your phone!

## Alternative: Use Expo CLI Commands

If you prefer, you can also run:

```bash
# For iOS simulator (requires Mac + Xcode)
npm run ios

# For Android emulator (requires Android Studio)
npm run android

# For web browser
npm run web
```

## Troubleshooting

**If you get "Connection Refused":**
- Make sure both servers are running
- Check that your phone and computer are on the same Wi-Fi
- Try restarting both terminals

**If the QR code doesn't work:**
- Look for a URL like `exp://192.168.x.x:8081` in the terminal
- Manually enter that URL in the Expo Go app
