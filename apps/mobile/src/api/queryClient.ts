import { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./client";

/**
 * Shared query client.
 *
 * This replaces v1's hand-rolled cache: manual refetches, a `version` counter
 * in LunchContext and a `contactsVersion` counter in ContactsContext that
 * components watched to know when to reload, plus a bespoke 3-attempt backoff.
 * All of that is a partial reimplementation of what this library does.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry(failureCount, error) {
        // Retrying an authorization failure just produces the same answer
        // three times more slowly.
        if (error instanceof ApiRequestError) {
          if (error.status === 401 || error.status === 403 || error.status === 404) {
            return false;
          }
        }
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Query keys in one place, so invalidation cannot silently miss a cache entry.
 */
export const queryKeys = {
  profile: {
    me: () => ["profile", "me"] as const,
    byId: (userId: string) => ["profile", userId] as const,
  },
  lunches: {
    all: () => ["lunches"] as const,
    list: (scope: string) => ["lunches", "list", scope] as const,
    nearby: (lat: number, lng: number, radius: number) =>
      ["lunches", "nearby", lat, lng, radius] as const,
    detail: (id: string) => ["lunches", "detail", id] as const,
  },
  chat: {
    messages: (lunchId: string) => ["chat", lunchId, "messages"] as const,
    access: (lunchId: string) => ["chat", lunchId, "access"] as const,
  },
  invites: {
    mine: () => ["invites"] as const,
  },
  notifications: {
    all: () => ["notifications"] as const,
  },
  contacts: {
    all: () => ["contacts"] as const,
  },
  ratings: {
    pending: (lunchId: string) => ["ratings", lunchId, "pending"] as const,
  },
} as const;
