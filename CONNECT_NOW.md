# Connect to Expo App - Quick Guide

## Your Connection URL

Based on your setup, use this URL:

**`exp://192.168.0.61:8081`**

## How to Connect

### Method 1: Open URL in Phone Browser (Easiest)

1. **On your phone**, open a web browser (Safari on iOS, Chrome on Android)
2. **Type or paste this URL** in the address bar:
   ```
   exp://192.168.0.61:8081
   ```
3. Tap Go/Enter
4. Your phone should ask "Open in Expo Go?" - tap **Open**

### Method 2: Send URL to Yourself

1. **Copy this URL**: `exp://192.168.0.61:8081`
2. **Send it to yourself** via:
   - Text message
   - Email
   - Notes app
   - Any messaging app
3. **On your phone**, tap the link
4. It should open in Expo Go automatically

### Method 3: Check Expo Terminal

In your Expo terminal window, look for:
- A QR code (even if it doesn't scan)
- Text that says "Metro waiting on exp://..."
- Text that says "To open the app on your phone..."
- Any line containing "exp://"

The URL format should be: `exp://[IP_ADDRESS]:8081`

## Troubleshooting

**If the URL doesn't work:**
1. Make sure your phone and computer are on the **same Wi-Fi network**
2. Make sure the Expo server is running (port 8081)
3. Try restarting the Expo server:
   ```bash
   npx expo start --clear
   ```

**If you still can't connect:**
- Try using tunnel mode: `npx expo start --tunnel`
- This creates a public URL that works from anywhere
