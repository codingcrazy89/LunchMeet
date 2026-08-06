import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lunchmeet, createdAt, tstz, updatedAt } from "./_shared.js";

export const attendeeStatus = lunchmeet.enum("attendee_status", ["pending", "accepted", "denied"]);
export const inviteStatus = lunchmeet.enum("invite_status", ["pending", "accepted", "declined"]);

/**
 * The aggregate root. Nearly every other entity hangs off a lunch, and the
 * lifecycle (create, request, accept, chat, rate) drives the whole application.
 */
export const lunches = lunchmeet.table(
  "lunches",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    hostId: uuid("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    coHostId: uuid("co_host_id").references(() => user.id, { onDelete: "set null" }),

    // Venue, as chosen from Google Places.
    placeId: text("place_id"),
    restaurantName: text("restaurant_name").notNull(),
    restaurantAddress: text("restaurant_address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),

    dateTime: tstz("date_time").notNull(),
    seats: integer("seats").notNull(),
    description: text("description"),

    /**
     * Private lunches are invite-only.
     *
     * In v1 this was filtered in client JavaScript after the server had already
     * sent every row. Here it is a server-side query predicate; see the
     * visibility helpers in the API's policy layer.
     */
    isPublic: boolean("is_public").notNull().default(true),

    /** Null means no restriction. Matched against the viewer's profile. */
    visibilityGender: text("visibility_gender").array(),
    visibilityLookingFor: text("visibility_looking_for").array(),

    /** Set when the post-lunch rating prompt has been sent, so it sends once. */
    ratingPromptSentAt: tstz("rating_prompt_sent_at"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("lunches_host_id_idx").on(table.hostId),
    index("lunches_co_host_id_idx").on(table.coHostId),
    index("lunches_date_time_idx").on(table.dateTime),
    index("lunches_is_public_idx").on(table.isPublic),
    // Supports the rating-prompt sweep without scanning the table.
    index("lunches_rating_prompt_pending_idx")
      .on(table.dateTime)
      .where(sql`${table.ratingPromptSentAt} is null`),
    // earthdistance GiST index backing nearby-lunch search.
    index("lunches_earth_idx").using(
      "gist",
      sql`ll_to_earth(${table.latitude}, ${table.longitude})`
    ),
  ]
);

/** Join requests and confirmed seats. One row per user per lunch. */
export const lunchAttendees = lunchmeet.table(
  "lunch_attendees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lunchId: uuid("lunch_id")
      .notNull()
      .references(() => lunches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: attendeeStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // v1 allowed duplicate join requests for the same lunch.
    uniqueIndex("lunch_attendees_lunch_user_key").on(table.lunchId, table.userId),
    index("lunch_attendees_user_id_idx").on(table.userId),
    index("lunch_attendees_lunch_status_idx").on(table.lunchId, table.status),
  ]
);

/** Direct invitations, which are the only way into a private lunch. */
export const lunchInvites = lunchmeet.table(
  "lunch_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lunchId: uuid("lunch_id")
      .notNull()
      .references(() => lunches.id, { onDelete: "cascade" }),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    inviteeId: uuid("invitee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: inviteStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("lunch_invites_lunch_invitee_key").on(table.lunchId, table.inviteeId),
    index("lunch_invites_invitee_idx").on(table.inviteeId),
  ]
);

export const lunchesRelations = relations(lunches, ({ one, many }) => ({
  host: one(user, { fields: [lunches.hostId], references: [user.id], relationName: "host" }),
  coHost: one(user, { fields: [lunches.coHostId], references: [user.id], relationName: "coHost" }),
  attendees: many(lunchAttendees),
  invites: many(lunchInvites),
}));

export const lunchAttendeesRelations = relations(lunchAttendees, ({ one }) => ({
  lunch: one(lunches, { fields: [lunchAttendees.lunchId], references: [lunches.id] }),
  user: one(user, { fields: [lunchAttendees.userId], references: [user.id] }),
}));

export const lunchInvitesRelations = relations(lunchInvites, ({ one }) => ({
  lunch: one(lunches, { fields: [lunchInvites.lunchId], references: [lunches.id] }),
  inviter: one(user, {
    fields: [lunchInvites.inviterId],
    references: [user.id],
    relationName: "inviter",
  }),
  invitee: one(user, {
    fields: [lunchInvites.inviteeId],
    references: [user.id],
    relationName: "invitee",
  }),
}));
