import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Integration tests share one Postgres database, so they must not run
    // concurrently against each other.
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
