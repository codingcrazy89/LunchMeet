import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

/**
 * Client error reporting.
 *
 * v1 shipped with nothing: a crash on a user's device was invisible unless
 * they wrote in about it, and the only diagnostic was an in-app log buffer
 * with no UI to open it, which was quietly capturing auth deep links
 * containing session tokens.
 *
 * Without a DSN this is inert, so development needs no Sentry account.
 */

let initialised = false;

export function initObservability(): boolean {
  if (initialised) return true;

  const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    // Breadcrumbs record navigation and network activity, which on this app
    // includes magic-link deep links. Scrub anything carrying a token.
    beforeBreadcrumb(breadcrumb) {
      if (typeof breadcrumb.data?.url === "string" && breadcrumb.data.url.includes("token")) {
        return null;
      }
      return breadcrumb;
    },
  });

  initialised = true;
  return true;
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialised) {
    if (__DEV__) console.error("[observability]", error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
