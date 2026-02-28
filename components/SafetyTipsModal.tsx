import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors, Radius, Spacing, Typography } from "../constants/theme";
import { SAFETY_TIPS, SAFETY_WARNING } from "../constants/safetyTips";

type SafetyTipsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function SafetyTipsModal({ visible, onClose }: SafetyTipsModalProps) {
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
            <Text style={styles.title}>Safety Tips</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
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
          </ScrollView>
          <Pressable style={styles.gotItButton} onPress={onClose}>
            <Text style={styles.gotItButtonText}>Got it</Text>
          </Pressable>
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
    paddingBottom: Spacing.xl,
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
  gotItButton: {
    margin: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  gotItButtonText: {
    ...Typography.button,
    color: "#fff",
  },
});
