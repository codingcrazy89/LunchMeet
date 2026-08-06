import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { createdAt, tstz, updatedAt } from "./_shared.js";

/**
 * The public-facing half of a user.
 *
 * Split from Better Auth's `user` table so authentication concerns and profile
 * content evolve independently. One row per user, created on first sign-in.
 *
 * Note what is absent: v1 stored photos as base64 data URIs directly in a
 * `photos` column that was selected on nearly every screen, inflating every
 * profile query by megabytes. Here photos are storage object keys.
 */
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),

    name: text("name").notNull().default(""),
    age: integer("age"),
    gender: text("gender"),
    bio: text("bio"),
    socialMediaUrl: text("social_media_url"),

    /** Object keys in the storage bucket, not image data. Ordered. */
    photoKeys: text("photo_keys").array().notNull().default([]),

    /** Free-form interest tags used for lunch visibility filtering. */
    lookingFor: text("looking_for").array().notNull().default([]),

    // Trust and safety. Set by the rating-threshold job, never by the client.
    suspended: boolean("suspended").notNull().default(false),
    flaggedForInvestigation: boolean("flagged_for_investigation").notNull().default(false),
    suspendedAt: tstz("suspended_at"),
    suspendedReason: text("suspended_reason"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("profiles_suspended_idx").on(table.suspended),
    // gin_trgm_ops is required explicitly: text has no default GIN operator class.
    index("profiles_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
  ]
);

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(user, {
    fields: [profiles.userId],
    references: [user.id],
  }),
}));
