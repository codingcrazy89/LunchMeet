import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { auth } from "../auth.js";
import { onRealtimeEvent, startPubSub, type RealtimeEvent } from "./pubsub.js";

/**
 * WebSocket fan-out, replacing Supabase Realtime.
 *
 * Connections are authenticated at upgrade time using the same Better Auth
 * session as every other request, and events are addressed to explicit
 * recipient lists computed server-side. A client cannot subscribe to a channel
 * it should not see, which was possible in v1: `lunch_attendees` was readable
 * by everyone, so attendance for every lunch was public.
 */

interface Connection {
  socket: WebSocket;
  userId: string;
}

const connections = new Set<Connection>();

/** Sockets held per user, so a fan-out is a map lookup rather than a scan. */
const byUser = new Map<string, Set<Connection>>();

function register(connection: Connection): void {
  connections.add(connection);
  const existing = byUser.get(connection.userId);
  if (existing) {
    existing.add(connection);
  } else {
    byUser.set(connection.userId, new Set([connection]));
  }
}

function unregister(connection: Connection): void {
  connections.delete(connection);
  const set = byUser.get(connection.userId);
  if (!set) return;
  set.delete(connection);
  if (set.size === 0) byUser.delete(connection.userId);
}

function deliver(event: RealtimeEvent): void {
  const payload = JSON.stringify(event);
  for (const userId of event.recipients) {
    const sockets = byUser.get(userId);
    if (!sockets) continue;
    for (const connection of sockets) {
      if (connection.socket.readyState === connection.socket.OPEN) {
        connection.socket.send(payload);
      }
    }
  }
}

export function attachRealtime(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    void (async () => {
      try {
        // Authenticate before completing the handshake, so an unauthenticated
        // socket is never established in the first place.
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (typeof value === "string") headers.set(key, value);
        }

        const session = await auth.api.getSession({ headers });
        if (!session?.user) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          const connection: Connection = { socket: ws, userId: session.user.id };
          register(connection);

          ws.on("close", () => unregister(connection));
          ws.on("error", () => unregister(connection));
          ws.send(JSON.stringify({ type: "connected", userId: session.user.id }));
        });
      } catch (error) {
        console.error("WebSocket upgrade failed:", error);
        socket.destroy();
      }
    })();
  });

  void startPubSub().then(() => {
    onRealtimeEvent(deliver);
  });
}

export function connectedUserCount(): number {
  return byUser.size;
}

export function closeRealtime(): void {
  for (const connection of connections) {
    connection.socket.close();
  }
  connections.clear();
  byUser.clear();
}
