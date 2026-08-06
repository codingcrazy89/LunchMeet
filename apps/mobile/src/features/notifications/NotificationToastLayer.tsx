import { useEffect, useRef, useState } from "react";
import NotificationToast from "../../../components/NotificationToast";
import { useNotifications, type Notification } from "./queries";

/**
 * Surfaces newly arrived notifications as a toast.
 *
 * v1 kept a `latestToast` field in NotificationContext, set from a Supabase
 * realtime subscription. Here the query is the source of truth and this
 * component simply notices when an unseen notification appears at the top.
 * Phase 4 replaces the poll behind `useNotifications` with a WebSocket.
 */
export function NotificationToastLayer() {
  const { data } = useNotifications();
  const [toast, setToast] = useState<Notification | null>(null);
  const seenIds = useRef<Set<string> | null>(null);

  const latest = data?.notifications[0];

  useEffect(() => {
    if (!latest) return;

    // First load establishes a baseline; existing notifications are not new.
    if (seenIds.current === null) {
      seenIds.current = new Set(data?.notifications.map((n) => n.id) ?? []);
      return;
    }

    if (!seenIds.current.has(latest.id) && !latest.readAt) {
      seenIds.current.add(latest.id);
      setToast(latest);
    }
  }, [latest, data]);

  if (!toast) return null;

  return <NotificationToast notification={toast} onDismiss={() => setToast(null)} />;
}
