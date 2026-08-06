import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { account, session, user, verification } from "@lunchmeet/db";
import { db } from "./db.js";
import { env } from "./env.js";
import { magicLinkEmail, sendMail } from "./lib/mail.js";

/**
 * Authentication, replacing Supabase Auth.
 *
 * Sessions live in our own Postgres. The Expo plugin handles the OAuth
 * deep-link handshake and SecureStore on the client, which is the part that
 * would otherwise be hand-written and security-critical.
 */
export const auth = betterAuth({
  appName: "LunchMeet",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),

  // The app has no password UI: sign-in is magic link or OAuth only.
  emailAndPassword: { enabled: false },

  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.APPLE_CLIENT_ID && env.APPLE_PRIVATE_KEY
      ? {
          apple: {
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: env.APPLE_PRIVATE_KEY,
            appBundleIdentifier: "com.lunchmeet.app",
          },
        }
      : {}),
  },

  plugins: [
    expo(),
    magicLink({
      async sendMagicLink({ email, url }) {
        const { subject, text, html } = magicLinkEmail(url);
        await sendMail({ to: email, subject, text, html });
      },
    }),
  ],

  // The mobile app's custom scheme, so the OAuth callback can return to it.
  trustedOrigins: ["lunchmeet://", "exp+lunchmeet://"],

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});

export type Auth = typeof auth;
