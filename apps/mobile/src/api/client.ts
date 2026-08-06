import Constants from "expo-constants";
import { hc } from "hono/client";
import type { AppType } from "@lunchmeet/api";
import { getSessionCookie } from "./auth";

/**
 * Typed client for the LunchMeet API.
 *
 * `hc<AppType>` derives request and response types from the Hono routes, so a
 * change to a route signature becomes a compile error here rather than a
 * runtime surprise. v1 had no such link: the client's assumptions about the
 * server drifted freely, which is how it ended up filtering on
 * `visibility_gender` values that nothing ever read.
 */

function resolveBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromExtra) return fromExtra;

  // Expo Go on a device: reach the API on the machine running Metro.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host) return `http://${host}:8787`;
  }

  return "http://localhost:8787";
}

export const API_BASE_URL = resolveBaseUrl();

export const api = hc<AppType>(API_BASE_URL, {
  async fetch(input: RequestInfo | URL, init?: RequestInit) {
    // Better Auth stores the session cookie in SecureStore on native, where
    // there is no cookie jar, so it has to be attached explicitly.
    const headers = new Headers(init?.headers);
    const cookie = getSessionCookie();
    if (cookie) headers.set("Cookie", cookie);

    return fetch(input, { ...init, headers, credentials: "include" });
  },
});

/**
 * Structural shape of anything unwrap can read.
 *
 * Hono's client returns `ClientResponse`, which is Response-like but not
 * assignable to `Response`, so this is typed by shape rather than by class.
 */
interface ResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

/**
 * Unwraps a Hono response, converting the API's error envelope into a throw.
 *
 * TanStack Query treats a rejected promise as an error state; without this
 * every caller would have to check `response.ok` by hand, which is exactly the
 * kind of thing that gets forgotten once.
 */
export async function unwrap<T>(response: ResponseLike): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = `Request failed (${response.status})`;
  let code = "unknown";
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    if (body.error?.message) message = body.error.message;
    if (body.error?.code) code = body.error.code;
  } catch {
    // Non-JSON error body; keep the status-based message.
  }

  throw new ApiRequestError(message, response.status, code);
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  get isSuspended(): boolean {
    return this.code === "account_suspended";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}
