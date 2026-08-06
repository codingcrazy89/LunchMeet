import { useEffect, useRef } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors, Radius, Spacing, Typography } from "../constants/theme";
import { useAppLog } from "../src/AppLogContext";

export default function LogViewerModal() {
  const { logs, clearLogs, closeLogViewer, logViewerVisible } = useAppLog();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (logViewerVisible) {
      console.log("[Logs] Debug log viewer opened - logs appear here as you use the app");
    }
  }, [logViewerVisible]);

  useEffect(() => {
    if (logViewerVisible && logs.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [logViewerVisible, logs.length]);

  if (!logViewerVisible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Debug logs</Text>
            <View style={styles.buttons}>
              <Pressable style={styles.button} onPress={clearLogs}>
                <Text style={styles.buttonText}>Clear</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.closeButton]} onPress={closeLogViewer}>
                <Text style={styles.buttonText}>Close</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {logs.length === 0 ? (
              <Text style={styles.empty}>No logs yet. Use the app to see workflow and errors.</Text>
            ) : (
              logs.map((entry) => (
                <Text
                  key={entry.id}
                  style={[
                    styles.line,
                    entry.level === "error" && styles.lineError,
                    entry.level === "warn" && styles.lineWarn,
                  ]}
                  selectable
                >
                  {entry.message}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#1e293b",
    maxHeight: "80%",
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: {
    ...Typography.titleSmall,
    color: "#fff",
  },
  buttons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  button: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#334155",
    borderRadius: Radius.md,
  },
  closeButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  scroll: { maxHeight: 400 },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: 14,
    fontStyle: "italic",
  },
  line: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#cbd5e1",
    marginBottom: 4,
  },
  lineError: { color: "#f87171" },
  lineWarn: { color: "#fbbf24" },
});
