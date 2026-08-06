import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ReportUserModal from "../../components/ReportUserModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProfilePhotoImage from "../../components/ProfilePhotoImage";
import ZoomableImage from "../../components/ZoomableImage";
import { Colors, Radius, Spacing, Typography } from "../../constants/theme";
import { useAuth } from "../../src/AuthContext";
import { useContacts } from "../../src/ContactsContext";
import { supabase } from "../../src/lib/supabase";
import { preparePhotosForDisplay } from "../../src/utils/photoUrls";

/** Infer platform label from social media URL for badge display */
function getSocialPlatformLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com")) return "View Instagram";
  if (lower.includes("linkedin.com")) return "View LinkedIn";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "View X";
  if (lower.includes("facebook.com")) return "View Facebook";
  if (lower.includes("tiktok.com")) return "View TikTok";
  return "View profile";
}

function BrandHeader({ topInset = 0 }: { topInset?: number }) {
  return (
    <View style={[styles.brandHeader, { paddingTop: 12 + topInset }]}>
      <Image 
        source={require("../../assets/images/logo.png")} 
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.brandTitle}>Lunch Meet</Text>
    </View>
  );
}

export default function PublicProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { invalidateContacts } = useContacts();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [isContact, setIsContact] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportComment, setReportComment] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    return <Redirect href="/login" />;
  }

  useEffect(() => {
    if (id) {
      loadProfile();
      checkIsContact();
    }
  }, [id, user?.id]);

  const checkIsContact = async () => {
    if (!user?.id || !id || id === user.id) return;
    const { data } = await supabase
      .from("user_contacts")
      .select("id")
      .eq("user_id", user.id)
      .eq("contact_id", id)
      .maybeSingle();
    setIsContact(!!data);
  };

  const addContact = async () => {
    if (!user?.id || !id || id === user.id || addingContact || isContact) return;
    setAddingContact(true);
    const { error } = await supabase.from("user_contacts").insert({
      user_id: user.id,
      contact_id: id,
    });
    setAddingContact(false);
    if (error) {
      if (Platform.OS === "web") {
        window.alert("Could not add contact: " + error.message);
      } else {
        Alert.alert("Error", "Could not add contact: " + error.message);
      }
      return;
    }
    setIsContact(true);
    invalidateContacts();
  };

  const handleReportPress = () => {
    setReportComment("");
    setReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!user?.id || !id || id === user.id || reportSubmitting) return;
    const comment = reportComment.trim();
    if (comment.split(/\s+/).filter(Boolean).length < 50) return;

    setReportSubmitting(true);
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_id: id,
      comment,
    });
    setReportSubmitting(false);

    if (error) {
      if (Platform.OS === "web") {
        window.alert("Could not submit report: " + error.message);
      } else {
        Alert.alert("Error", "Could not submit report: " + error.message);
      }
      return;
    }
    setReportModalVisible(false);
    setReportComment("");
    if (Platform.OS === "web") {
      window.alert("Report submitted. Thank you for helping keep LunchMeet safe.");
    } else {
      Alert.alert("Report Submitted", "Thank you for helping keep LunchMeet safe.");
    }
  };

  const handleAddContactPress = () => {
    if (isContact || addingContact) return;
    const name = profile?.name || "this user";
    const message = `Add ${name} to your contact list? They will appear when you create private lunches.`;
    if (Platform.OS === "web") {
      if (window.confirm(`${message}\n\nClick OK to add, Cancel to dismiss.`)) {
        addContact();
      }
    } else {
      Alert.alert("Add Contact", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Add", onPress: addContact },
      ]);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      const rawPhotos = Array.isArray(data.photos) ? data.photos : (data.photos ? [data.photos] : []);
      const photos = await preparePhotosForDisplay(rawPhotos);
      const normalizedProfile = {
        ...data,
        photos,
        looking_for: Array.isArray(data.looking_for) ? data.looking_for : (data.looking_for ? [data.looking_for] : []),
      };
      setProfile(normalizedProfile);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.fullScreen}>
        <Text style={[Typography.bodySecondary, { color: Colors.textMuted }]}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.fullScreen}>
        <Text style={[Typography.bodySecondary, { color: Colors.textMuted }]}>Profile not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <BrandHeader topInset={insets.top} />
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

      {/* Photos */}
      {profile.photos && profile.photos.length > 0 && (
        <View style={styles.photoRow}>
          {profile.photos.map((url: string, index: number) => (
            <Pressable 
              key={`${url}-${index}`} 
              style={styles.photoWrapper}
              onPress={() => setEnlargedPhoto(url)}
            >
              <ProfilePhotoImage source={{ uri: url }} style={styles.photo} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Photo Enlargement Modal */}
      <Modal
        visible={!!enlargedPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEnlargedPhoto(null)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setEnlargedPhoto(null)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {enlargedPhoto && (
              <ZoomableImage uri={enlargedPhoto} style={styles.enlargedPhoto} />
            )}
            <Pressable 
              style={styles.closeButton}
              onPress={() => setEnlargedPhoto(null)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Name */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>
          {profile.name || "Not provided"}
        </Text>
      </View>

      {/* Age */}
      {profile.age && (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Age</Text>
          <Text style={styles.value}>{profile.age}</Text>
        </View>
      )}

      {/* Gender */}
      {profile.gender && (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Gender</Text>
          <Text style={styles.value}>{profile.gender}</Text>
        </View>
      )}

      {/* Bio */}
      {profile.bio && (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Bio</Text>
          <Text style={styles.value}>{profile.bio}</Text>
        </View>
      )}

      {/* Looking For */}
      {profile.looking_for && profile.looking_for.length > 0 && (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Looking For</Text>
          <View style={styles.lookingForContainer}>
            {profile.looking_for.map((item: string, index: number) => (
              <View key={index} style={styles.lookingForTag}>
                <Text style={styles.lookingForText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Social Media Badge */}
      {profile.social_media_url && (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Connect</Text>
          <Pressable
            style={styles.socialBadge}
            onPress={() => {
              const url = profile.social_media_url.startsWith("http") ? profile.social_media_url : `https://${profile.social_media_url}`;
              Linking.openURL(url);
            }}
          >
            <Text style={styles.socialBadgeIcon}>🔗</Text>
            <Text style={styles.socialBadgeText}>
              {getSocialPlatformLabel(profile.social_media_url)}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Add Contact - only when viewing another user's profile */}
      {user?.id && id && id !== user.id && (
        <View style={styles.addContactContainer}>
          <Pressable
            onPress={handleAddContactPress}
            disabled={isContact || addingContact}
            style={[
              styles.addContactButton,
              (isContact || addingContact) && styles.addContactButtonDisabled,
            ]}
          >
            <Text style={styles.addContactButtonText}>
              {addingContact ? "Adding…" : isContact ? "In contacts" : "Add Contact"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleReportPress}
            style={styles.reportButton}
          >
            <Text style={styles.reportButtonText}>Report</Text>
          </Pressable>
        </View>
      )}
      </ScrollView>

      <ReportUserModal
        visible={reportModalVisible}
        reportedName={profile?.name ?? "this user"}
        comment={reportComment}
        onCommentChange={setReportComment}
        onSubmit={submitReport}
        onClose={() => {
          setReportModalVisible(false);
          setReportComment("");
        }}
        submitting={reportSubmitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  wrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  brandHeader: {
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  logo: { width: 40, height: 40 },
  brandTitle: {
    ...Typography.title,
    fontSize: 24,
    color: "#fff",
    letterSpacing: 0.5,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.link,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  title: {
    ...Typography.title,
    fontSize: 28,
    marginBottom: Spacing.xl,
    color: Colors.text,
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: Spacing.xxl,
  },
  photoWrapper: {
    marginRight: Spacing.md,
    marginBottom: Spacing.md,
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: Radius.lg,
  },
  fieldContainer: { marginBottom: Spacing.xl },
  label: {
    ...Typography.titleSmall,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  value: {
    fontSize: 20,
    color: Colors.text,
    lineHeight: 28,
  },
  lookingForContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },
  lookingForTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  lookingForText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  socialBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  socialBadgeIcon: {
    fontSize: 20,
  },
  socialBadgeText: {
    ...Typography.button,
    color: Colors.link,
    fontSize: 16,
  },
  addContactContainer: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    alignItems: "center",
  },
  addContactButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    alignItems: "center",
  },
  addContactButtonDisabled: {
    backgroundColor: Colors.textMuted,
    opacity: 0.8,
  },
  addContactButtonText: {
    ...Typography.button,
    color: "#fff",
    fontSize: 14,
  },
  reportButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "transparent",
    borderRadius: Radius.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.error,
  },
  reportButtonText: {
    ...Typography.button,
    color: Colors.error,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.88)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "90%",
    height: "70%",
    justifyContent: "center",
    alignItems: "center",
  },
  enlargedPhoto: { width: "100%", height: "100%" },
  closeButton: {
    position: "absolute",
    top: Spacing.xl,
    right: Spacing.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
  },
});
