import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { lunchAttendees, lunches, profiles } from "@lunchmeet/db";
import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { currentUser, requireAuth, type AppVariables } from "../middleware/session.js";
import { requireHost, requireOrganiser, resolveLunchContext } from "../policy/lunch.js";
import { distanceMiles, visibleToViewer, withinRadius } from "../policy/visibility.js";

const createLunchSchema = z.object({
  restaurantName: z.string().min(1).max(200),
  restaurantAddress: z.string().max(500).optional(),
  placeId: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  dateTime: z.coerce.date(),
  seats: z.number().int().min(1).max(50),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().default(true),
  visibilityGender: z.array(z.string().max(50)).nullish(),
  visibilityLookingFor: z.array(z.string().max(50)).nullish(),
  coHostEmail: z.email().optional(),
});

const listQuerySchema = z.object({
  scope: z.enum(["upcoming", "mine", "hosting"]).default("upcoming"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMetres: z.coerce.number().int().min(100).max(100_000).default(8_000),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Shape returned to clients. Deliberately excludes nothing the viewer may not see. */
const lunchColumns = {
  id: lunches.id,
  hostId: lunches.hostId,
  coHostId: lunches.coHostId,
  placeId: lunches.placeId,
  restaurantName: lunches.restaurantName,
  restaurantAddress: lunches.restaurantAddress,
  latitude: lunches.latitude,
  longitude: lunches.longitude,
  dateTime: lunches.dateTime,
  seats: lunches.seats,
  description: lunches.description,
  isPublic: lunches.isPublic,
  createdAt: lunches.createdAt,
};

export const lunchRoutes = new Hono<{ Variables: AppVariables }>()

  /** Upcoming lunches the caller is allowed to see. */
  .get("/", requireAuth, zValidator("query", listQuerySchema), async (c) => {
    const user = currentUser(c);
    const { scope, limit } = c.req.valid("query");

    const scopeCondition =
      scope === "hosting"
        ? sql`(${lunches.hostId} = ${user.id} or ${lunches.coHostId} = ${user.id})`
        : scope === "mine"
          ? sql`exists (
              select 1 from lunch_attendees a
              where a.lunch_id = ${lunches.id} and a.user_id = ${user.id}
                and a.status = 'accepted'
            )`
          : undefined;

    const rows = await db
      .select(lunchColumns)
      .from(lunches)
      .where(
        and(
          visibleToViewer(user.id),
          gte(lunches.dateTime, new Date()),
          ...(scopeCondition ? [scopeCondition] : [])
        )
      )
      .orderBy(asc(lunches.dateTime))
      .limit(limit);

    return c.json({ lunches: rows });
  })

  /**
   * Nearby search, using the earthdistance GiST index.
   *
   * v1 had no server-side geo at all: it fetched every lunch and drew markers.
   */
  .get("/nearby", requireAuth, zValidator("query", nearbyQuerySchema), async (c) => {
    const user = currentUser(c);
    const { latitude, longitude, radiusMetres, limit } = c.req.valid("query");

    const distance = distanceMiles(latitude, longitude);

    const rows = await db
      .select({ ...lunchColumns, distanceMiles: distance })
      .from(lunches)
      .where(
        and(
          visibleToViewer(user.id),
          gte(lunches.dateTime, new Date()),
          withinRadius(latitude, longitude, radiusMetres)
        )
      )
      .orderBy(asc(distance))
      .limit(limit);

    return c.json({ lunches: rows });
  })

  /** A single lunch with its attendees. 404 if the caller may not see it. */
  .get("/:id", requireAuth, async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("id"), user.id);

    const attendees = await db
      .select({
        id: lunchAttendees.id,
        userId: lunchAttendees.userId,
        status: lunchAttendees.status,
        name: profiles.name,
        age: profiles.age,
        photoKeys: profiles.photoKeys,
      })
      .from(lunchAttendees)
      .leftJoin(profiles, eq(profiles.userId, lunchAttendees.userId))
      .where(eq(lunchAttendees.lunchId, context.lunch.id))
      .orderBy(desc(lunchAttendees.createdAt));

    // Pending requests are management information: only organisers see them.
    const visibleAttendees =
      context.role === "host" || context.role === "co_host"
        ? attendees
        : attendees.filter((a) => a.status === "accepted");

    return c.json({
      lunch: context.lunch,
      role: context.role,
      attendeeStatus: context.attendeeStatus,
      attendees: visibleAttendees,
    });
  })

  .post("/", requireAuth, zValidator("json", createLunchSchema), async (c) => {
    const user = currentUser(c);
    const input = c.req.valid("json");

    if (input.dateTime.getTime() < Date.now()) {
      throw badRequest("A lunch cannot be scheduled in the past.");
    }

    let coHostId: string | null = null;
    if (input.coHostEmail) {
      const [coHost] = await db
        .select({ userId: profiles.userId })
        .from(profiles)
        .innerJoin(sql`"user"`, sql`"user".id = ${profiles.userId}`)
        .where(sql`"user".email = ${input.coHostEmail}`)
        .limit(1);

      if (!coHost) {
        throw notFound("No LunchMeet account found for that co-host email.");
      }
      if (coHost.userId === user.id) {
        throw badRequest("You cannot co-host your own lunch.");
      }
      coHostId = coHost.userId;
    }

    const [created] = await db
      .insert(lunches)
      .values({
        hostId: user.id,
        coHostId,
        placeId: input.placeId,
        restaurantName: input.restaurantName,
        restaurantAddress: input.restaurantAddress,
        latitude: input.latitude,
        longitude: input.longitude,
        dateTime: input.dateTime,
        seats: input.seats,
        description: input.description,
        isPublic: input.isPublic,
        visibilityGender: input.visibilityGender ?? null,
        visibilityLookingFor: input.visibilityLookingFor ?? null,
      })
      .returning();

    return c.json({ lunch: created }, 201);
  })

  .patch(
    "/:id",
    requireAuth,
    zValidator("json", createLunchSchema.partial().omit({ coHostEmail: true })),
    async (c) => {
      const user = currentUser(c);
      const context = await resolveLunchContext(c.req.param("id"), user.id);
      requireOrganiser(context);

      const input = c.req.valid("json");

      const acceptedCount = await db.$count(
        lunchAttendees,
        and(eq(lunchAttendees.lunchId, context.lunch.id), eq(lunchAttendees.status, "accepted"))
      );

      if (input.seats !== undefined && input.seats < acceptedCount) {
        throw conflict(
          `Cannot reduce seats to ${input.seats}: ${acceptedCount} attendees are already confirmed.`
        );
      }

      const [updated] = await db
        .update(lunches)
        .set({
          ...input,
          visibilityGender: input.visibilityGender ?? undefined,
          visibilityLookingFor: input.visibilityLookingFor ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(lunches.id, context.lunch.id))
        .returning();

      return c.json({ lunch: updated });
    }
  )

  /** Closing a lunch removes it. Host only: a co-host can manage but not destroy. */
  .delete("/:id", requireAuth, async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("id"), user.id);
    requireHost(context);

    await db.delete(lunches).where(eq(lunches.id, context.lunch.id));
    return c.json({ ok: true });
  });
