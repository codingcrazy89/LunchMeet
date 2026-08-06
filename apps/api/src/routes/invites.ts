import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { lunchAttendees, lunchInvites, lunches, notifications, profiles } from "@lunchmeet/db";
import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { currentUser, requireAuth, type AppVariables } from "../middleware/session.js";
import { requireOrganiser, resolveLunchContext } from "../policy/lunch.js";

const inviteSchema = z.object({ email: z.email() });

/**
 * Lunch-scoped invite routes, mounted under /v1/lunches.
 *
 * Kept separate from the caller-scoped routes below so the mounted paths are
 * unambiguous: mounting both at the root produced /v1/:lunchId/invites.
 */
export const lunchInviteRoutes = new Hono<{ Variables: AppVariables }>().post(
  "/:lunchId/invites",
  requireAuth,
  zValidator("json", inviteSchema),
  async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);
    requireOrganiser(context);

    const { email } = c.req.valid("json");

    const [invitee] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .innerJoin(sql`"user"`, sql`"user".id = ${profiles.userId}`)
      .where(sql`"user".email = ${email}`)
      .limit(1);

    if (!invitee) {
      // Deliberately vague: does not confirm whether an account exists.
      return c.json({ ok: true, delivered: false });
    }
    if (invitee.userId === user.id) {
      throw badRequest("You cannot invite yourself.");
    }

    const [created] = await db
      .insert(lunchInvites)
      .values({
        lunchId: context.lunch.id,
        inviterId: user.id,
        inviteeId: invitee.userId,
      })
      .onConflictDoNothing({ target: [lunchInvites.lunchId, lunchInvites.inviteeId] })
      .returning();

    if (!created) throw conflict("That person has already been invited.");

    await db.insert(notifications).values({
      userId: invitee.userId,
      type: "invite",
      title: `${user.name} invited you to lunch`,
      body: context.lunch.restaurantName,
      data: { lunchId: context.lunch.id },
    });

    return c.json({ ok: true, delivered: true }, 201);
  }
);

/** Caller-scoped invite routes, mounted at /v1. */
export const inviteRoutes = new Hono<{ Variables: AppVariables }>()

  /** Invitations addressed to the caller. */
  .get("/invites", requireAuth, async (c) => {
    const user = currentUser(c);

    const rows = await db
      .select({
        id: lunchInvites.id,
        status: lunchInvites.status,
        createdAt: lunchInvites.createdAt,
        lunchId: lunches.id,
        restaurantName: lunches.restaurantName,
        dateTime: lunches.dateTime,
        inviterName: profiles.name,
      })
      .from(lunchInvites)
      .innerJoin(lunches, eq(lunches.id, lunchInvites.lunchId))
      .leftJoin(profiles, eq(profiles.userId, lunchInvites.inviterId))
      .where(and(eq(lunchInvites.inviteeId, user.id), eq(lunchInvites.status, "pending")))
      .orderBy(desc(lunchInvites.createdAt));

    return c.json({ invites: rows });
  })

  .post("/invites/:inviteId/accept", requireAuth, async (c) => {
    const user = currentUser(c);
    const inviteId = c.req.param("inviteId");

    const result = await db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(lunchInvites)
        .where(and(eq(lunchInvites.id, inviteId), eq(lunchInvites.inviteeId, user.id)))
        .limit(1);

      if (!invite) throw notFound("Invitation not found.");
      if (invite.status !== "pending") throw conflict("This invitation has already been answered.");

      await tx
        .update(lunchInvites)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(lunchInvites.id, inviteId));

      // Accepting an invitation confirms a seat directly: the organiser has
      // already vouched for this person by inviting them.
      const [attendee] = await tx
        .insert(lunchAttendees)
        .values({ lunchId: invite.lunchId, userId: user.id, status: "accepted" })
        .onConflictDoUpdate({
          target: [lunchAttendees.lunchId, lunchAttendees.userId],
          set: { status: "accepted", updatedAt: new Date() },
        })
        .returning();

      return attendee;
    });

    return c.json({ attendee: result });
  })

  .post("/invites/:inviteId/decline", requireAuth, async (c) => {
    const user = currentUser(c);

    const [updated] = await db
      .update(lunchInvites)
      .set({ status: "declined", updatedAt: new Date() })
      .where(
        and(
          eq(lunchInvites.id, c.req.param("inviteId")),
          eq(lunchInvites.inviteeId, user.id),
          eq(lunchInvites.status, "pending")
        )
      )
      .returning({ id: lunchInvites.id });

    if (!updated) throw notFound("Invitation not found.");
    return c.json({ ok: true });
  });
