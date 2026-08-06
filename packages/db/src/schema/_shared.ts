import { customType, timestamp } from "drizzle-orm/pg-core";

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
