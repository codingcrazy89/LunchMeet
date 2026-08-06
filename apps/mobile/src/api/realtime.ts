import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { getSessionCookie } from "./auth";
import { queryKeys } from "./queryClient";

/**
 * WebSocket connection to the API, replacing Supabase Realtime.
 *
 * Events carry identifiers only; receiving one invalidates the relevant query
 * and TanStack Query refetches. That keeps the socket payload small and means
 * a missed event is self-healing on the next fetch, rather than leaving the UI
 * permanently stale.
 */

type ServerEvent =
  | { type: "connected"; userId: string }
  | { type: "message"; lunchId: string; messageId: string }
  | { type: "notification"; notificationId: string }
  | { type: "lunch_updated"; lunchId: string };

function resolveWsUrl(): string {
  const configured = Constants.expoConfig?.extra?.wsUrl as string | undefined;
  if (configured) return configured;

  const apiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (apiUrl) return `${apiUrl.replace(/^http/, "ws")}/ws`;

  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `ws://${host}:8787/ws` : "ws://localhost:8787/ws";
}

export function useRealtime(enabled: boolean): void {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (cancelled) return;

      const cookie = getSessionCookie();

      // React Native's WebSocket accepts a third options argument for custom
      // headers, which the DOM lib types do not declare. Headers are the only
      // way to authenticate the upgrade, since there is no cookie jar on
      // native.
      const NativeWebSocket = WebSocket as unknown as new (
        url: string,
        protocols?: string | string[],
        options?: { headers?: Record<string, string> }
      ) => WebSocket;

      const socket = new NativeWebSocket(
        resolveWsUrl(),
        undefined,
        cookie ? { headers: { Cookie: cookie } } : undefined
      );
      socketRef.current = socket;

      socket.onopen = () => {
        retryRef.current = 0;
      };

      socket.onmessage = (raw) => {
        let event: ServerEvent;
        try {
          event = JSON.parse(String(raw.data)) as ServerEvent;
        } catch {
          return;
        }

        switch (event.type) {
          case "message":
            void queryClient.invalidateQueries({
              queryKey: queryKeys.chat.messages(event.lunchId),
            });
            break;
          case "notification":
            void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
            break;
          case "lunch_updated":
            void queryClient.invalidateQueries({
              queryKey: queryKeys.lunches.detail(event.lunchId),
            });
            break;
          default:
            break;
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        // Exponential backoff, capped, so a server restart does not produce a
        // reconnect storm from every installed client at once.
        const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
        retryRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, queryClient]);
}
