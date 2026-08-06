import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "./api/auth";
import { ApiRequestError } from "./api/client";

/**
 * Authentication, backed by Better Auth.
 *
 * The interface is deliberately unchanged from v1 so screens keep working
 * while the implementation underneath moved from Supabase to our own API.
 *
 * What is gone: the hand-rolled deep-link handshake that parsed `access_token`
 * out of the URL fragment, and the logging of those URLs into an in-app buffer.
 * The Expo plugin owns the handshake and stores the session in SecureStore.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  suspendedMessage: string | null;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  clearSuspendedMessage: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const user = useMemo<AuthUser | null>(() => {
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
  }, [session]);

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: "lunchmeet://",
    });
    if (error) {
      throw new Error(error.message ?? "Could not send the sign-in link.");
    }
  }, []);

  const signInWithProvider = useCallback(async (provider: "google" | "apple") => {
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: "lunchmeet://",
    });
    if (error) {
      throw new Error(error.message ?? `Could not sign in with ${provider}.`);
    }
  }, []);

  const signInWithGoogle = useCallback(() => signInWithProvider("google"), [signInWithProvider]);
  const signInWithApple = useCallback(() => signInWithProvider("apple"), [signInWithProvider]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    // Drop every cached response so the next user cannot read the previous
    // user's data out of the cache.
    queryClient.clear();
  }, [queryClient]);

  const clearSuspendedMessage = useCallback(() => setSuspendedMessage(null), []);

  /**
   * Suspension is enforced by the API, which answers 403 with this code to
   * every request. The client only has to surface it; v1 relied on the client
   * to sign the user out, which a modified client could skip.
   */
  React.useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const error = event.query.state.error;
      if (error instanceof ApiRequestError && error.isSuspended) {
        setSuspendedMessage(error.message);
        void authClient.signOut();
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: isPending,
      suspendedMessage,
      signInWithEmail,
      signInWithGoogle,
      signInWithApple,
      signOut,
      clearSuspendedMessage,
    }),
    [
      user,
      isPending,
      suspendedMessage,
      signInWithEmail,
      signInWithGoogle,
      signInWithApple,
      signOut,
      clearSuspendedMessage,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
