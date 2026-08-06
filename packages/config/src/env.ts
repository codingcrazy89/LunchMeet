import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { publicEnvSchema, type PublicEnv } from "./public.js";

/**
 * Load the repo-root .env into process.env, if present.
 *
 * Uses Node's built-in loader rather than the dotenv package. Real environment
 * variables already set take precedence, so a deployed process is never
 * overridden by a stray file.
 */
export function loadDotEnv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(here, "../../..", ".env");
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

/**
 * Server-side configuration. Never import this from the mobile client.
 *
 * Defaults are chosen so `npm run api` works against the local dev stack with
 * an empty .env. Anything without a safe default is required, and the process
 * refuses to boot without it rather than failing later on `undefined`.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Database
  DATABASE_URL: z
    .string()
    .startsWith("postgres", "must be a postgres:// or postgresql:// URL")
    .default("postgresql://lunchmeet_dev:lunchmeet@localhost:5432/lunchmeet_dev"),

  // Auth
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "must be at least 32 characters; generate with `openssl rand -base64 32`")
    .default("dev-only-insecure-secret-change-me-before-any-deploy"),
  BETTER_AUTH_URL: z.url().default("http://localhost:8787"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),

  // Google Places (server-side only; must never reach the client)
  GOOGLE_PLACES_API_KEY: z.string().optional(),

  // Object storage (Google Cloud Storage)
  GCP_PROJECT_ID: z.string().default("lunchmeet-dev"),
  GCS_BUCKET: z.string().default("lunchmeet-photos-dev"),
  /** Set to the fake-gcs-server endpoint in dev; leave unset in production. */
  STORAGE_EMULATOR_HOST: z.string().optional(),
  /** Only needed off-GCP. On Cloud Run or GKE, attach a service account instead. */
  GCP_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // Email (magic links)
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.email().default("no-reply@lunchmeet.local"),

  // Push notifications
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // Error reporting
  SENTRY_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & PublicEnv;

const combinedSchema = serverEnvSchema.and(publicEnvSchema);

let cached: ServerEnv | undefined;

/**
 * Parse and cache server configuration.
 *
 * On failure this prints every problem at once and exits, rather than throwing
 * on the first one. Discovering misconfiguration one variable per restart is
 * the slowest possible way to set up an environment.
 */
export function loadServerEnv(source?: NodeJS.ProcessEnv): ServerEnv {
  if (cached) return cached;

  if (!source) {
    loadDotEnv();
  }
  const result = combinedSchema.safeParse(source ?? process.env);
  if (!result.success) {
    const detail = z.prettifyError(result.error);
    console.error(
      [
        "",
        "  Configuration is invalid. The API cannot start.",
        "",
        detail
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n"),
        "",
        "  Every variable is declared in packages/config/src/env.ts.",
        "  Copy .env.example to .env and fill in the missing values.",
        "",
      ].join("\n")
    );
    process.exit(1);
  }

  cached = result.data as ServerEnv;
  return cached;
}

export function isProduction(env: ServerEnv): boolean {
  return env.NODE_ENV === "production";
}

/**
 * Guards that only matter in production, where a forgiving default becomes a
 * security problem rather than a convenience.
 */
export function assertProductionSafety(env: ServerEnv): string[] {
  if (!isProduction(env)) return [];

  const problems: string[] = [];
  if (env.BETTER_AUTH_SECRET.startsWith("dev-only")) {
    problems.push("BETTER_AUTH_SECRET is still the development default.");
  }
  if (env.DATABASE_URL.includes("localhost")) {
    problems.push("DATABASE_URL points at localhost.");
  }
  if (env.STORAGE_EMULATOR_HOST) {
    problems.push("STORAGE_EMULATOR_HOST is set, so storage would hit an emulator.");
  }
  if (!env.SENTRY_DSN) {
    problems.push("SENTRY_DSN is unset, so production errors go unreported.");
  }
  if (env.EMAIL_FROM.endsWith(".local")) {
    problems.push("EMAIL_FROM uses a .local domain, so magic links will not deliver.");
  }
  return problems;
}
