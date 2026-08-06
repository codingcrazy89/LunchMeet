import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";
import { SCHEMA_NAME } from "./schema/_shared.js";

export type Database = ReturnType<typeof createDatabase>["db"];

export interface DatabaseOptions {
  url: string;
  /** Connection pool size. Keep at 1 for migrations and one-shot scripts. */
  max?: number;
}

export function createDatabase({ url, max = 10 }: DatabaseOptions) {
  const sql = postgres(url, {
    max,
    onnotice: () => {},
    connection: {
      // Application tables live in `lunchmeet`; extensions stay in `public`.
      // Without public on the path, ll_to_earth, gen_random_uuid and the citext
      // type would not resolve.
      search_path: `${SCHEMA_NAME}, public`,
    },
  });

  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

export { schema };
