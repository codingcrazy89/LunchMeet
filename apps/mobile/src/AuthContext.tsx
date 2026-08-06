import Constants from "expo-constants";
import * as LinkingExpo from "expo-linking";
import { useURL } from "expo-linking";
import { createContext, useContext, useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import { hasSupabaseConfig, supabase } from "./lib/supabase";

type AuthContextType = {
  user: any;
  loading: boolean;
  suspendedMessage: string | null;
  clearSuspendedMessage: () => void;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Parse hash fragment from URL for access_token and refresh_token (Supabase magic link callback). */
function getSessionParamsFromUrl(url: string): { access_token?: string; refresh_token?: string } {
  try {
    const hash = url.includes("#") ? url.split("#")[1] : "";
    if (!hash) return {};
    const params: Record<string, string> = {};
    hash.split("&").forEach((part) => {
      const [key, value] = part.split("=");
      if (key && value) params[decodeURIComponent(key)] = decodeURIComponent(value);
    });
    return {
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    };
  } catch {
    return {};
  }
}

async function createSessionFromUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  const { access_token, refresh_token } = getSessionParamsFromUrl(url);
  if (!access_token || !refresh_token) return { ok: false };
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return { ok: !error, error: error?.message };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!hasSupabaseConfig) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user);
      setLoading(false);
      if (data.user) ensureProfile(data.user);
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
    });

    const timeout = setTimeout(() => {
      setLoading((prev) => (prev ? false : prev));
    }, 8000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) ensureProfile(session.user);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Handle magic link when app is opened from email link (mobile deep link).
  // Use expo-linking's useURL hook for better deep link handling
  const url = useURL();
  
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      console.log("🔗 Deep link received:", url);
      
      if (!url.includes("access_token")) {
        console.log("⚠️ URL does not contain access_token, ignoring");
        return;
      }
      
      console.log("✅ Processing magic link callback...");
      const result = await createSessionFromUrl(url);
      if (result.ok) {
        console.log("✅ Successfully logged in from magic link!");
        setLoading(false);
      } else {
        if (result.error) {
          console.warn("Could not create session from magic link:", result.error);
        }
      }
    };

    // Handle initial URL when app is opened from a link
    Linking.getInitialURL().then(handleUrl);
    
    // Handle URL when app is already open
    const sub = Linking.addEventListener("url", (e) => {
      console.log("🔗 URL event received:", e.url);
      handleUrl(e.url);
    });

    return () => sub.remove();
  }, []);

  // Also handle URL from expo-linking's useURL hook
  useEffect(() => {
    if (url && url.includes("access_token")) {
      console.log("🔗 Processing URL from useURL hook:", url);
      createSessionFromUrl(url).then((result) => {
        if (result.ok) {
          console.log("✅ Successfully logged in from useURL!");
          setLoading(false);
        } else if (result.error) {
          console.warn("Could not create session from URL:", result.error);
        }
      });
    }
  }, [url]);

  const ensureProfile = async (user: any) => {
    // Check if profile exists and if account is suspended
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("name, suspended")
      .eq("id", user.id)
      .single();

    if (existingProfile?.suspended) {
      await supabase.auth.signOut();
      setUser(null);
      setSuspendedMessage("Your account has been suspended pending investigation. Please contact support.");
      return;
    }

    // Only set default name if profile doesn't exist or name is empty
    if (!existingProfile || !existingProfile.name) {
      await supabase.from("profiles").upsert({
        id: user.id,
        name: user.email.split("@")[0],
      });
    }
  };

  const getRedirectUrl = (): string => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.location.origin;
    }
    // In Expo Go, createURL() returns exp://LOCAL_IP:PORT which fails for
    // phones not on the same WiFi. Use exp+<slug>:// instead — Expo Go
    // handles this scheme for the currently running project on any network.
    if (Constants.appOwnership === "expo") {
      const slug = Constants.expoConfig?.slug || "lunchmeet";
      return `exp+${slug}://`;
    }
    return LinkingExpo.createURL("");
  };

  const signInWithEmail = async (email: string) => {
    try {
      console.log("[Auth] signInWithEmail START, email length:", email?.trim?.()?.length ?? 0);
      const redirectTo = getRedirectUrl();
      console.log("[Auth] redirectTo:", redirectTo);
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || "";
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || "";
      const hasConfig = !!supabaseUrl && !!supabaseKey;
      console.log("[Auth] Supabase URL configured:", !!supabaseUrl, "Anon key configured:", !!supabaseKey);
      if (!hasConfig) {
        console.error("[Auth] Missing Supabase config - set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY");
        throw new Error("App not configured for login. Missing Supabase credentials.");
      }
      if (!supabase?.auth) {
        console.error("[Auth] supabase.auth is missing - Supabase client may be invalid");
        throw new Error("Supabase auth not available.");
      }
      console.log("[Auth] Calling signInWithOtp...");
      const { data, error } = await supabase.auth.signInWithOtp({
        email: (email || "").trim(),
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      console.log("[Auth] signInWithOtp response - error:", error?.message ?? null, "data:", data ? "present" : "null");
      if (error) {
        console.error("[Auth] Magic link error:", error.message, error);
        throw error;
      }
      console.log("[Auth] Magic link sent successfully");
    } catch (e) {
      console.error("[Auth] signInWithEmail threw:", e);
      throw e;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithOAuth = async (provider: "google" | "apple") => {
    if (!hasSupabaseConfig || !supabase?.auth) {
      throw new Error("App not configured for login. Missing Supabase credentials.");
    }
    const redirectTo = getRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    if (data?.url) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = data.url;
      } else {
        await Linking.openURL(data.url);
      }
    }
  };

  const signInWithGoogle = () => signInWithOAuth("google");
  const signInWithApple = () => signInWithOAuth("apple");

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        suspendedMessage,
        clearSuspendedMessage: () => setSuspendedMessage(null),
        signInWithEmail,
        signInWithGoogle,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuthState: AuthContextType = {
  user: null,
  loading: true,
  suspendedMessage: null,
  clearSuspendedMessage: () => {},
  signInWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    if (__DEV__) {
      console.warn("useAuth called outside AuthProvider – using fallback. Ensure app/_layout.tsx wraps the app with AuthProvider.");
    }
    return defaultAuthState;
  }
  return context;
}

