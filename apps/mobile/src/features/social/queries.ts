import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import { queryKeys } from "../../api/queryClient";

export interface Contact {
  userId: string;
  name: string;
  photoKeys: string[];
  addedAt: string;
}

export function useContacts() {
  return useQuery({
    queryKey: queryKeys.contacts.all(),
    async queryFn() {
      const response = await api.v2.contacts.$get();
      const data = await unwrap<{ contacts: Contact[] }>(response);
      return data.contacts;
    },
  });
}

export function useAddContact() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(contactId: string) {
      const response = await api.v2.contacts.$post({ json: { contactId } });
      return unwrap<{ ok: boolean }>(response);
    },
    // Replaces v1's ContactsContext, whose entire job was an integer counter
    // that components watched in order to know when to refetch.
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.contacts.all() });
    },
  });
}

export function useRemoveContact() {
  const client = useQueryClient();
  return useMutation({
    async mutationFn(contactId: string) {
      const response = await api.v2.contacts[":contactId"].$delete({ param: { contactId } });
      return unwrap<{ ok: boolean }>(response);
    },
    onSuccess() {
      void client.invalidateQueries({ queryKey: queryKeys.contacts.all() });
    },
  });
}

export function useReportUser() {
  return useMutation({
    async mutationFn(input: { reportedId: string; comment: string }) {
      const response = await api.v2.reports.$post({ json: input });
      return unwrap<{ ok: boolean }>(response);
    },
  });
}
