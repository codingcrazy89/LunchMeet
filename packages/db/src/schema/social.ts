import { relations, sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lunches } from "./lunches.js";
import { createdAt, updatedAt } from "./_shared.js";

/**
 * Peer ratings after a lunch.
 *
 * Deliberately readable only by the rater: a user cannot see ratings they have
 * received. That was v1's behaviour too and it is worth preserving, since
 * visible peer ratings turn a safety mechanism into a popularity contest.
 */
export const userRatings = pgTable(
  "user_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lunchId: uuid("lunch_id")
      .notNull()
      .references(() => lunches.id, { onDelete: "cascade" }),
    raterId: text("rater_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ratedId: text("rated_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("user_ratings_rater_rated_lunch_key").on(
      table.raterId,
      table.ratedId,
      table.lunchId
    ),
    index("user_ratings_rated_id_idx").on(table.ratedId),
    check("user_ratings_rating_range", sql`${table.rating} between 1 and 5`),
    check("user_ratings_no_self", sql`${table.raterId} <> ${table.ratedId}`),
  ]
);

/** A directed "I know this person" edge, used to offer private invites. */
export const userContacts = pgTable(
  "user_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("user_contacts_user_contact_key").on(table.userId, table.contactId),
    check("user_contacts_no_self", sql`${table.userId} <> ${table.contactId}`),
  ]
);

/** Abuse reports. Readable only by an administrator, never through the API. */
export const userReports = pgTable(
  "user_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reportedId: text("reported_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    comment: text("comment").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("user_reports_reported_id_idx").on(table.reportedId),
    check("user_reports_no_self", sql`${table.reporterId} <> ${table.reportedId}`),
  ]
);

export const userRatingsRelations = relations(userRatings, ({ one }) => ({
  lunch: one(lunches, { fields: [userRatings.lunchId], references: [lunches.id] }),
  rater: one(user, { fields: [userRatings.raterId], references: [user.id], relationName: "rater" }),
  rated: one(user, { fields: [userRatings.ratedId], references: [user.id], relationName: "rated" }),
}));
