import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { assertProductionSafety } from "@lunchmeet/config";
import { createApp } from "./app.js";
import { closeDatabase } from "./db.js";
import { env } from "./env.js";
import { attachRealtime, closeRealtime } from "./realtime/hub.js";
import { stopPubSub } from "./realtime/pubsub.js";
import { startScheduler, stopScheduler } from "./scheduler/index.js";

/**
 * Refuse to start a production process carrying development defaults.
 *
 * Cheaper to fail here than to discover in production that sessions are signed
 * with a secret published in a public repository.
 */
const problems = assertProductionSafety(env);
if (problems.length > 0) {
  console.error("\n  Refusing to start in production:\n");
  for (const problem of problems) console.error(`    - ${problem}`);
  console.error("");
  process.exit(1);
}

const app = createApp();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`LunchMeet API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
  console.log(`WebSocket endpoint at ws://localhost:${info.port}/ws`);
});

// Realtime and the rating-prompt scheduler both live in this process, so both
// are visible to local development, tests and error reporting.
attachRealtime(server as unknown as Server);
startScheduler();

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down.`);
  stopScheduler();
  closeRealtime();
  server.close();
  await stopPubSub().catch(() => {});
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export type { AppType } from "./app.js";
