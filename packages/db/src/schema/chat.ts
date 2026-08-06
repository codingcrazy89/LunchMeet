import { relations } from "drizzle-orm";
import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lunches } from "./lunches.js";
import { createdAt, updatedAt } from "./_shared.js";

/**
 * One chat room per lunch, created on demand.
 *
 * v1 allowed any authenticated user to insert a chat room (`WITH CHECK (true)`)
 * and its `get_or_create_chat_room` function performed no caller check at all.
 * Creation now goes through the API's policy layer, which verifies the caller
 * is a participant first.
 */
export const chatRooms = pgTable(
  "chat_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lunchId: uuid("lunch_id")
      .notNull()
      .references(() => lunches.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("chat_rooms_lunch_id_key").on(table.lunchId)]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // v1 had no foreign key here at all, so orphaned messages were possible.
    chatRoomId: uuid("chat_room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("messages_room_created_idx").on(table.chatRoomId, table.createdAt),
  ]
);

export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
  lunch: one(lunches, { fields: [chatRooms.lunchId], references: [lunches.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(chatRooms, { fields: [messages.chatRoomId], references: [chatRooms.id] }),
  sender: one(user, { fields: [messages.senderId], references: [user.id] }),
}));
