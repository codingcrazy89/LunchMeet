import Constants from "expo-constants";
import { Platform } from "react-native";

const PROXY_PORT = "8787";

/**
 * Get the proxy server URL for Google Places (autocomplete, nearby, details).
 * - Set EXPO_PUBLIC_PLACES_PROXY_URL in .env (or EAS secrets for cloud build). Required for standalone/Android/iOS builds.
 * - Same Wi‑Fi: http://YOUR_IP:8787 | Remote: ngrok/localtunnel URL — see TUNNEL_AND_PLACES.md
 * - Web: uses localhost:8787
 * - Mobile (Expo Go): uses env or Metro host; standalone build uses env/extra baked at build time.
 */
export function getProxyUrl(): string {
  const envUrl =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_PLACES_PROXY_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  const extraUrl =
    typeof Constants?.expoConfig?.extra?.placesProxyUrl === "string" &&
    Constants.expoConfig.extra.placesProxyUrl.trim();
  if (extraUrl) {
    return extraUrl.replace(/\/$/, "");
  }

  if (Platform.OS === "web") {
    return `http://localhost:${PROXY_PORT}`;
  }

  // Mobile (Expo Go only): use the host your device uses to talk to Metro. Standalone builds must set EXPO_PUBLIC_PLACES_PROXY_URL.
  const host =
    Constants.expoConfig?.hostUri?.split(":")[0] ||
    (Constants as any).manifest?.debuggerHost?.split(":")[0] ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost?.split(":")[0] ||
    "localhost";

  return `http://${host}:${PROXY_PORT}`;
}

/**
 * Fetch from the Places proxy. Adds tunnel bypass headers so we get JSON, not the tunnel's interstitial page:
 * - localtunnel (*.loca.lt): Bypass-Tunnel-Reminder
 * - ngrok (*.ngrok-free.app, *.ngrok-free.dev, *.ngrok.io, etc.): ngrok-skip-browser-warning
 */
export async function fetchFromPlacesProxy(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = getProxyUrl();
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init?.headers);
  if (base.includes("loca.lt")) {
    headers.set("Bypass-Tunnel-Reminder", "true");
  }
  if (base.includes("ngrok")) {
    headers.set("ngrok-skip-browser-warning", "true");
  }
  return fetch(url, { ...init, headers });
}
