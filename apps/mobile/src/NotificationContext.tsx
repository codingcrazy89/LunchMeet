import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications as useNotificationQuery,
  type Notification,
} from "./features/notifications/queries";

export type { Notification } from "./features/notifications/queries";

/**
 * Compatibility shim over the notifications query.
 *
 * Keeps v1's interface so `AppHeader` and `NotificationsModal` continue to
 * work. The Supabase realtime subscription that used to drive this is replaced
 * by the query's poll, and by the WebSocket added in phase 4.
 *
 * @deprecated Use the hooks in features/notifications directly.
 */

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  latestToast: Notification | null;
  fetchNotifications: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissToast: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const query = useNotificationQuery();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const [dismissed, setDismissed] = useState(false);

  const fetchNotifications = useCallback(() => {
    void query.refetch();
  }, [query]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications: query.data?.notifications ?? [],
      unreadCount: query.data?.unreadCount ?? 0,
      latestToast: dismissed ? null : (query.data?.notifications[0] ?? null),
      fetchNotifications,
      markAsRead: (id: string) => markRead.mutate(id),
      markAllAsRead: () => markAll.mutate(),
      dismissToast: () => setDismissed(true),
    }),
    [query.data, dismissed, fetchNotifications, markRead, markAll]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider.");
  }
  return context;
}
