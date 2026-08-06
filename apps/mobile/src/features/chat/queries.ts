import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import { queryKeys } from "../../api/queryClient";

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  senderName: string | null;
  senderPhotoKeys: string[] | null;
}

export function useChatAccess(lunchId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.chat.access(lunchId ?? ""),
    enabled: Boolean(lunchId),
    async queryFn() {
      const response = await api.v2.lunches[":lunchId"].access.$get({
        param: { lunchId: lunchId! },
      });
      return unwrap<{ canAccess: boolean; role: string }>(response);
    },
  });
}

export function useChatMessages(lunchId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.chat.messages(lunchId ?? ""),
    enabled: Boolean(lunchId),
    async queryFn() {
      const response = await api.v2.lunches[":lunchId"].messages.$get({
        param: { lunchId: lunchId! },
        query: {},
      });
      return unwrap<{ roomId: string; messages: ChatMessage[] }>(response);
    },
  });
}

export function useSendMessage(lunchId: string) {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(body: string) {
      const response = await api.v2.lunches[":lunchId"].messages.$post({
        param: { lunchId },
        json: { body },
      });
      return unwrap<{ message: ChatMessage }>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.chat.messages(lunchId) });
    },
  });
}
