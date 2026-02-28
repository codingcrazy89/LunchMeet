import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors, Radius, Spacing, Typography } from "../constants/theme";
import { SAFETY_TIPS, SAFETY_WARNING } from "../constants/safetyTips";

type SafetyConfirmModalProps = {
  visible: boolean;
  onProceed: () => void;
  onCancel: () => void;
};

export default function SafetyConfirmModal({
  visible,
  onProceed,
  onCancel,
}: SafetyConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Safety Reminder</Text>
            <Pressable onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>{SAFETY_WARNING}</Text>
            </View>
            <Text style={styles.tipsTitle}>Safety Tips</Text>
            {SAFETY_TIPS.map((tip, index) => (
              <View key={index} style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
            <Text style={styles.areYouSure}>Are you sure?</Text>
          </ScrollView>
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.proceedButton} onPress={onProceed}>
              <Text style={styles.proceedButtonText}>Yes, proceed</Text>
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
    maxWidth: 400,
    maxHeight: "85%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: "hidden",
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
    padding: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  warningBox: {
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  warningText: {
    ...Typography.body,
    color: "#92400e",
    fontWeight: "500",
  },
  tipsTitle: {
    ...Typography.titleSmall,
    marginBottom: Spacing.md,
    color: Colors.text,
  },
  tipRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  tipBullet: {
    fontSize: 16,
    color: Colors.primary,
    marginRight: Spacing.sm,
  },
  tipText: {
    ...Typography.body,
    flex: 1,
    color: Colors.text,
  },
  areYouSure: {
    ...Typography.titleSmall,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    color: Colors.text,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
    backgroundColor: Colors.borderLight,
  },
  cancelButtonText: {
    ...Typography.button,
    color: Colors.text,
  },
  proceedButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
    backgroundColor: Colors.primary,
  },
  proceedButtonText: {
    ...Typography.button,
    color: "#fff",
  },
});
