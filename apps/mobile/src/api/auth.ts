import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

/**
 * Better Auth client, replacing Supabase Auth.
 *
 * The Expo plugin handles the OAuth deep-link handshake and stores the session
 * in SecureStore. v1 hand-rolled that handshake by parsing `access_token` out
 * of the URL fragment and logging the whole URL, tokens included, into an
 * in-app buffer.
 */

function resolveBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromExtra) return fromExtra;

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:8787` : "http://localhost:8787";
}

/**
 * The Expo plugin's `getActions` signature does not structurally match the
 * client's expected plugin type in 1.6.26, even though both packages are the
 * same version and there is a single copy of @better-fetch/fetch installed.
 * Cast narrowly here rather than loosening the whole client's typing, so the
 * session and magic-link types stay intact.
 */
const expoPlugin = expoClient({
  scheme: "lunchmeet",
  storagePrefix: "lunchmeet",
  storage: SecureStore,
}) as unknown as Parameters<typeof createAuthClient>[0] extends { plugins?: (infer P)[] }
  ? P
  : never;

export const authClient = createAuthClient({
  baseURL: resolveBaseUrl(),
  plugins: [magicLinkClient(), expoPlugin],
});

/** Provided by the Expo plugin: the session cookie held in SecureStore. */
export function getSessionCookie(): string | undefined {
  const client = authClient as unknown as { getCookie?: () => string };
  return client.getCookie?.();
}

export const { useSession, signIn, signOut } = authClient;
