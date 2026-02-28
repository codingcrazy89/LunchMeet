# Mobile Connection Guide

## Method 1: Tunnel Mode (Recommended)

Tunnel mode works better when QR codes don't work. Restart the Expo server with:

```bash
cd C:\Users\jpmit\Code\LunchMeet
npx expo start --tunnel
```

This will:
- Create a tunnel that works even if your phone and computer are on different networks
- Generate a QR code that should work better
- Show a URL you can manually enter

## Method 2: Manual Connection in Expo Go

1. **Get your computer's IP address:**
   - Open PowerShell and run: `ipconfig`
   - Look for "IPv4 Address" under your active network adapter
   - Example: `192.168.1.100`

2. **Get the port from the Expo terminal:**
   - Look for a line like: `Metro waiting on exp://192.168.x.x:8081`
   - Or check the terminal for the port number (usually 8081)

3. **In Expo Go app:**
   - Tap "Enter URL manually"
   - Enter: `exp://YOUR_IP_ADDRESS:8081`
   - Example: `exp://192.168.1.100:8081`

## Method 3: LAN Mode (Same Network)

If your phone and computer are on the same Wi-Fi:

```bash
cd C:\Users\jpmit\Code\LunchMeet
npx expo start --lan
```

Then use the `exp://` URL shown in the terminal.

## Troubleshooting QR Code Issues

**"No usable data found" usually means:**
- The QR code format isn't compatible with your camera
- The Expo server isn't fully started yet
- Network connectivity issues

**Solutions:**
1. Wait 30-60 seconds after starting Expo for it to fully initialize
2. Try tunnel mode (Method 1)
3. Use manual connection (Method 2)
4. Make sure both proxy and Expo servers are running

## Check if Servers are Running

**Proxy Server (port 8787):**
```bash
netstat -an | findstr 8787
```

**Expo Server (port 8081):**
```bash
netstat -an | findstr 8081
```

If you see "LISTENING", the servers are running.
