import postgres from "postgres";
import { env } from "../env.js";

/**
 * Fan-out over Postgres LISTEN/NOTIFY.
 *
 * Chat and notifications at this scale do not justify Redis or Kafka, and
 * Postgres is already running. Using it as the bus means one fewer service to
 * operate and no possibility of the bus and the database disagreeing about
 * whether something happened.
 *
 * NOTIFY payloads are capped at 8000 bytes, so events carry identifiers rather
 * than content; subscribers fetch what they need.
 */

export const CHANNEL = "lunchmeet_events";

export type RealtimeEvent =
  | { type: "message"; lunchId: string; messageId: string; recipients: string[] }
  | { type: "notification"; notificationId: string; recipients: string[] }
  | { type: "lunch_updated"; lunchId: string; recipients: string[] };

type Handler = (event: RealtimeEvent) => void;

/** A dedicated connection: a listening connection cannot run other queries. */
const listener = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });

/** A small pool for publishing, so NOTIFY never blocks on the listener. */
const publisher = postgres(env.DATABASE_URL, { max: 2, onnotice: () => {} });

const handlers = new Set<Handler>();
let started = false;

export async function startPubSub(): Promise<void> {
  if (started) return;
  started = true;

  await listener.listen(CHANNEL, (payload) => {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(payload) as RealtimeEvent;
    } catch {
      console.error("Ignoring malformed realtime payload");
      return;
    }
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        // One bad subscriber must not stop delivery to the others.
        console.error("Realtime handler failed:", error);
      }
    }
  });
}

export function onRealtimeEvent(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export async function publish(event: RealtimeEvent): Promise<void> {
  const payload = JSON.stringify(event);
  if (payload.length > 7000) {
    console.error(`Realtime payload too large (${payload.length} bytes), dropping.`);
    return;
  }
  await publisher.notify(CHANNEL, payload);
}

export async function stopPubSub(): Promise<void> {
  handlers.clear();
  await Promise.all([listener.end({ timeout: 2 }), publisher.end({ timeout: 2 })]);
  started = false;
}
