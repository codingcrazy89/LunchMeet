import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { REPORT_MIN_WORDS } from "@lunchmeet/shared";
import { notifications, profiles, userContacts, userReports } from "@lunchmeet/db";
import { db } from "../db.js";
import { badRequest, notFound } from "../lib/errors.js";
import { currentUser, requireAuth, type AppVariables } from "../middleware/session.js";

const reportSchema = z.object({
  reportedId: z.string().min(1),
  comment: z.string().trim().min(1).max(5000),
});

const contactSchema = z.object({ contactId: z.string().min(1) });

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const socialRoutes = new Hono<{ Variables: AppVariables }>()

  .get("/contacts", requireAuth, async (c) => {
    const user = currentUser(c);
    const rows = await db
      .select({
        userId: profiles.userId,
        name: profiles.name,
        photoKeys: profiles.photoKeys,
        addedAt: userContacts.createdAt,
      })
      .from(userContacts)
      .innerJoin(profiles, eq(profiles.userId, userContacts.contactId))
      .where(eq(userContacts.userId, user.id))
      .orderBy(desc(userContacts.createdAt));

    return c.json({ contacts: rows });
  })

  .post("/contacts", requireAuth, zValidator("json", contactSchema), async (c) => {
    const user = currentUser(c);
    const { contactId } = c.req.valid("json");

    if (contactId === user.id) throw badRequest("You cannot add yourself as a contact.");

    const exists = await db.$count(profiles, eq(profiles.userId, contactId));
    if (exists === 0) throw notFound("That user does not exist.");

    await db
      .insert(userContacts)
      .values({ userId: user.id, contactId })
      .onConflictDoNothing({ target: [userContacts.userId, userContacts.contactId] });

    return c.json({ ok: true }, 201);
  })

  .delete("/contacts/:contactId", requireAuth, async (c) => {
    const user = currentUser(c);
    await db
      .delete(userContacts)
      .where(
        and(eq(userContacts.userId, user.id), eq(userContacts.contactId, c.req.param("contactId")))
      );
    return c.json({ ok: true });
  })

  /**
   * File an abuse report.
   *
   * Reports are write-only through the API: there is no route that returns
   * them, matching v1's `USING (false)` select policy. An administrator reads
   * them directly from the database.
   */
  .post("/reports", requireAuth, zValidator("json", reportSchema), async (c) => {
    const user = currentUser(c);
    const { reportedId, comment } = c.req.valid("json");

    if (reportedId === user.id) throw badRequest("You cannot report yourself.");

    // v1 enforced this only in the modal component.
    if (countWords(comment) < REPORT_MIN_WORDS) {
      throw badRequest(`Please describe what happened in at least ${REPORT_MIN_WORDS} words.`);
    }

    const exists = await db.$count(profiles, eq(profiles.userId, reportedId));
    if (exists === 0) throw notFound("That user does not exist.");

    await db.insert(userReports).values({ reporterId: user.id, reportedId, comment });

    return c.json({ ok: true }, 201);
  })

  .get("/notifications", requireAuth, async (c) => {
    const user = currentUser(c);
    const rows = await db.query.notifications.findMany({
      where: (n, { eq: eqOp }) => eqOp(n.userId, user.id),
      orderBy: (n, { desc: descOp }) => [descOp(n.createdAt)],
      limit: 50,
    });

    const unread = await db.$count(
      notifications,
      and(eq(notifications.userId, user.id), isNull(notifications.readAt))
    );

    return c.json({ notifications: rows, unreadCount: unread });
  })

  .post("/notifications/read", requireAuth, async (c) => {
    const user = currentUser(c);
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return c.json({ ok: true });
  })

  .post("/notifications/:id/read", requireAuth, async (c) => {
    const user = currentUser(c);
    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, c.req.param("id")), eq(notifications.userId, user.id)))
      .returning({ id: notifications.id });

    if (!updated) throw notFound("Notification not found.");
    return c.json({ ok: true });
  })

  /**
   * Aggregate counts for the README badge.
   *
   * Public and unauthenticated by design, so it exposes only counts. No
   * identifying information, and nothing that varies per caller.
   */
  .get("/public/stats", async (c) => {
    const [row] = await db
      .select({
        profiles: sql<number>`(select count(*) from profiles)::int`,
        lunches: sql<number>`(select count(*) from lunches)::int`,
      })
      .from(sql`(select 1) as one`);

    return c.json({
      profiles: row?.profiles ?? 0,
      lunches: row?.lunches ?? 0,
      schemaVersion: 1,
    });
  });
