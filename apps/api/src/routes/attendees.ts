import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { lunchAttendees } from "@lunchmeet/db";
import { db } from "../db.js";
import { notify } from "../lib/notify.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { currentUser, requireAuth, type AppVariables } from "../middleware/session.js";
import { requireOrganiser, resolveLunchContext } from "../policy/lunch.js";

/**
 * Join requests and their approval.
 *
 * Seat accounting happens inside a transaction that re-counts confirmed
 * attendees. v1 decremented a `seats` counter in a SECURITY DEFINER function
 * with no locking, so two hosts accepting simultaneously could oversell a lunch
 * and the counter drifted permanently out of step with reality.
 */
export const attendeeRoutes = new Hono<{ Variables: AppVariables }>()

  /** Ask to join. Creates a pending row and notifies the organisers. */
  .post("/:lunchId/attendees", requireAuth, async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);

    if (context.role === "host" || context.role === "co_host") {
      throw badRequest("You are already hosting this lunch.");
    }
    if (context.attendeeStatus) {
      throw conflict("You have already requested to join this lunch.");
    }
    if (context.lunch.dateTime.getTime() < Date.now()) {
      throw badRequest("This lunch has already happened.");
    }

    const created = await db.transaction(async (tx) => {
      const confirmed = await tx.$count(
        lunchAttendees,
        and(eq(lunchAttendees.lunchId, context.lunch.id), eq(lunchAttendees.status, "accepted"))
      );
      if (confirmed >= context.lunch.seats) {
        throw conflict("This lunch is full.");
      }

      const [row] = await tx
        .insert(lunchAttendees)
        .values({ lunchId: context.lunch.id, userId: user.id, status: "pending" })
        .returning();

      return row;
    });

    await notify({
      recipients: [context.lunch.hostId, context.lunch.coHostId].filter(
        (id): id is string => Boolean(id)
      ),
      type: "join_request",
      title: `${user.name} asked to join`,
      body: context.lunch.restaurantName,
      data: { lunchId: context.lunch.id },
    });

    return c.json({ attendee: created }, 201);
  })

  /** Approve a pending request. Host or co-host only. */
  .post("/:lunchId/attendees/:attendeeId/accept", requireAuth, async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);
    requireOrganiser(context);

    const attendeeId = c.req.param("attendeeId");

    const updated = await db.transaction(async (tx) => {
      // Lock the lunch row so concurrent approvals cannot both see a free seat.
      await tx.execute(sql`select 1 from lunches where id = ${context.lunch.id} for update`);

      const [attendee] = await tx
        .select()
        .from(lunchAttendees)
        .where(
          and(eq(lunchAttendees.id, attendeeId), eq(lunchAttendees.lunchId, context.lunch.id))
        )
        .limit(1);

      if (!attendee) throw notFound("Request not found.");
      if (attendee.status === "accepted") return { row: attendee, requesterId: attendee.userId };

      const confirmed = await tx.$count(
        lunchAttendees,
        and(eq(lunchAttendees.lunchId, context.lunch.id), eq(lunchAttendees.status, "accepted"))
      );
      if (confirmed >= context.lunch.seats) {
        throw conflict("This lunch is full.");
      }

      const [row] = await tx
        .update(lunchAttendees)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(lunchAttendees.id, attendeeId))
        .returning();

      return { row, requesterId: attendee.userId };
    });

    await notify({
      recipients: [updated.requesterId],
      type: "request_accepted",
      title: "Your request was accepted",
      body: context.lunch.restaurantName,
      data: { lunchId: context.lunch.id },
    });

    return c.json({ attendee: updated.row });
  })

  .post("/:lunchId/attendees/:attendeeId/deny", requireAuth, async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);
    requireOrganiser(context);

    const deleted = await db
      .delete(lunchAttendees)
      .where(
        and(
          eq(lunchAttendees.id, c.req.param("attendeeId")),
          eq(lunchAttendees.lunchId, context.lunch.id)
        )
      )
      .returning({ id: lunchAttendees.id });

    if (deleted.length === 0) throw notFound("Request not found.");
    return c.json({ ok: true });
  })

  /** Withdraw from a lunch, freeing the seat. */
  .delete("/:lunchId/attendees/me", requireAuth, async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);

    if (context.role === "host") {
      throw forbidden("The host cannot leave. Close the lunch instead.");
    }
    if (!context.attendeeStatus) {
      throw notFound("You are not part of this lunch.");
    }

    await db
      .delete(lunchAttendees)
      .where(
        and(eq(lunchAttendees.lunchId, context.lunch.id), eq(lunchAttendees.userId, user.id))
      );

    return c.json({ ok: true });
  });
