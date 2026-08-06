import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./api/queryClient";

/**
 * Compatibility shim.
 *
 * v1's ContactsContext held no contact data at all: it was an integer counter
 * that components watched in order to know when to refetch, a hand-rolled
 * stand-in for cache invalidation. That job now belongs to TanStack Query, so
 * this exists only to keep existing screens compiling while they migrate to
 * `useContacts()` from features/social.
 *
 * @deprecated Use `useContacts` and `useAddContact` from features/social.
 */

interface ContactsContextValue {
  contactsVersion: number;
  invalidateContacts: () => void;
}

const ContactsContext = createContext<ContactsContextValue | undefined>(undefined);

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();

  const invalidateContacts = useCallback(() => {
    void client.invalidateQueries({ queryKey: queryKeys.contacts.all() });
  }, [client]);

  const value = useMemo<ContactsContextValue>(
    () => ({ contactsVersion: 0, invalidateContacts }),
    [invalidateContacts]
  );

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

export function useContacts(): ContactsContextValue {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error("useContacts must be used within a ContactsProvider.");
  }
  return context;
}
