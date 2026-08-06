import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./api/client";
import { queryKeys } from "./api/queryClient";
import { useInvites, type Invite } from "./features/invites/queries";
import { useLunches as useLunchList, type Lunch, type LunchAttendee } from "./features/lunches/queries";

/**
 * Adapter between the v2 API and the screens written against v1's shapes.
 *
 * The screens still speak Supabase's snake_case (`lunch.date_time`,
 * `lunch.lunch_attendees`). Rather than rewrite ~12,000 lines of UI in one
 * step, this maps the typed API responses into those shapes and keeps the
 * function signatures the screens already call.
 *
 * The important part is what it no longer does. v1's version of this file was
 * 886 lines containing the entire data layer: manual retry loops, two cache
 * invalidation counters, and the client-side visibility filter that leaked
 * private lunches. Fetching, caching and invalidation are now TanStack Query's
 * job, and filtering is the server's.
 */

export interface LegacyAttendee {
  id: string;
  user_id: string;
  status: "pending" | "accepted" | "denied";
  profile: { name: string | null; age: number | null; photos?: string[] } | null;
}

export interface LunchMeet {
  id: string;
  host_id: string;
  co_host_id: string | null;
  place_id: string | null;
  restaurant: string;
  restaurant_address: string | null;
  latitude: number | null;
  longitude: number | null;
  date_time: string;
  seats: number;
  description: string | null;
  is_public: boolean;
  lunch_attendees: LegacyAttendee[];
  host_profile: { name: string | null; age: number | null } | null;
  co_host_profile: { name: string | null; age: number | null } | null;
  accepted_count: number;
}

/** Matches the nested shape the invite cards in index.tsx already render. */
export interface LegacyInvite {
  id: string;
  lunch_id: string;
  lunch: {
    id: string;
    restaurant: string;
    date_time: string;
  };
  inviter_profile: { name: string } | null;
}

interface LunchContextValue {
  lunches: LunchMeet[];
  invites: LegacyInvite[];
  loading: boolean;
  fetchError: string | null;
  version: number;
  fetchLunches: () => Promise<void>;
  addLunch: (lunch: Record<string, unknown>) => Promise<void>;
  joinLunch: (lunch: LunchMeet) => Promise<boolean>;
  acceptRequest: (lunchId: string, attendeeId: string) => Promise<void>;
  denyRequest: (lunchId: string, attendeeId: string) => Promise<void>;
  leaveLunch: (lunchId: string) => Promise<void>;
  closeLunch: (lunch: LunchMeet) => Promise<void>;
  submitRating: (
    ratedId: string,
    lunchId: string,
    rating: number,
    comment?: string
  ) => Promise<boolean>;
  acceptInvite: (inviteId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
}

const LunchContext = createContext<LunchContextValue | undefined>(undefined);

type ApiLunch = Lunch & {
  hostName?: string | null;
  hostAge?: number | null;
  acceptedCount?: number;
};

function toLegacyLunch(lunch: ApiLunch, attendees: LunchAttendee[] = []): LunchMeet {
  return {
    id: lunch.id,
    host_id: lunch.hostId,
    co_host_id: lunch.coHostId,
    place_id: lunch.placeId,
    restaurant: lunch.restaurantName,
    restaurant_address: lunch.restaurantAddress,
    latitude: lunch.latitude,
    longitude: lunch.longitude,
    date_time: lunch.dateTime,
    seats: lunch.seats,
    description: lunch.description,
    is_public: lunch.isPublic,
    accepted_count: lunch.acceptedCount ?? 0,
    host_profile: { name: lunch.hostName ?? null, age: lunch.hostAge ?? null },
    co_host_profile: null,
    lunch_attendees: attendees.map((a) => ({
      id: a.id,
      user_id: a.userId,
      status: a.status,
      profile: { name: a.name, age: a.age, photos: a.photoKeys ?? [] },
    })),
  };
}

function toLegacyInvite(invite: Invite): LegacyInvite {
  return {
    id: invite.id,
    lunch_id: invite.lunchId,
    lunch: {
      id: invite.lunchId,
      restaurant: invite.restaurantName,
      date_time: invite.dateTime,
    },
    inviter_profile: invite.inviterName ? { name: invite.inviterName } : null,
  };
}

export function LunchProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const lunchQuery = useLunchList("upcoming");
  const inviteQuery = useInvites();

  const invalidate = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.lunches.all() }),
      client.invalidateQueries({ queryKey: queryKeys.invites.mine() }),
    ]);
  }, [client]);

  const value = useMemo<LunchContextValue>(() => {
    const lunches = (lunchQuery.data ?? []).map((l) => toLegacyLunch(l as ApiLunch));
    const invites = (inviteQuery.data ?? []).map(toLegacyInvite);

    return {
      lunches,
      invites,
      loading: lunchQuery.isLoading,
      fetchError: lunchQuery.error ? lunchQuery.error.message : null,
      // Retained only so existing screens can keep it in dependency arrays.
      // TanStack Query re-renders on its own; this no longer drives anything.
      version: lunchQuery.dataUpdatedAt,

      async fetchLunches() {
        await invalidate();
      },

      async addLunch(input) {
        const response = await api.v1.lunches.$post({ json: input as never });
        await unwrap(response);
        await invalidate();
      },

      async joinLunch(lunch) {
        const response = await api.v1.lunches[":lunchId"].attendees.$post({
          param: { lunchId: lunch.id },
        });
        await unwrap(response);
        await invalidate();
        return true;
      },

      async acceptRequest(lunchId, attendeeId) {
        const response = await api.v1.lunches[":lunchId"].attendees[":attendeeId"].accept.$post({
          param: { lunchId, attendeeId },
        });
        await unwrap(response);
        await invalidate();
      },

      async denyRequest(lunchId, attendeeId) {
        const response = await api.v1.lunches[":lunchId"].attendees[":attendeeId"].deny.$post({
          param: { lunchId, attendeeId },
        });
        await unwrap(response);
        await invalidate();
      },

      async leaveLunch(lunchId) {
        const response = await api.v1.lunches[":lunchId"].attendees.me.$delete({
          param: { lunchId },
        });
        await unwrap(response);
        await invalidate();
      },

      async closeLunch(lunch) {
        const response = await api.v1.lunches[":id"].$delete({ param: { id: lunch.id } });
        await unwrap(response);
        await invalidate();
      },

      async submitRating(ratedId, lunchId, rating, comment) {
        const response = await api.v1.lunches[":lunchId"].ratings.$post({
          param: { lunchId },
          json: { ratedId, rating, comment },
        });
        await unwrap(response);
        return true;
      },

      async acceptInvite(inviteId) {
        const response = await api.v1.invites[":inviteId"].accept.$post({ param: { inviteId } });
        await unwrap(response);
        await invalidate();
      },

      async declineInvite(inviteId) {
        const response = await api.v1.invites[":inviteId"].decline.$post({ param: { inviteId } });
        await unwrap(response);
        await invalidate();
      },
    };
  }, [lunchQuery.data, lunchQuery.isLoading, lunchQuery.error, lunchQuery.dataUpdatedAt, inviteQuery.data, invalidate]);

  return <LunchContext.Provider value={value}>{children}</LunchContext.Provider>;
}

export function useLunches(): LunchContextValue {
  const context = useContext(LunchContext);
  if (!context) {
    throw new Error("useLunches must be used within a LunchProvider.");
  }
  return context;
}
