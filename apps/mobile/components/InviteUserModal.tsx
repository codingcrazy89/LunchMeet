import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Colors, Radius, Spacing, Typography } from "../constants/theme";
import { useAuth } from "../src/AuthContext";
import { supabase } from "../src/lib/supabase";

type InviteUserModalProps = {
  visible: boolean;
  lunchId: string;
  lunchRestaurant: string;
  onClose: () => void;
  onInviteSent: () => void;
};

type SearchResult = { id: string; name: string; email: string };

export default function InviteUserModal({
  visible,
  lunchId,
  lunchRestaurant,
  onClose,
  onInviteSent,
}: InviteUserModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSearch("");
    setResults([]);
  }, [visible]);

  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.rpc("search_users_by_email", { p_search: search });
      let list = Array.isArray(data) ? data : [];
      if (user) {
        list = list.filter((r) => r.id !== user.id);
      }
      setResults(list);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, visible, user?.id]);

  const handleInvite = async (inviteeId: string) => {
    if (!user) return;
    setSending(inviteeId);
    const { error } = await supabase.from("lunch_invites").insert({
      lunch_id: lunchId,
      inviter_id: user.id,
      invitee_id: inviteeId,
      status: "pending",
    });
    setSending(null);
    if (!error) {
      onInviteSent();
      onClose();
    } else {
      const msg = error.code === "23505" ? "This person was already invited." : error.message;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Invite failed", msg);
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Invite to lunch</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{lunchRestaurant}</Text>
          <TextInput
            style={styles.input}
            placeholder="Search by email..."
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {results.map((r) => (
              <Pressable
                key={r.id}
                style={styles.resultItem}
                onPress={() => handleInvite(r.id)}
                disabled={!!sending}
              >
                <View>
                  <Text style={styles.resultName}>{r.name}</Text>
                  <Text style={styles.resultEmail}>{r.email}</Text>
                </View>
                <Text style={styles.inviteButton}>
                  {sending === r.id ? "Sending..." : "Invite"}
                </Text>
              </Pressable>
            ))}
            {search.length >= 2 && !loading && results.length === 0 && (
              <Text style={styles.noResults}>No users found</Text>
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
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.title,
    color: Colors.text,
  },
  closeButton: { padding: Spacing.sm },
  closeButtonText: { fontSize: 24, color: Colors.textSecondary, fontWeight: "600" },
  subtitle: {
    ...Typography.bodySecondary,
    marginBottom: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  loadingText: { ...Typography.bodySecondary },
  results: { maxHeight: 250 },
  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  resultName: { ...Typography.body, fontWeight: "500" },
  resultEmail: { ...Typography.caption },
  inviteButton: {
    ...Typography.buttonSmall,
    color: Colors.primary,
  },
  noResults: {
    ...Typography.bodySecondary,
    padding: Spacing.lg,
    textAlign: "center",
  },
});
