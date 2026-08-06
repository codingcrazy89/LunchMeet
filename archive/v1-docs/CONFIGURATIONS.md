# LunchMeet Configurations

Saved runtime setups for running the app with different environments. Use the scripts in `scripts/` or ask **"Load configuration N"** to restore a setup.

---

## Configuration 1: Remote access (Cloudflare tunnels)

**Purpose:** App and restaurant search work for anyone with the link, including people **not** on your WiFi. No accounts or API keys needed for the tunnels.

### Components

| # | Window / Process | Port | Command | Notes |
|---|-----------------|------|---------|-------|
| 1 | **PLACES PROXY** | 8787 | `npm run proxy` | Google Places API proxy for restaurant search |
| 2 | **METRO BUNDLER** | 8081 | `npx expo start --port 8081` | Expo/React Native dev server |
| 3 | Cloudflare tunnel (background) | — | `cloudflared` npm package | Exposes proxy at `https://<random>.trycloudflare.com` |
| 4 | Cloudflare tunnel (background) | — | `cloudflared` npm package | Exposes Metro at `https://<random>.trycloudflare.com` |

### .env (auto-updated)

- `EXPO_PUBLIC_PLACES_PROXY_URL` = Cloudflare proxy tunnel URL (e.g. `https://xxxx.trycloudflare.com`)
- Other vars (Google Places key, Supabase) stay unchanged

### Output

- Shareable URL: `exps://<metro-tunnel-host>`
- QR code: `expo-go-qr.png` in project root
- Friend opens Expo Go → "Enter URL manually" → paste the `exps://` URL, or scan QR

### Load via script

```powershell
.\scripts\load-configuration-1.ps1
```

Or say **"Load configuration 1"** and the assistant will run it.

### Dependencies

Already in `devDependencies`:
- `cloudflared` ^0.7.0
- `qrcode` ^1.5.4

### Notes

- Tunnel URLs change each time (Cloudflare Quick Tunnels are ephemeral)
- The script auto-updates `.env` with the new proxy tunnel URL
- Stale node/cloudflared processes are killed before starting
