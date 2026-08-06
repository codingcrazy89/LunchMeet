import { sql as drizzleSql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db.js";
import { env } from "../env.js";
import { connectedUserCount } from "../realtime/hub.js";
import { schedulerStatus } from "../scheduler/index.js";
import { storage } from "../storage/index.js";

/**
 * Health endpoints.
 *
 * `/health` is a liveness probe: cheap, no dependencies, safe to hit often.
 * `/health/ready` actually exercises the dependencies, so a deploy that cannot
 * reach Postgres fails its readiness check instead of serving errors.
 *
 * v1's nearest equivalent was a 404 handler on the Places proxy.
 */
export const healthRoutes = new Hono()

  .get("/", (c) => c.json({ ok: true, environment: env.NODE_ENV }))

  .get("/ready", async (c) => {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await db.execute(drizzleSql`select 1`);
      checks.database = { ok: true };
    } catch (error) {
      checks.database = {
        ok: false,
        detail: error instanceof Error ? error.message : "unreachable",
      };
    }

    try {
      // Probing a key that will not exist still proves the round-trip works.
      await storage().exists("__healthcheck__");
      checks.storage = { ok: true };
    } catch (error) {
      checks.storage = {
        ok: false,
        detail: error instanceof Error ? error.message : "unreachable",
      };
    }

    const scheduler = schedulerStatus();
    checks.scheduler = {
      ok: scheduler.enabled,
      detail: scheduler.enabled ? undefined : "not started",
    };

    const ready = Object.values(checks).every((check) => check.ok);

    return c.json(
      {
        ready,
        environment: env.NODE_ENV,
        realtimeConnections: connectedUserCount(),
        checks,
      },
      ready ? 200 : 503
    );
  });
