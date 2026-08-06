import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { chatRooms, messages, notifications, profiles } from "@lunchmeet/db";
import { db } from "../db.js";
import { currentUser, requireAuth, type AppVariables } from "../middleware/session.js";
import {
  canAccessChat,
  requireChatAccess,
  resolveLunchContext,
  type LunchContext,
} from "../policy/lunch.js";

const sendSchema = z.object({ body: z.string().trim().min(1).max(4000) });
const historySchema = z.object({
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Gets or creates the room for a lunch, having already checked access.
 *
 * v1's equivalent was a SECURITY DEFINER function with no caller check at all,
 * sitting behind an INSERT policy of `WITH CHECK (true)`.
 */
async function roomForLunch(context: LunchContext): Promise<string> {
  const [existing] = await db
    .select({ id: chatRooms.id })
    .from(chatRooms)
    .where(eq(chatRooms.lunchId, context.lunch.id))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(chatRooms)
    .values({ lunchId: context.lunch.id })
    .onConflictDoNothing({ target: chatRooms.lunchId })
    .returning({ id: chatRooms.id });

  if (created) return created.id;

  // Lost a race; the other insert won.
  const [row] = await db
    .select({ id: chatRooms.id })
    .from(chatRooms)
    .where(eq(chatRooms.lunchId, context.lunch.id))
    .limit(1);
  return row!.id;
}

export const chatRoutes = new Hono<{ Variables: AppVariables }>()

  .get("/:lunchId/messages", requireAuth, zValidator("query", historySchema), async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);
    requireChatAccess(context);

    const { before, limit } = c.req.valid("query");
    const roomId = await roomForLunch(context);

    const rows = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        body: messages.body,
        createdAt: messages.createdAt,
        senderName: profiles.name,
        senderPhotoKeys: profiles.photoKeys,
      })
      .from(messages)
      .leftJoin(profiles, eq(profiles.userId, messages.senderId))
      .where(
        and(
          eq(messages.chatRoomId, roomId),
          ...(before ? [lt(messages.createdAt, before)] : [])
        )
      )
      .orderBy(asc(messages.createdAt))
      .limit(limit);

    return c.json({ roomId, messages: rows });
  })

  .post("/:lunchId/messages", requireAuth, zValidator("json", sendSchema), async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);
    requireChatAccess(context);

    const { body } = c.req.valid("json");
    const roomId = await roomForLunch(context);

    const created = await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(messages)
        .values({ chatRoomId: roomId, senderId: user.id, body })
        .returning();

      // Notify every other participant. Written in the same transaction as the
      // message, so a notification failure fails the send rather than silently
      // losing it, which a database trigger could not guarantee.
      const participants = await tx.query.lunchAttendees.findMany({
        where: (attendees, { and: andOp, eq: eqOp }) =>
          andOp(eqOp(attendees.lunchId, context.lunch.id), eqOp(attendees.status, "accepted")),
        columns: { userId: true },
      });

      const recipients = new Set<string>([
        context.lunch.hostId,
        ...(context.lunch.coHostId ? [context.lunch.coHostId] : []),
        ...participants.map((p) => p.userId),
      ]);
      recipients.delete(user.id);

      if (recipients.size > 0) {
        await tx.insert(notifications).values(
          [...recipients].map((recipientId) => ({
            userId: recipientId,
            type: "new_message" as const,
            title: `${user.name} sent a message`,
            body: body.slice(0, 120),
            data: { lunchId: context.lunch.id },
          }))
        );
      }

      return message;
    });

    return c.json({ message: created }, 201);
  })

  /** Whether the caller may open this chat, for UI gating. */
  .get("/:lunchId/access", requireAuth, async (c) => {
    const user = currentUser(c);
    const context = await resolveLunchContext(c.req.param("lunchId"), user.id);
    return c.json({ canAccess: canAccessChat(context), role: context.role });
  });
