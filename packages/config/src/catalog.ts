import net from "node:net";
import type { ServerEnv } from "./env.js";

/**
 * The source catalogue: every external thing LunchMeet talks to, declared once.
 *
 * v1 spread this knowledge across .env, eas.json, app.config.js, proxyUrl.ts,
 * ngrok-tunnels.yml, render.yaml and untracked .cf-* files, with no validation
 * anywhere. This registry is the single place that answers "what does this app
 * depend on, what does it need to be configured, and is it reachable right now".
 */

/** Where a value is stored. Putting one in the wrong store is how secrets leak. */
export type SecretStore =
  | "api-host-env"
  | "eas-secrets"
  | "gh-actions"
  | "eas-credentials"
  | "none";

export const SECRET_STORE_LABELS: Record<SecretStore, string> = {
  "api-host-env": "API host environment",
  "eas-secrets": "EAS secrets (ships in the app binary)",
  "gh-actions": "GitHub Actions secrets",
  "eas-credentials": "EAS credentials store (files, not env vars)",
  none: "Not a stored value",
};

export interface EnvVarSpec {
  name: string;
  secret: boolean;
  store: SecretStore;
  required: boolean;
  note?: string;
}

export type HealthStatus = "ok" | "fail" | "skip";

export interface HealthResult {
  status: HealthStatus;
  detail: string;
}

export interface CatalogEntry {
  id: string;
  title: string;
  purpose: string;
  /** Whether the API is unusable without it. */
  critical: boolean;
  env: EnvVarSpec[];
  /** Postgres extensions this dependency requires to exist. */
  postgresExtensions?: string[];
  obtain?: string;
  check?: (env: ServerEnv) => Promise<HealthResult>;
}

const ok = (detail: string): HealthResult => ({ status: "ok", detail });
const fail = (detail: string): HealthResult => ({ status: "fail", detail });
const skip = (detail: string): HealthResult => ({ status: "skip", detail });

/** Extensions the schema depends on. Production must have these pre-created. */
export const REQUIRED_PG_EXTENSIONS = [
  "citext",
  "pg_trgm",
  "cube",
  "earthdistance",
  "pgcrypto",
] as const;

