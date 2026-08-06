# Using Expo Tunnel + Map & Restaurant Search (Places Proxy)

When you use **Expo tunnel** (`npx expo start --tunnel`), your phone loads the app over the internet. The **Places proxy** (map + restaurant search on the Host tab) runs on your computer at `localhost:8787`, so the phone can’t reach it unless we expose it too.

## Quick start (remote users – no Wi‑Fi required)

Run these in order. Keep all windows open.

1. **Window 1 – Proxy:** `npm run proxy`
2. **Window 2 – Proxy tunnel:** `npm run proxy:tunnel:lt` → copy the `https://....loca.lt` URL
3. **.env:** Set `EXPO_PUBLIC_PLACES_PROXY_URL=https://....loca.lt` (the URL from step 2)
4. **Window 3 – Expo tunnel:** `npx expo start --tunnel` → share the `exp://...` URL with anyone

Anyone can open the `exp://...` URL in Safari (or paste in Expo Go) to use the app with map and restaurant search, without being on your Wi‑Fi. For **most reliable** results with many remote users, use ngrok for the proxy (one-time signup) instead of localtunnel; see below.

## Enable map & restaurant search while using tunnel

1. **Start the proxy** (in one terminal):
   ```bash
   npm run proxy
   ```
   Leave it running. You should see: `Places proxy running on http://localhost:8787`

2. **Expose the proxy with ngrok** (in a second terminal):
   ```bash
   npm run proxy:tunnel
   ```
   This runs `npx ngrok http 8787`. Ngrok will print a public URL, e.g.:
   ```text
   Forwarding   https://abc123.ngrok-free.app -> http://localhost:8787
   ```
   Copy the **https** URL (e.g. `https://abc123.ngrok-free.app`). Leave this terminal open.

3. **Point the app at the public proxy URL**  
   In your project root, add or edit `.env`:
   ```env
   EXPO_PUBLIC_PLACES_PROXY_URL=https://abc123.ngrok-free.app
   ```
   Use the URL from step 2 (no trailing slash). If you already have `EXPO_PUBLIC_PLACES_PROXY_URL` for LAN, replace it with the ngrok URL while using tunnel.

4. **Restart Expo with tunnel**  
   Stop the current Expo process (Ctrl+C), then:
   ```bash
   npx expo start --tunnel
   ```
   So the app picks up the new env and uses the ngrok URL for Places.

5. **Open the app** on your (or your friend’s) device via the Expo tunnel URL. The Host tab should now load the map and restaurant search.

## Summary

- **Terminal 1:** `npm run proxy` (proxy server)
- **Terminal 2:** `npm run proxy:tunnel` (ngrok → proxy; copy the https URL)
- **.env:** `EXPO_PUBLIC_PLACES_PROXY_URL=https://your-ngrok-url`
- **Terminal 3:** `npx expo start --tunnel` (Expo with tunnel)

If ngrok isn’t installed, `npx ngrok http 8787` will prompt you to install it. You can also install it globally: `npm install -g ngrok`. **Ngrok requires a free account and authtoken** (see [ngrok signup](https://dashboard.ngrok.com/signup)).

### Alternative: localtunnel (no account)

```bash
npm run proxy:tunnel:lt
```

Copy the `https://....loca.lt` URL into `EXPO_PUBLIC_PLACES_PROXY_URL` in `.env`. Localtunnel sometimes shows a “login” or “Click to continue” page; if restaurant search still doesn’t work, use ngrok or same Wi‑Fi (below).

## If restaurant search still doesn’t populate

1. **Ensure the proxy is running:** `npm run proxy` in a terminal. If it’s not running, the tunnel has nothing to forward to.
2. **Restart Expo and reload the app:** Stop Expo (Ctrl+C), run `npx expo start --tunnel` again, then on the device shake → Reload (or open the app from the tunnel URL again). So the app picks up `EXPO_PUBLIC_PLACES_PROXY_URL` from `.env`.
3. **Same Wi‑Fi (most reliable for testing):** Put the phone and computer on the same Wi‑Fi. In a terminal run `npm run expo:url` (or check the Expo terminal for `exp://192.168.x.x:8081`). In `.env` set `EXPO_PUBLIC_PLACES_PROXY_URL=http://YOUR_COMPUTER_IP:8787` (e.g. `http://192.168.1.100:8787`). Open the **local** `exp://192.168.x.x:8081` URL in Safari on the phone (not the tunnel URL). Restaurant search and map will use the proxy on your LAN.
4. **Use ngrok for the proxy:** Localtunnel can return a login page that blocks API requests. Ngrok (with a free account) is more reliable; use `npm run proxy:tunnel` and put the ngrok URL in `EXPO_PUBLIC_PLACES_PROXY_URL`.
