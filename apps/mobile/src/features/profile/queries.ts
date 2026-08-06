import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import { queryKeys } from "../../api/queryClient";

export interface Profile {
  userId: string;
  name: string;
  age: number | null;
  gender: string | null;
  bio: string | null;
  socialMediaUrl: string | null;
  lookingFor: string[];
  photoKeys: string[];
}

export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me(),
    async queryFn() {
      const response = await api.v1.profiles.me.$get();
      return unwrap<{ profile: Profile | null; email: string }>(response);
    },
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile.byId(userId ?? ""),
    enabled: Boolean(userId),
    async queryFn() {
      const response = await api.v1.profiles[":userId"].$get({ param: { userId: userId! } });
      const data = await unwrap<{ profile: Profile }>(response);
      return data.profile;
    },
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(input: Partial<Omit<Profile, "userId">>) {
      const response = await api.v1.profiles.me.$patch({ json: input });
      return unwrap<{ profile: Profile }>(response);
    },
    onSuccess(data) {
      client.setQueryData(queryKeys.profile.me(), (previous: unknown) => {
        const prev = previous as { profile: Profile | null; email: string } | undefined;
        return prev ? { ...prev, profile: data.profile } : prev;
      });
      void client.invalidateQueries({ queryKey: queryKeys.profile.byId(data.profile.userId) });
    },
  });
}
