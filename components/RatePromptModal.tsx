import { useRouter } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Radius, Spacing, Typography } from "../constants/theme";

type RatePromptModalProps = {
  visible: boolean;
  lunchId: string;
  restaurant: string;
  onClose: () => void;
};

export default function RatePromptModal({
  visible,
  lunchId,
  restaurant,
  onClose,
}: RatePromptModalProps) {
  const router = useRouter();

  const handleRate = () => {
    onClose();
    router.push(`/rate-attendees/${lunchId}`);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Rate this User</Text>
          <Text style={styles.subtitle}>
            How was your experience at {restaurant}? Rate each attendee 1–5 stars.
          </Text>
          <View style={styles.buttons}>
            <Pressable style={styles.laterButton} onPress={onClose}>
              <Text style={styles.laterButtonText}>Maybe Later</Text>
            </Pressable>
            <Pressable style={styles.rateButton} onPress={handleRate}>
              <Text style={styles.rateButtonText}>Rate Now</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  title: {
    ...Typography.title,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.bodySecondary,
    marginBottom: Spacing.xl,
  },
  buttons: {
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "flex-end",
  },
  laterButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  laterButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  rateButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  rateButtonText: {
    ...Typography.button,
    color: "#fff",
  },
});
