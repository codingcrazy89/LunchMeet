import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { auth } from "./auth.js";
import { env } from "./env.js";
import { ApiError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { captureError } from "./lib/sentry.js";
import { healthRoutes } from "./routes/health.js";
import { withSession, type AppVariables } from "./middleware/session.js";
import { attendeeRoutes } from "./routes/attendees.js";
import { chatRoutes } from "./routes/chat.js";
import { inviteRoutes, lunchInviteRoutes } from "./routes/invites.js";
import { lunchRoutes } from "./routes/lunches.js";
import { photoRoutes } from "./routes/photos.js";
import { profileRoutes } from "./routes/profiles.js";
import { ratingRoutes } from "./routes/ratings.js";
import { socialRoutes } from "./routes/social.js";

export function createApp() {
  const app = new Hono<{ Variables: AppVariables }>();

  /**
   * One structured line per request. Deliberately records method, path,
   * status and duration and nothing else: request headers carry the session
   * cookie, and the logger redacts them if they ever appear.
   */
  app.use("*", async (c, next) => {
    const startedAt = performance.now();
    await next();
    logger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - startedAt),
      },
      "request"
    );
  });

  /**
   * The mobile app is not a browser origin, but the Expo web build is.
   * Credentials are required so Better Auth's session cookie is sent.
   */
  app.use(
    "*",
    cors({
      origin: [env.EXPO_PUBLIC_API_URL, "http://localhost:8081", "http://localhost:19006"],
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  app.route("/health", healthRoutes);

  // Better Auth owns everything under /api/auth: sign-in, callbacks, sessions.
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  const v2 = new Hono<{ Variables: AppVariables }>()
    .use("*", withSession)
    .route("/profiles", profileRoutes)
    .route("/photos", photoRoutes)
    .route("/lunches", lunchRoutes)
    .route("/lunches", attendeeRoutes)
    .route("/lunches", chatRoutes)
    .route("/lunches", ratingRoutes)
    .route("/lunches", lunchInviteRoutes)
    .route("/", inviteRoutes)
    .route("/", socialRoutes);

  const routes = app.route("/v2", v2);

  /**
   * Only ApiError detail reaches the client. Anything else becomes a bare 500,
   * so an unexpected database failure cannot leak query text or schema.
   */
  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status);
    }
    if (error instanceof ZodError) {
      return c.json(
        { error: { code: "validation_failed", message: "Request validation failed." } },
        400
      );
    }
    if (error instanceof HTTPException) {
      return c.json({ error: { code: "http_error", message: error.message } }, error.status);
    }

    logger.error({ err: error, path: c.req.path }, "unhandled error");
    captureError(error, { path: c.req.path, method: c.req.method });
    return c.json(
      { error: { code: "internal_error", message: "Something went wrong." } },
      500
    );
  });

  app.notFound((c) =>
    c.json({ error: { code: "not_found", message: "No such endpoint." } }, 404)
  );

  return routes;
}

/** Consumed by the mobile client for end-to-end typed requests. */
export type AppType = ReturnType<typeof createApp>;
