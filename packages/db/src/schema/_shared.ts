import { customType, pgSchema, timestamp } from "drizzle-orm/pg-core";

/**
 * All application tables live in a dedicated schema rather than `public`.
 *
 * `public` is where extensions land and where anything with CREATE rights can
 * drop objects, so keeping application state separate makes ownership explicit
 * and lets a production role be granted usage on exactly one schema.
 *
 * Extensions stay in `public`; the connection sets a search_path of
 * `lunchmeet, public` so functions like ll_to_earth and gen_random_uuid
 * resolve without qualification.
 */
export const lunchmeet = pgSchema("lunchmeet");

export const SCHEMA_NAME = "lunchmeet";

/**
 * Case-insensitive text, backed by the `citext` extension.
 *
 * Used for email so that `Test@Example.com` and `test@example.com` are the same
 * account. v1 had no such guarantee and worked around it with a `LIKE '%…%'`
 * search over `auth.users`, which leaked addresses to any authenticated caller.
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

/** Timezone-aware timestamp. Naive timestamps are a bug waiting for travel. */
export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const createdAt = () => tstz("created_at").notNull().defaultNow();
export const updatedAt = () => tstz("updated_at").notNull().defaultNow();
