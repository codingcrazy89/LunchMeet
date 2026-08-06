# Configuration 1 — Runtime Environment Snapshot

**Date:** February 28, 2026
**Purpose:** Remote access setup using Cloudflare tunnels. App is viewable by anyone with the link — no WiFi connection to your network required. Includes QR code generation.

---

## Running Processes

| # | Window / Process | Port | Command | Purpose |
|---|-----------------|------|---------|---------|
| 1 | **Places Proxy** | 8787 | `npm run proxy` | Google Places API proxy for restaurant search |
| 2 | **Metro Bundler** | 8081 | `npx expo start --port 8081` | Expo/React Native dev server |
| 3 | Cloudflare tunnel (background) | — | `cloudflared` npm package | Tunnels port 8787 to public URL |
| 4 | Cloudflare tunnel (background) | — | `cloudflared` npm package | Tunnels port 8081 to public URL |

---

## Tunnel Setup

- **Proxy tunnel:** Cloudflare Quick Tunnel → exposes `localhost:8787` as `https://<random>.trycloudflare.com`
- **Metro tunnel:** Cloudflare Quick Tunnel → exposes `localhost:8081` as `https://<random>.trycloudflare.com`
- **Shareable URL format:** `exps://<metro-tunnel-host>`
- **QR code:** Saved to `expo-go-qr.png` in project root

URLs change each time because Cloudflare Quick Tunnels are ephemeral (no account needed).

---

## .env (Configuration 1)

```env
GOOGLE_PLACES_API_KEY=<your key>
EXPO_PUBLIC_SUPABASE_URL=https://oamukmulfmmlkxrjtjfx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your key>
EXPO_PUBLIC_PLACES_PROXY_URL=<cloudflare proxy tunnel URL>
```

`EXPO_PUBLIC_PLACES_PROXY_URL` is auto-updated by the load script each time tunnels start.

---

## Dependencies Required

These are already in `devDependencies`:
- `cloudflared` ^0.7.0 — Cloudflare tunnel client (no account needed)
- `qrcode` ^1.5.4 — QR code generation for shareable link

---

## How to Restore

Say **"Load configuration 1"** or run:

```powershell
.\scripts\load-configuration-1.ps1
```

This will:
1. Kill any stale node/cloudflared processes
2. Open a PowerShell window for the Places Proxy (port 8787)
3. Open a PowerShell window for Metro Bundler (port 8081)
4. Start a Cloudflare tunnel for the proxy and update `.env`
5. Start a Cloudflare tunnel for Metro
6. Generate a QR code (`expo-go-qr.png`) and display the shareable URL

---

## Instructions for Friend

1. Install **Expo Go** on their phone (iOS App Store / Google Play Store)
2. Open Expo Go → tap **"Enter URL manually"**
3. Paste the `exps://...trycloudflare.com` URL shown in the script output
4. Or scan the QR code from `expo-go-qr.png`
