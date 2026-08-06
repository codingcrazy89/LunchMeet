import { loadDotEnv } from "@lunchmeet/config";

/**
 * Points the process at the test database before any module reads config.
 *
 * Vitest runs setup files before the test module graph is imported, so these
 * assignments happen before `env.ts` parses the environment. Without them,
 * tests would truncate the development database.
 *
 * The test connection is derived from DATABASE_URL by swapping the database
 * name, so no credential is ever written into the repository. Locally that
 * comes from the gitignored .env; in CI it comes from the workflow.
 */
loadDotEnv();

process.env.NODE_ENV = "test";

const configured = process.env.DATABASE_URL;
if (!configured) {
  throw new Error(
    "DATABASE_URL is required to run tests. Copy .env.example to .env and fill it in."
  );
}

// Replace the final path segment (the database name) with the test database.
process.env.DATABASE_URL = configured.replace(/\/[^/?]*(\?|$)/, "/lunchmeet_test$1");

process.env.BETTER_AUTH_SECRET ??= "test-secret-that-is-long-enough-to-pass-validation";
process.env.STORAGE_EMULATOR_HOST ??= "http://localhost:4443";
