import { zValidator } from "@hono/zod-validator";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  RATING_COMMENT_REQUIRED_BELOW,
  RATING_MAX,
  RATING_MIN,
  SUSPENSION_MIN_LUNCHES,
  SUSPENSION_RATING_THRESHOLD,
} from "@lunchmeet/shared";
import { lunchAttendees, profiles, userRatings } from "@lunchmeet/db";
import { db } from "../db.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { currentUser, requireAuth, type AppVariables } from "../middleware/session.js";
import { isConfirmedParticipant, resolveLunchContext } from "../policy/lunch.js";

const submitSchema = z.object({
  ratedId: z.string().min(1),
  rating: z.number().int().min(RATING_MIN).max(RATING_MAX),
  comment: z.string().trim().max(2000).optional(),
});

/**
 * Evaluates whether a user should be suspended after receiving a rating.
 *
 * v1 ran this as an AFTER INSERT trigger calling a SECURITY DEFINER function,
 * where it was invisible to tests and to error reporting. Here it is ordinary
 * code in the same transaction as the rating that triggers it.
 */
async function evaluateSuspension(tx: typeof db, ratedId: string): Promise<void> {
  const [stats] = await tx
    .select({
      lunchCount: sql<number>`count(distinct ${userRatings.lunchId})::int`,
      average: sql<number>`avg(${userRatings.rating})::float`,
    })
    .from(userRatings)
    .where(eq(userRatings.ratedId, ratedId));

  if (!stats) return;
  if (stats.lunchCount < SUSPENSION_MIN_LUNCHES) return;
  if (stats.average > SUSPENSION_RATING_THRESHOLD) return;

  await tx
    .update(profiles)
    .set({
      suspended: true,
      flaggedForInvestigation: true,
      suspendedAt: new Date(),
      suspendedReason: `Average rating ${stats.average.toFixed(2)} across ${stats.lunchCount} lunches.`,
    })
    .where(eq(profiles.userId, ratedId));
}

export const ratingRoutes = new Hono<{ Variables: AppVariables }>()

  /** Who the caller still has to rate for a given lunch. */
  .get("/:lunchId/ratings/pending", requireAuth, async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);

    if (!isConfirmedParticipant(context)) {
      throw forbidden("Only confirmed participants can rate this lunch.");
    }

    const participants = await db
      .select({ userId: lunchAttendees.userId, name: profiles.name, photoKeys: profiles.photoKeys })
      .from(lunchAttendees)
      .leftJoin(profiles, eq(profiles.userId, lunchAttendees.userId))
      .where(
        and(eq(lunchAttendees.lunchId, context.lunch.id), eq(lunchAttendees.status, "accepted"))
      );

    const already = await db
      .select({ ratedId: userRatings.ratedId })
      .from(userRatings)
      .where(and(eq(userRatings.lunchId, context.lunch.id), eq(userRatings.raterId, user.id)));

    const rated = new Set(already.map((r) => r.ratedId));

    const pending = participants.filter((p) => p.userId !== user.id && !rated.has(p.userId));

    return c.json({ pending, lunchHasEnded: context.lunch.dateTime.getTime() < Date.now() });
  })

  .post("/:lunchId/ratings", requireAuth, zValidator("json", submitSchema), async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);
    const { ratedId, rating, comment } = c.req.valid("json");

    if (!isConfirmedParticipant(context)) {
      throw forbidden("Only confirmed participants can rate this lunch.");
    }
    if (ratedId === user.id) {
      throw badRequest("You cannot rate yourself.");
    }
    if (context.lunch.dateTime.getTime() > Date.now()) {
      throw badRequest("You can only rate attendees after the lunch has happened.");
    }
    // Enforced server-side; v1 checked this only in the UI.
    if (rating < RATING_COMMENT_REQUIRED_BELOW && !comment) {
      throw badRequest(
        `A comment is required when rating below ${RATING_COMMENT_REQUIRED_BELOW} stars.`
      );
    }

    const ratedIsParticipant = await db.$count(
      lunchAttendees,
      and(
        eq(lunchAttendees.lunchId, context.lunch.id),
        eq(lunchAttendees.userId, ratedId),
        eq(lunchAttendees.status, "accepted")
      )
    );
    const ratedIsOrganiser = ratedId === context.lunch.hostId || ratedId === context.lunch.coHostId;

    if (ratedIsParticipant === 0 && !ratedIsOrganiser) {
      throw badRequest("That person did not attend this lunch.");
    }

    const saved = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(userRatings)
        .values({ lunchId: context.lunch.id, raterId: user.id, ratedId, rating, comment })
        .onConflictDoUpdate({
          target: [userRatings.raterId, userRatings.ratedId, userRatings.lunchId],
          set: { rating, comment, updatedAt: new Date() },
        })
        .returning();

      await evaluateSuspension(tx as unknown as typeof db, ratedId);
      return row;
    });

    return c.json({ rating: saved }, 201);
  });
