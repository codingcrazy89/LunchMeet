import { relations, sql } from "drizzle-orm";
import { index, jsonb, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lunchmeet, createdAt, tstz } from "./_shared.js";

export const notificationType = lunchmeet.enum("notification_type", [
  "invite",
  "join_request",
  "cohost_added",
  "new_message",
  "request_accepted",
  "rate_attendees",
  "user_report",
]);

/**
 * In-app notifications. Rows are written by the API, never by the client.
 *
 * In v1 these were produced by seven database triggers, invisible to tests and
 * to error reporting. They are now written in the same transaction as the
 * action that causes them, so a failure to notify fails the action loudly.
 */
export const notifications = lunchmeet.table(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Navigation payload, e.g. { lunchId } so a tap can deep-link. */
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    readAt: tstz("read_at"),
    createdAt: createdAt(),
  },
  (table) => [
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    index("notifications_user_unread_idx")
      .on(table.userId)
      .where(sql`${table.readAt} is null`),
  ]
);

/** Expo push tokens, one row per device per user. */
export const pushTokens = lunchmeet.table(
  "push_tokens",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: text("platform"),
    createdAt: createdAt(),
  },
  (table) => [index("push_tokens_user_id_idx").on(table.userId)]
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, { fields: [notifications.userId], references: [user.id] }),
}));
