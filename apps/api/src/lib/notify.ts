import type { NotificationType } from "@lunchmeet/shared";
import { notifications } from "@lunchmeet/db";
import { db } from "../db.js";
import { publish } from "../realtime/pubsub.js";
import { sendPush } from "./push.js";

/**
 * The one way notifications are created.
 *
 * Writes the row, fans it out to connected sockets, and sends a push to
 * everyone else. v1 spread this across seven database triggers, so it was
 * invisible to tests, invisible to error reporting, and impossible to extend
 * with push without writing more SQL.
 */

export interface NotifyInput {
  recipients: string[];
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Excluded from delivery; usually the person who caused the event. */
  except?: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  const recipients = [...new Set(input.recipients)].filter(
    (id) => Boolean(id) && id !== input.except
  );
  if (recipients.length === 0) return;

  const rows = await db
    .insert(notifications)
    .values(
      recipients.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
      }))
    )
    .returning({ id: notifications.id });

  // Delivery is best-effort and deliberately after the write: a socket or push
  // failure must not lose the notification, which is already durable.
  const firstId = rows[0]?.id;
  if (firstId) {
    await publish({ type: "notification", notificationId: firstId, recipients }).catch((error) => {
      console.error("Realtime publish failed:", error);
    });
  }

  await sendPush({
    userIds: recipients,
    title: input.title,
    body: input.body,
    data: input.data,
  });
}
