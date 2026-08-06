import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import { queryKeys } from "../../api/queryClient";

export interface PendingRating {
  userId: string;
  name: string | null;
  photoKeys: string[] | null;
}

export function usePendingRatings(lunchId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ratings.pending(lunchId ?? ""),
    enabled: Boolean(lunchId),
    async queryFn() {
      const response = await api.v1.lunches[":lunchId"].ratings.pending.$get({
        param: { lunchId: lunchId! },
      });
      return unwrap<{ pending: PendingRating[]; lunchHasEnded: boolean }>(response);
    },
  });
}

export function useSubmitRating(lunchId: string) {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(input: { ratedId: string; rating: number; comment?: string }) {
      const response = await api.v1.lunches[":lunchId"].ratings.$post({
        param: { lunchId },
        json: input,
      });
      return unwrap<unknown>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.ratings.pending(lunchId) });
    },
  });
}
