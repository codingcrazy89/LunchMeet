import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Colors, Radius, Spacing, Typography } from "../constants/theme";
import StarRating from "./StarRating";

type RateAttendeeModalProps = {
  visible: boolean;
  attendeeName: string;
  rating: number;
  comment?: string;
  onRatingChange: (rating: number) => void;
  onCommentChange?: (comment: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  submitting?: boolean;
};

export default function RateAttendeeModal({
  visible,
  attendeeName,
  rating,
  comment = "",
  onRatingChange,
  onCommentChange,
  onSubmit,
  onClose,
  submitting = false,
}: RateAttendeeModalProps) {
  const needsComment = rating >= 1 && rating < 3;
  const canSubmit = rating >= 1 && (!needsComment || (comment?.trim()?.length ?? 0) > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate {attendeeName}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>How was your lunch meet experience?</Text>
          <StarRating value={rating} onChange={onRatingChange} />
          {needsComment && (
            <View style={styles.commentContainer}>
              <Text style={styles.commentLabel}>
                Please explain why (required for ratings under 3 stars)
              </Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Enter your reason..."
                placeholderTextColor={Colors.textMuted}
                value={comment ?? ""}
                onChangeText={onCommentChange ?? (() => {})}
                multiline
                numberOfLines={3}
              />
            </View>
          )}
          <View style={styles.buttons}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit || submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? "Submitting..." : "Submit Rating"}
              </Text>
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
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
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
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  commentContainer: {
    marginTop: Spacing.md,
  },
  commentLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
    backgroundColor: Colors.background,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  cancelButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  submitButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...Typography.button,
    color: "#fff",
  },
});
