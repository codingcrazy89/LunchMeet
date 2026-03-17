import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "./AuthContext";
import { supabase } from "./lib/supabase";

export type Notification = {
  id: string;
  user_id: string;
  type: "invite" | "join_request" | "cohost_added" | "new_message" | "request_accepted" | "rate_attendees" | "user_report";
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  latestToast: Notification | null;
  dismissToast: () => void;
  fetchNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [latestToast, setLatestToast] = useState<Notification | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, body, data, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error) {
        setNotifications((data as Notification[]) ?? []);
      }
    } catch (err) {
      // Silently ignore - notifications table may not exist or network may fail
      console.warn("Could not fetch notifications:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setLatestToast(null);
      return;
    }
    const t = setTimeout(fetchNotifications, 2000);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as Notification;
            setNotifications((prev) => [n, ...prev]);
            setLatestToast(n);
          }
        )
        .subscribe();
    } catch (err) {
      // Realtime may fail if notifications table doesn't exist
      console.warn("Could not subscribe to notifications:", err);
    }

    return () => {
      clearTimeout(t);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    },
    [user?.id]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
  }, [user?.id]);

  const dismissToast = useCallback(() => setLatestToast(null), []);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    latestToast,
    dismissToast,
    fetchNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (ctx === undefined) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
