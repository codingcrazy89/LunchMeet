import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import { queryKeys } from "../../api/queryClient";

export interface Notification {
  id: string;
  type:
    | "invite"
    | "join_request"
    | "cohost_added"
    | "new_message"
    | "request_accepted"
    | "rate_attendees"
    | "user_report";
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.all(),
    async queryFn() {
      const response = await api.v1.notifications.$get();
      return unwrap<{ notifications: Notification[]; unreadCount: number }>(response);
    },
    // Realtime delivery replaces polling in phase 4; until then a slow poll
    // keeps the badge roughly honest.
    refetchInterval: 60_000,
  });
}

export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn() {
      const response = await api.v1.notifications.read.$post();
      return unwrap<{ ok: boolean }>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(id: string) {
      const response = await api.v1.notifications[":id"].read.$post({ param: { id } });
      return unwrap<{ ok: boolean }>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}
