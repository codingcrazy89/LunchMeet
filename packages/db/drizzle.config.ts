import { defineConfig } from "drizzle-kit";
import { loadServerEnv } from "@lunchmeet/config";

const env = loadServerEnv();

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL },
  // Prompt on ambiguous changes. Without this a column rename can be
  // interpreted as drop-then-add, which silently loses the data.
  strict: true,
  verbose: true,
});
