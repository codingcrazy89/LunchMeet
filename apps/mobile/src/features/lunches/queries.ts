import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import { queryKeys } from "../../api/queryClient";

/**
 * Lunch data access.
 *
 * Every list here is already filtered by the server: a lunch the caller may not
 * see is never sent. The client does no visibility filtering of its own, which
 * is the entire point of the rebuild.
 */

export type LunchScope = "upcoming" | "mine" | "hosting";

export interface Lunch {
  id: string;
  hostId: string;
  coHostId: string | null;
  placeId: string | null;
  restaurantName: string;
  restaurantAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  dateTime: string;
  seats: number;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
}

export interface LunchAttendee {
  id: string;
  userId: string;
  status: "pending" | "accepted" | "denied";
  name: string | null;
  age: number | null;
  photoKeys: string[] | null;
}

export interface LunchDetail {
  lunch: Lunch;
  role: "host" | "co_host" | "attendee" | "invitee" | "none";
  attendeeStatus: "pending" | "accepted" | "denied" | null;
  attendees: LunchAttendee[];
}

export function useLunches(scope: LunchScope = "upcoming") {
  return useQuery({
    queryKey: queryKeys.lunches.list(scope),
    async queryFn() {
      const response = await api.v1.lunches.$get({ query: { scope } });
      const data = await unwrap<{ lunches: Lunch[] }>(response);
      return data.lunches;
    },
  });
}

export function useNearbyLunches(
  coords: { latitude: number; longitude: number } | null,
  radiusMetres = 8000
) {
  return useQuery({
    queryKey: queryKeys.lunches.nearby(coords?.latitude ?? 0, coords?.longitude ?? 0, radiusMetres),
    enabled: coords !== null,
    async queryFn() {
      if (!coords) return [];
      const response = await api.v1.lunches.nearby.$get({
        query: {
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
          radiusMetres: String(radiusMetres),
        },
      });
      const data = await unwrap<{ lunches: (Lunch & { distanceMiles: number })[] }>(response);
      return data.lunches;
    },
  });
}

export function useLunch(lunchId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lunches.detail(lunchId ?? ""),
    enabled: Boolean(lunchId),
    async queryFn() {
      const response = await api.v1.lunches[":id"].$get({ param: { id: lunchId! } });
      return unwrap<LunchDetail>(response);
    },
  });
}

export interface CreateLunchInput {
  restaurantName: string;
  restaurantAddress?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  dateTime: Date;
  seats: number;
  description?: string;
  isPublic: boolean;
  visibilityGender?: string[] | null;
  visibilityLookingFor?: string[] | null;
  coHostEmail?: string;
}

export function useCreateLunch() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(input: CreateLunchInput) {
      const response = await api.v1.lunches.$post({
        json: { ...input, dateTime: input.dateTime.toISOString() },
      });
      return unwrap<{ lunch: Lunch }>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.lunches.all() });
    },
  });
}

export function useJoinLunch() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(lunchId: string) {
      const response = await api.v1.lunches[":lunchId"].attendees.$post({
        param: { lunchId },
      });
      return unwrap<{ attendee: LunchAttendee }>(response);
    },
    onSuccess(_data, lunchId) {
      void client.invalidateQueries({ queryKey: queryKeys.lunches.detail(lunchId) });
      void client.invalidateQueries({ queryKey: queryKeys.lunches.all() });
    },
  });
}

export function useAcceptRequest() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn({ lunchId, attendeeId }: { lunchId: string; attendeeId: string }) {
      const response = await api.v1.lunches[":lunchId"].attendees[":attendeeId"].accept.$post({
        param: { lunchId, attendeeId },
      });
      return unwrap<{ attendee: LunchAttendee }>(response);
    },
    onSuccess(_data, { lunchId }) {
      void client.invalidateQueries({ queryKey: queryKeys.lunches.detail(lunchId) });
    },
  });
}

export function useDenyRequest() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn({ lunchId, attendeeId }: { lunchId: string; attendeeId: string }) {
      const response = await api.v1.lunches[":lunchId"].attendees[":attendeeId"].deny.$post({
        param: { lunchId, attendeeId },
      });
      return unwrap<{ ok: boolean }>(response);
    },
    onSuccess(_data, { lunchId }) {
      void client.invalidateQueries({ queryKey: queryKeys.lunches.detail(lunchId) });
    },
  });
}

export function useLeaveLunch() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(lunchId: string) {
      const response = await api.v1.lunches[":lunchId"].attendees.me.$delete({
        param: { lunchId },
      });
      return unwrap<{ ok: boolean }>(response);
    },
    onSuccess(_data, lunchId) {
      void client.invalidateQueries({ queryKey: queryKeys.lunches.detail(lunchId) });
      void client.invalidateQueries({ queryKey: queryKeys.lunches.all() });
    },
  });
}

export function useCloseLunch() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(lunchId: string) {
      const response = await api.v1.lunches[":id"].$delete({ param: { id: lunchId } });
      return unwrap<{ ok: boolean }>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.lunches.all() });
    },
  });
}
