import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type AuthContextType = {
  user: any;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
      if (data.user) ensureProfile(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) ensureProfile(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureProfile = async (user: any) => {
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();
    
    // Only set default name if profile doesn't exist or name is empty
    if (!existingProfile || !existingProfile.name) {
      await supabase.from("profiles").upsert({
        id: user.id,
        name: user.email.split("@")[0],
      });
    }
  };

  const signInWithEmail = async (email: string) => {
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithEmail, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

