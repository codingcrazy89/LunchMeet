import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import { queryKeys } from "../../api/queryClient";

export interface Invite {
  id: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  lunchId: string;
  restaurantName: string;
  dateTime: string;
  inviterName: string | null;
}

export function useInvites() {
  return useQuery({
    queryKey: queryKeys.invites.mine(),
    async queryFn() {
      const response = await api.v1.invites.$get();
      const data = await unwrap<{ invites: Invite[] }>(response);
      return data.invites;
    },
  });
}

export function useSendInvite(lunchId: string) {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(email: string) {
      const response = await api.v1.lunches[":lunchId"].invites.$post({
        param: { lunchId },
        json: { email },
      });
      return unwrap<{ ok: boolean; delivered: boolean }>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.lunches.detail(lunchId) });
    },
  });
}

export function useAnswerInvite() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn({ inviteId, accept }: { inviteId: string; accept: boolean }) {
      const response = accept
        ? await api.v1.invites[":inviteId"].accept.$post({ param: { inviteId } })
        : await api.v1.invites[":inviteId"].decline.$post({ param: { inviteId } });
      return unwrap<unknown>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.invites.mine() });
      void client.invalidateQueries({ queryKey: queryKeys.lunches.all() });
    },
  });
}