async function tcpProbe(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

export const catalog: CatalogEntry[] = [
  {
    id: "postgres",
    title: "PostgreSQL",
    purpose: "System of record for every entity, and the pub/sub backbone for realtime.",
    critical: true,
    postgresExtensions: [...REQUIRED_PG_EXTENSIONS],
    obtain:
      "Local: createdb lunchmeet_dev. Production: Cloud SQL for PostgreSQL, or a managed equivalent.",
    env: [
      {
        name: "DATABASE_URL",
        secret: true,
        store: "api-host-env",
        required: true,
        note: "The production role must not be a superuser.",
      },
    ],
    async check(env) {
      const { default: postgres } = await import("postgres");
      const sql = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 5, onnotice: () => {} });
      try {
        const [row] = await sql<{ version: string }[]>`select version() as version`;
        const installed = await sql<{ extname: string }[]>`
          select extname from pg_extension
        `;
        const present = new Set(installed.map((r) => r.extname));
        const missing = REQUIRED_PG_EXTENSIONS.filter((e) => !present.has(e));
        const version = row?.version.split(" ").slice(0, 2).join(" ") ?? "unknown";
        if (missing.length > 0) {
          return fail(`${version} reachable, but missing extensions: ${missing.join(", ")}`);
        }
        return ok(`${version}, all ${REQUIRED_PG_EXTENSIONS.length} required extensions present`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      } finally {
        await sql.end({ timeout: 1 });
      }
    },
  },

  {
    id: "storage",
    title: "Google Cloud Storage",
    purpose: "Profile photos, replacing v1's base64-in-Postgres columns.",
    critical: true,
    obtain:
      "Local: fake-gcs-server via docker compose. Production: a GCS bucket with a service account scoped to it.",
    env: [
      { name: "GCP_PROJECT_ID", secret: false, store: "api-host-env", required: true },
      { name: "GCS_BUCKET", secret: false, store: "api-host-env", required: true },
      {
        name: "STORAGE_EMULATOR_HOST",
        secret: false,
        store: "none",
        required: false,
        note: "Dev only. Must be unset in production.",
      },
      {
        name: "GCP_SERVICE_ACCOUNT_JSON",
        secret: true,
        store: "api-host-env",
        required: false,
        note: "Omit on GCP; attach a service account to the workload instead.",
      },
    ],
    async check(env) {
      const host = env.STORAGE_EMULATOR_HOST;
      if (!host) {
        if (!env.GCP_SERVICE_ACCOUNT_JSON) {
          return skip("No emulator and no key; assuming attached service account (cannot verify locally).");
        }
        return skip("Configured for real GCS; not probed to avoid touching production.");
      }
      try {
        const base = host.startsWith("http") ? host : `http://${host}`;
        const response = await fetch(`${base}/storage/v1/b`, {
          signal: AbortSignal.timeout(3000),
        });
        return response.ok
          ? ok(`Emulator reachable at ${base}`)
          : fail(`Emulator returned HTTP ${response.status}`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },
  },

  {
    id: "auth",
    title: "Better Auth",
    purpose: "Sessions, magic links, and Google/Apple OAuth. Replaces Supabase Auth.",
    critical: true,
    obtain: "Self-hosted. OAuth credentials come from Google Cloud Console and Apple Developer.",
    env: [
      {
        name: "BETTER_AUTH_SECRET",
        secret: true,
        store: "api-host-env",
        required: true,
        note: "Rotating this signs every user out.",
      },
      { name: "BETTER_AUTH_URL", secret: false, store: "api-host-env", required: true },
      { name: "GOOGLE_CLIENT_ID", secret: true, store: "api-host-env", required: false },
      { name: "GOOGLE_CLIENT_SECRET", secret: true, store: "api-host-env", required: false },
      { name: "APPLE_CLIENT_ID", secret: false, store: "api-host-env", required: false },
      { name: "APPLE_TEAM_ID", secret: false, store: "api-host-env", required: false },
      { name: "APPLE_KEY_ID", secret: false, store: "api-host-env", required: false },
      {
        name: "APPLE_PRIVATE_KEY",
        secret: true,
        store: "api-host-env",
        required: false,
        note: "The .p8 downloads exactly once and cannot be retrieved again.",
      },
    ],
    async check(env) {
      const providers: string[] = ["magic-link"];
      if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push("google");
      if (env.APPLE_CLIENT_ID && env.APPLE_PRIVATE_KEY) providers.push("apple");
      if (env.BETTER_AUTH_SECRET.startsWith("dev-only")) {
        return env.NODE_ENV === "production"
          ? fail("Still using the development secret in production.")
          : skip(`Dev secret in use. Providers enabled: ${providers.join(", ")}`);
      }
      return ok(`Providers enabled: ${providers.join(", ")}`);
    },
  },

  {
    id: "mail",
    title: "Outbound email",
    purpose: "Delivers magic-link sign-in. Sign-in is unusable if this fails.",
    critical: true,
    obtain: "Local: Mailpit via docker compose. Production: Resend, Postmark, or SES.",
    env: [
      { name: "SMTP_HOST", secret: false, store: "api-host-env", required: true },
      { name: "SMTP_PORT", secret: false, store: "api-host-env", required: true },
      { name: "SMTP_USER", secret: false, store: "api-host-env", required: false },
      { name: "SMTP_PASSWORD", secret: true, store: "api-host-env", required: false },
      {
        name: "EMAIL_FROM",
        secret: false,
        store: "api-host-env",
        required: true,
        note: "Domain needs SPF, DKIM and DMARC or links land in spam.",
      },
    ],
    async check(env) {
      const reachable = await tcpProbe(env.SMTP_HOST, env.SMTP_PORT);
      return reachable
        ? ok(`SMTP reachable at ${env.SMTP_HOST}:${env.SMTP_PORT}`)
        : fail(`Cannot reach SMTP at ${env.SMTP_HOST}:${env.SMTP_PORT}`);
    },
  },

  {
    id: "places",
    title: "Google Places API",
    purpose: "Restaurant search, nearby lookup, and place details when hosting a lunch.",
    critical: false,
    obtain: "Google Cloud Console → Credentials. Restrict by IP and to the Places API only.",
    env: [
      {
        name: "GOOGLE_PLACES_API_KEY",
        secret: true,
        store: "api-host-env",
        required: false,
        note: "Server-side only. Must never reach the client.",
      },
    ],
    async check(env) {
      if (!env.GOOGLE_PLACES_API_KEY) {
        return skip("No key set. Restaurant search will be unavailable.");
      }
      return ok("Key present (not called, to avoid consuming quota).");
    },
  },

  {
    id: "push",
    title: "Expo Push Service",
    purpose: "Delivers notifications when the app is backgrounded. v1 had none.",
    critical: false,
    obtain: "expo.dev → Access Tokens. APNs and FCM keys go in the EAS credentials store.",
    env: [
      {
        name: "EXPO_ACCESS_TOKEN",
        secret: true,
        store: "api-host-env",
        required: false,
        note: "Optional; enables enhanced security so only your servers can push.",
      },
    ],
    async check(env) {
      return env.EXPO_ACCESS_TOKEN
        ? ok("Access token present.")
        : skip("No token. Push still works, without enhanced security.");
    },
  },

  {
    id: "sentry",
    title: "Sentry",
    purpose: "Error reporting for API and client. v1 was blind to production crashes.",
    critical: false,
    obtain: "sentry.io → Project Settings → Client Keys (DSN).",
    env: [
      { name: "SENTRY_DSN", secret: false, store: "api-host-env", required: false },
      {
        name: "EXPO_PUBLIC_SENTRY_DSN",
        secret: false,
        store: "eas-secrets",
        required: false,
        note: "Client DSN. Ships in the binary; identifies the project but cannot read data.",
      },
      {
        name: "SENTRY_AUTH_TOKEN",
        secret: true,
        store: "gh-actions",
        required: false,
        note: "CI only, for uploading source maps.",
      },
    ],
    async check(env) {
      return env.SENTRY_DSN
        ? ok("DSN configured.")
        : skip("No DSN. Errors will not be reported.");
    },
  },
];

/**
 * Present only during the v1 to v2 cutover. Listed so the credential is
 * documented and its absence in normal operation is deliberate rather than an
 * oversight. See ops/CUTOVER.md.
 */
catalog.push({
  id: "supabase-legacy",
  title: "Supabase (v1, cutover only)",
  purpose: "Read-only source for the one-off data migration into the v2 schema.",
  critical: false,
  obtain: "Supabase dashboard, Project Settings, Database. Use a read-only role.",
  env: [
    {
      name: "SUPABASE_DB_URL",
      secret: true,
      store: "none",
      required: false,
      note: "Supplied at the shell for a single run. Must not be set in a deployed environment.",
    },
  ],
  async check(env) {
    return env.SUPABASE_DB_URL
      ? { status: "ok", detail: "Cutover connection configured." }
      : { status: "skip", detail: "Not configured, which is correct outside cutover." };
  },
});

export function findEntry(id: string): CatalogEntry | undefined {
  return catalog.find((entry) => entry.id === id);
}

/** Every env var the catalogue knows about, flattened. */
export function allEnvVars(): (EnvVarSpec & { entryId: string; entryTitle: string })[] {
  return catalog.flatMap((entry) =>
    entry.env.map((spec) => ({ ...spec, entryId: entry.id, entryTitle: entry.title }))
  );
}
