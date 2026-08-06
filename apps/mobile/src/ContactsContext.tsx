import { createContext, useCallback, useContext, useState } from "react";

type ContactsContextType = {
  /** Increment to signal that contacts changed (e.g. after adding from profile) */
  contactsVersion: number;
  /** Call after adding a contact so Host tab refetches */
  invalidateContacts: () => void;
};

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contactsVersion, setContactsVersion] = useState(0);
  const invalidateContacts = useCallback(() => {
    setContactsVersion((v) => v + 1);
  }, []);
  return (
    <ContactsContext.Provider value={{ contactsVersion, invalidateContacts }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error("useContacts must be used within ContactsProvider");
  return ctx;
}
