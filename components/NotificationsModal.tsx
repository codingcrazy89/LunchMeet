import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors, Radius, Spacing, Typography } from "../constants/theme";
import type { Notification } from "../src/NotificationContext";

type NotificationsModalProps = {
  visible: boolean;
  notifications: Notification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
};

function formatTime(createdAt: string) {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsModal({
  visible,
  notifications,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationsModalProps) {
  const router = useRouter();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleNotificationPress = (n: Notification) => {
    if (!n.read_at) onMarkAsRead(n.id);
    onClose();
    const data = n.data as Record<string, string>;
    switch (n.type) {
      case "invite":
      case "request_accepted":
        router.push("/(tabs)");
        break;
      case "join_request":
      case "cohost_added":
        router.push("/(tabs)/my-lunches");
        break;
      case "new_message":
        if (data?.lunch_id)
          router.push({ pathname: "/(tabs)/chat", params: { lunchId: data.lunch_id } });
        break;
      case "rate_attendees":
        if (data?.lunch_id)
          router.push(`/rate-attendees/${data.lunch_id}`);
        else
          router.push("/(tabs)");
        break;
      default:
        router.push("/(tabs)");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Notifications</Text>
            <View style={styles.headerRight}>
              {unreadCount > 0 && (
                <Pressable onPress={onMarkAllAsRead} style={styles.markAllButton}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {notifications.length === 0 ? (
              <Text style={styles.emptyText}>No notifications yet</Text>
            ) : (
              notifications.map((n) => (
                <Pressable
                  key={n.id}
                  style={[styles.notificationRow, !n.read_at && styles.notificationRowUnread]}
                  onPress={() => handleNotificationPress(n)}
                >
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>{n.title}</Text>
                    {n.body ? (
                      <Text style={styles.notificationBody} numberOfLines={2}>
                        {n.body}
                      </Text>
                    ) : null}
                    <Text style={styles.notificationTime}>{formatTime(n.created_at)}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: "80%",
    minHeight: 200,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    ...Typography.title,
    color: Colors.text,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  markAllButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  markAllText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: "600",
  },
  closeButton: {
    padding: Spacing.sm,
  },
  closeButtonText: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  emptyText: {
    ...Typography.bodySecondary,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: Spacing.xxl,
  },
  notificationRow: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  notificationRowUnread: {
    backgroundColor: Colors.primaryLight,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  notificationBody: {
    ...Typography.bodySecondary,
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  notificationTime: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});
