import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { auth } from "./auth.js";
import { env } from "./env.js";
import { ApiError } from "./lib/errors.js";
import { withSession, type AppVariables } from "./middleware/session.js";
import { attendeeRoutes } from "./routes/attendees.js";
import { chatRoutes } from "./routes/chat.js";
import { inviteRoutes } from "./routes/invites.js";
import { lunchRoutes } from "./routes/lunches.js";
import { profileRoutes } from "./routes/profiles.js";
import { ratingRoutes } from "./routes/ratings.js";
import { socialRoutes } from "./routes/social.js";

export function createApp() {
  const app = new Hono<{ Variables: AppVariables }>();

  if (env.LOG_LEVEL === "debug") {
    app.use("*", logger());
  }

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

  app.get("/health", (c) => c.json({ ok: true, environment: env.NODE_ENV }));

  // Better Auth owns everything under /api/auth: sign-in, callbacks, sessions.
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  const v1 = new Hono<{ Variables: AppVariables }>()
    .use("*", withSession)
    .route("/profiles", profileRoutes)
    .route("/lunches", lunchRoutes)
    .route("/lunches", attendeeRoutes)
    .route("/lunches", chatRoutes)
    .route("/lunches", ratingRoutes)
    .route("/", inviteRoutes)
    .route("/", socialRoutes);

  const routes = app.route("/v1", v1);

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

    console.error("Unhandled error:", error);
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
