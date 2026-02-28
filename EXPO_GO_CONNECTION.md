# Connecting to Expo Go App - Updated Guide

## Method 1: Deep Link (Easiest)

1. **In the Expo terminal window**, look for a line that shows:
   ```
   exp://192.168.0.61:8081
   ```
   or
   ```
   exp://exp.host/@your-username/lunchmeet
   ```

2. **On your phone:**
   - Open a **web browser** (Safari on iOS, Chrome on Android)
   - Type or paste the `exp://` URL exactly as shown in the terminal
   - Your phone should ask "Open in Expo Go?" - tap **Open**

## Method 2: Find "Enter URL" in Expo Go

The manual entry might be hidden. Try these steps:

**iOS:**
1. Open Expo Go app
2. Tap the **three dots (⋯)** or **settings icon** in the top right
3. Look for "Enter URL manually" or "Connection"
4. If you see a search bar at the top, tap it and enter the URL

**Android:**
1. Open Expo Go app
2. Tap the **menu icon (☰)** in the top left
3. Look for "Enter URL manually" or "Connection"
4. Or tap the search bar at the top

## Method 3: Shake Gesture (Developer Menu)

1. **On your phone**, open Expo Go app
2. **Shake your device** (or use the device menu button)
3. This opens the developer menu
4. Look for "Enter URL" or "Connection" options

## Method 4: Share from Terminal

1. In the Expo terminal, you should see a URL like:
   ```
   exp://192.168.0.61:8081
   ```

2. **Copy this URL** from the terminal

3. **Send it to yourself:**
   - Email it to yourself
   - Text it to yourself
   - Use a note-taking app

4. **On your phone**, open the message/email and tap the link
   - Your phone should open it in Expo Go automatically

## Method 5: Use Expo Go's Recent Projects

If you've connected before:
1. Open Expo Go
2. Check the "Recent" or "History" section
3. Your project might appear there

## Troubleshooting

**If the QR code says "no usable data found":**
- The QR code might be for a different format
- Try Method 1 (deep link) instead
- Make sure you're scanning the QR code from the Expo terminal, not a screenshot

**If you can't find "Enter URL":**
- The Expo Go app version might be different
- Try Method 1 (deep link from browser)
- Try Method 4 (share the URL)

**If nothing works:**
- Make sure your phone and computer are on the **same Wi-Fi network**
- Check that both servers are running (ports 8081 and 8787)
- Try restarting the Expo server: `npx expo start --clear`
