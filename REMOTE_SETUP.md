# Remote Access Setup (Users Not on Your WiFi)

To make LunchMeet fully functional for users who are **not** on your WiFi network, you need to expose both the app (Expo/Metro) and the Places proxy (map + restaurant search) over the internet.

## Quick Start (Restaurant search works remotely)

**Recommended:** Use the ngrok script for reliable restaurant search when remote:

```powershell
npm run start-remote:ngrok
```

This uses one ngrok agent with 2 tunnels (proxy + Metro), so restaurant search works. Opens 4 windows: proxy, Metro, ngrok, and the script output with the exp:// URL to share.

**If ngrok fails to fetch URLs:** Use Cloudflare tunnel (no account needed):

```powershell
npm run start-remote:cloudflare
```

**Alternative:** `npm run start-remote` (uses localtunnel for proxy; search may fail):

```powershell
npm run start-remote
```

This opens three PowerShell windows:
1. **Places proxy** – Serves map and restaurant search
2. **Proxy tunnel** – Exposes the proxy via localtunnel (runs in background)
3. **Expo tunnel** – Exposes the app via ngrok

Share the `exp://` URL or QR code from the Expo window with anyone. They can open it in Expo Go—no WiFi required.

## First-Time Setup: Ngrok (Required for Expo Tunnel)

Expo's `--tunnel` mode uses ngrok. You need a free ngrok account:

1. **Sign up:** https://dashboard.ngrok.com/signup
2. **Get your authtoken:** https://dashboard.ngrok.com/get-started/your-authtoken
3. **Configure ngrok:**
   ```powershell
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

If you skip this step, Expo tunnel will fail with "ngrok tunnel took too long to connect."

## Manual Setup (If Script Fails)

Run these in **three separate** PowerShell windows:

| Window | Command |
|--------|---------|
| 1. Proxy | `npm run proxy` |
| 2. Proxy tunnel | `npm run proxy:tunnel:lt` → copy the `https://....loca.lt` URL |
| 3. Expo tunnel | Set `EXPO_PUBLIC_PLACES_PROXY_URL=https://....loca.lt` in `.env`, then `npx expo start --tunnel` |

## Alternative: Ngrok for Proxy (More Reliable)

Localtunnel can sometimes show a "Click to continue" page that blocks API requests. For more reliable remote access:

1. Run `npm run proxy:tunnel` (uses ngrok for the proxy)
2. Copy the `https://....ngrok-free.app` URL
3. Set `EXPO_PUBLIC_PLACES_PROXY_URL` in `.env` to that URL
4. Run `npx expo start --tunnel`

## Troubleshooting

- **"ngrok tunnel took too long"** – Run `ngrok config add-authtoken YOUR_TOKEN`
- **Restaurant search doesn't work on mobile (remote)** – The proxy must be reachable via a tunnel URL:
  1. Ensure `EXPO_PUBLIC_PLACES_PROXY_URL` in `.env` is the **proxy tunnel** URL (e.g. `https://xxx.loca.lt` or `https://xxx.ngrok-free.app`), not your local IP
  2. Restart the Expo window (Ctrl+C, then `npx expo start --tunnel` again)
  3. Reload the app on your phone (shake → Reload, or reopen from the exp:// URL)
  4. To set the URL: `.\scripts\set-proxy-url.ps1 "https://your-tunnel-url.loca.lt"`
  5. For more reliable search, use `.\scripts\load-configuration-1.ps1` (ngrok for proxy)
- **Localtunnel shows login page** – Use ngrok for the proxy instead (`npm run proxy:tunnel`)
