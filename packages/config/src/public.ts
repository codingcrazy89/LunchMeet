import { z } from "zod";

/**
 * Configuration that is safe to bake into the mobile bundle.
 *
 * Anything here ships inside the app binary and is trivially extractable, so
 * it must never carry a secret. The split from `serverEnv` is the whole point:
 * v1 had no such boundary, which is how the Supabase key and the Places proxy
 * URL ended up scattered across eas.json, app.config.js and proxyUrl.ts.
 */
export const publicEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url().default("http://localhost:8787"),
  EXPO_PUBLIC_WS_URL: z
    .string()
    .regex(/^wss?:\/\//, "must start with ws:// or wss://")
    .default("ws://localhost:8787/ws"),
  /** Identifies the Sentry project. Cannot read data, so it is safe to ship. */
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Read each key explicitly rather than passing `process.env` wholesale.
 *
 * Metro only inlines statically analysable `process.env.EXPO_PUBLIC_*` member
 * accesses when bundling for React Native. Spreading the object would compile
 * to `undefined` on device while working fine in Node, which is exactly the
 * kind of environment-dependent bug this package exists to prevent.
 */
export function readPublicEnv(): Record<string, string | undefined> {
  return {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_WS_URL: process.env.EXPO_PUBLIC_WS_URL,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  };
}

export function parsePublicEnv(
  source: Record<string, string | undefined> = readPublicEnv()
): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid public configuration:\n${z.prettifyError(result.error)}`
    );
  }
  return result.data;
}

/** Parsed once. Safe to import from both the API and the mobile client. */
export const publicEnv: PublicEnv = parsePublicEnv();
