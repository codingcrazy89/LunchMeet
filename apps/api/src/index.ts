import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { assertProductionSafety } from "@lunchmeet/config";
import { createApp } from "./app.js";
import { closeDatabase } from "./db.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { initSentry } from "./lib/sentry.js";
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

// Initialise before anything else, so a failure during startup is reported.
const sentryEnabled = initSentry();

const app = createApp();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(
    {
      port: info.port,
      environment: env.NODE_ENV,
      sentry: sentryEnabled,
      websocket: `ws://localhost:${info.port}/ws`,
    },
    "LunchMeet API started"
  );
});

// Realtime and the rating-prompt scheduler both live in this process, so both
// are visible to local development, tests and error reporting.
attachRealtime(server as unknown as Server);
startScheduler();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
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
