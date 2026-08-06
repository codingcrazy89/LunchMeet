import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { profiles } from "@lunchmeet/db";
import { auth } from "../auth.js";
import { db } from "../db.js";
import { suspended, unauthorized } from "../lib/errors.js";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export type AppVariables = {
  user: SessionUser | null;
};

/**
 * Resolves the Better Auth session onto the request context.
 *
 * Suspension is enforced here rather than in the client. v1 checked
 * `profiles.suspended` in AuthContext and signed the user out in the app, which
 * a modified client could simply skip; the API still answered every request.
 */
export const withSession = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    c.set("user", null);
    return next();
  }

  const [profile] = await db
    .select({ suspended: profiles.suspended })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  if (profile?.suspended) {
    throw suspended();
  }

  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  return next();
});

/** Rejects anonymous callers. Use on every route that is not deliberately public. */
export const requireAuth = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  if (!c.get("user")) {
    throw unauthorized();
  }
  return next();
});

/** Reads the authenticated user, asserting presence. Only valid after requireAuth. */
export function currentUser(c: { get: (key: "user") => SessionUser | null }): SessionUser {
  const user = c.get("user");
  if (!user) {
    throw unauthorized();
  }
  return user;
}
