import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radius, Spacing, Typography } from "../constants/theme";
import type { Notification } from "../src/NotificationContext";

type NotificationToastProps = {
  notification: Notification;
  onDismiss: () => void;
};

export default function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [notification.id, onDismiss]);

  const handlePress = () => {
    onDismiss();
    const data = notification.data as Record<string, string>;
    switch (notification.type) {
      case "invite":
      case "request_accepted":
        if (data?.lunch_id) router.push({ pathname: "/(tabs)", params: { focus: "lunches" } });
        break;
      case "join_request":
      case "cohost_added":
        if (data?.lunch_id) router.push({ pathname: "/(tabs)/my-lunches" });
        break;
      case "new_message":
        if (data?.lunch_id) router.push({ pathname: "/(tabs)/chat", params: { lunchId: data.lunch_id } });
        break;
      case "rate_attendees":
        if (data?.lunch_id) router.push(`/rate-attendees/${data.lunch_id}`);
        break;
      case "user_report":
        router.push("/(tabs)");
        break;
      default:
        router.push("/(tabs)");
    }
  };

  return (
    <Pressable
      style={[styles.toast, { top: Math.max(insets.top, 8) }]}
      onPress={handlePress}
    >
      <Text style={styles.title}>{notification.title}</Text>
      {notification.body ? (
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    ...Typography.titleSmall,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  body: {
    ...Typography.bodySecondary,
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
