import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadServerEnv } from "@lunchmeet/config";
import { createDatabase } from "./client.js";

/**
 * Applies pending migrations.
 *
 * This is the only supported way to change the schema. v1 applied SQL by hand
 * in the Supabase dashboard, which is why its base tables existed in no
 * migration file and the database could not be rebuilt from the repository.
 */
async function main(): Promise<void> {
  const env = loadServerEnv();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.resolve(here, "../migrations");

  const { db, close } = createDatabase({ url: env.DATABASE_URL, max: 1 });

  try {
    console.log(`Applying migrations from ${path.relative(process.cwd(), migrationsFolder)}`);
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied.");
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
