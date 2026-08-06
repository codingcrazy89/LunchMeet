/**
 * Points the process at the test database before any module reads config.
 *
 * Vitest runs setup files before the test module graph is imported, so this
 * assignment happens before `env.ts` parses the environment. Without it, tests
 * would truncate the development database.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://lunchmeet_dev:lunchmeet38@localhost:5432/lunchmeet_test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-that-is-long-enough-to-pass-validation";
process.env.STORAGE_EMULATOR_HOST ??= "http://localhost:4443";
