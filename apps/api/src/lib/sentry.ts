import * as Sentry from "@sentry/node";
import { env } from "../env.js";

/**
 * Error reporting.
 *
 * v1 had none, so a production crash was invisible unless a user reported it
 * by hand. Initialisation is deliberately conditional: without a DSN this is a
 * no-op rather than a startup failure, so local development needs no account.
 */
export function initSentry(): boolean {
  if (!env.SENTRY_DSN) return false;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,

    beforeSend(event) {
      // Belt and braces alongside the logger's redaction: never ship request
      // headers, which carry the session cookie.
      if (event.request?.headers) {
        delete event.request.headers.cookie;
        delete event.request.headers.authorization;
      }
      return event;
    },
  });

  return true;
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
