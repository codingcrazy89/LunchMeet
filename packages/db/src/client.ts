import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

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
