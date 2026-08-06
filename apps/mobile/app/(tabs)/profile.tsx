import { readAsStringAsync } from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
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
import ProfilePhotoImage from "../../components/ProfilePhotoImage";
import SafetyTipsModal from "../../components/SafetyTipsModal";
import ZoomableImage from "../../components/ZoomableImage";
import { Colors, Radius, Shadows, Spacing, Typography } from "../../constants/theme";
import { supabase } from "../../src/lib/supabase";
import { preparePhotosForDisplay, toPublicPhotoUrls } from "../../src/utils/photoUrls";

export default function Profile() {
  const [profile, setProfile] = useState<any>({
    name: "",
    age: "",
    gender: "",
    bio: "",
    photos: [],
    looking_for: [],
    social_media_url: "",
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [showSafetyTips, setShowSafetyTips] = useState(false);

  useEffect(() => {
    loadProfile();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== "web") {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
  };

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.log("No user found");
      return;
    }

    console.log("Loading profile for user:", user.id);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error loading profile:", error);
      return;
    }

    if (data) {
      const rawPhotos = Array.isArray(data.photos) ? data.photos : (data.photos ? [data.photos] : []);
      const photos = await preparePhotosForDisplay(rawPhotos);

      const updatedProfile = {
        name: String(data.name || ""),
        age: data.age?.toString() ?? "",
        gender: String(data.gender || ""),
        bio: String(data.bio || ""),
        photos,
        looking_for: Array.isArray(data.looking_for) ? data.looking_for : (data.looking_for ? [data.looking_for] : []),
        social_media_url: String(data.social_media_url || ""),
      };
      setProfile(() => ({ ...updatedProfile }));
    } else {
      // If no profile exists, reset to empty
      console.log("No profile data found, resetting to empty");
      setProfile({
        name: "",
        age: "",
        gender: "",
        bio: "",
        photos: [],
        looking_for: [],
        social_media_url: "",
      });
    }
  };

  const uploadPhoto = async () => {
    if (profile.photos.length >= 3) {
      Alert.alert("Limit reached", "Maximum 3 photos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    let dataUri: string;

    if (Platform.OS === "web") {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      dataUri = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onloadend = () => res((reader.result as string) || "");
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });
    } else {
      const base64 = await readAsStringAsync(asset.uri, { encoding: "base64" });
      dataUri = `data:image/jpeg;base64,${base64}`;
    }

    const newPhotos = [...profile.photos, dataUri];
    setProfile((prev: any) => ({ ...prev, photos: newPhotos }));

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "You must be logged in to save photos");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ photos: newPhotos })
      .eq("id", user.id);

    if (updateError) {
      Alert.alert("Upload OK", "Photo added, but save failed: " + updateError.message);
    } else {
      Alert.alert("Success", "Photo added and saved!");
    }
  };

  const deletePhoto = (index: number) => {
    setProfile((prev: any) => ({
      ...prev,
      photos: prev.photos.filter(
        (_: string, i: number) => i !== index
      ),
    }));
  };

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= profile.photos.length) return;

    const updated = [...profile.photos];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);

    setProfile((prev: any) => ({
      ...prev,
      photos: updated,
    }));
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        if (Platform.OS === "web") {
          alert("You must be logged in to save your profile");
        } else {
          Alert.alert("Error", "You must be logged in to save your profile");
        }
        return;
      }

      // Always save public URLs to DB (never signed URLs - they expire)
      const photosToSave = toPublicPhotoUrls(profile.photos);
      const profileData: any = {
        id: user.id,
        name: profile.name.trim() || null,
        age: Number(profile.age) || null,
        gender: profile.gender.trim() || null,
        bio: profile.bio.trim() || null,
        photos: photosToSave,
        social_media_url: profile.social_media_url?.trim() || null,
      };
      
      // Only include looking_for if the column exists (will be added via SQL migration)
      // For now, we'll try to include it and handle the error gracefully
      if (profile.looking_for && Array.isArray(profile.looking_for)) {
        profileData.looking_for = profile.looking_for;
      }
      
      console.log("Saving profile data:", profileData);
      
      const { error } = await supabase.from("profiles").upsert(profileData);

      if (error) {
        console.error("Save error:", error);
        setSaving(false);
        const errorMsg = "Failed to save profile: " + error.message;
        if (Platform.OS === "web") {
          alert(errorMsg);
        } else {
          Alert.alert("Error", errorMsg);
        }
        return;
      }

      console.log("Profile saved successfully, reloading...");

      // Small delay to ensure database update is complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // 🔑 CRITICAL FIX — reload from Supabase to get updated values
      await loadProfile();

      setSaving(false);
      setSaveSuccess(true);
      console.log("Success message should appear, saveSuccess:", true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        console.log("Hiding success message");
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error("Unexpected error saving profile:", err);
      setSaving(false);
      const errorMsg = "An unexpected error occurred: " + (err.message || String(err));
      if (Platform.OS === "web") {
        alert(errorMsg);
      } else {
        Alert.alert("Error", errorMsg);
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      <View style={styles.photoRow}>
        {profile.photos.map((url: string, index: number) => (
          <View key={url} style={styles.photoWrapper}>
            <Pressable onPress={() => setEnlargedPhoto(url)}>
              <ProfilePhotoImage source={{ uri: url }} style={styles.photo} />
            </Pressable>

            <View style={styles.controls}>
              <Pressable
                onPress={() => movePhoto(index, index - 1)}
                style={styles.controlBtn}
              >
                <Text>⬅</Text>
              </Pressable>

              <Pressable
                onPress={() => movePhoto(index, index + 1)}
                style={styles.controlBtn}
              >
                <Text>➡</Text>
              </Pressable>

              <Pressable
                onPress={() => deletePhoto(index)}
                style={[styles.controlBtn, styles.deleteBtn]}
              >
                <Text style={{ color: "white" }}>✕</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {profile.photos.length < 3 && (
          <Pressable
            style={styles.addPhoto}
            onPress={uploadPhoto}
          >
            <Text style={styles.addPhotoText}>＋</Text>
            <Text style={styles.addPhotoLabel}>Add Photo</Text>
          </Pressable>
        )}
      </View>

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

      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          placeholder="Enter your name"
          style={styles.input}
          value={profile.name || ""}
          onChangeText={(t) =>
            setProfile((prev: any) => ({ ...prev, name: t }))
          }
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Age</Text>
        <TextInput
          placeholder="Enter your age"
          keyboardType="numeric"
          style={styles.input}
          value={profile.age}
          onChangeText={(t) => {
            const numericValue = t.replace(/[^0-9]/g, '');
            setProfile({ ...profile, age: numericValue });
          }}
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Gender</Text>
        <TextInput
          placeholder="Enter your gender"
          style={styles.input}
          value={profile.gender}
          onChangeText={(t) =>
            setProfile({ ...profile, gender: t })
          }
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Short bio</Text>
        <TextInput
          placeholder="Tell others a bit about yourself"
          style={[styles.input, { height: 80 }]}
          multiline
          value={profile.bio}
          onChangeText={(t) =>
            setProfile({ ...profile, bio: t })
          }
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Social media link</Text>
        <TextInput
          placeholder="e.g. https://instagram.com/yourprofile"
          style={styles.input}
          value={profile.social_media_url || ""}
          onChangeText={(t) =>
            setProfile({ ...profile, social_media_url: t })
          }
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>

      <View style={styles.lookingForContainer}>
        <Text style={styles.lookingForLabel}>Looking For</Text>
        <View style={styles.lookingForOptions}>
          {["Networking", "Friendship", "Dating"].map((option) => {
            const isSelected = profile.looking_for?.includes(option);
            return (
              <Pressable
                key={option}
                onPress={() => {
                  const current = profile.looking_for || [];
                  const updated = isSelected
                    ? current.filter((item: string) => item !== option)
                    : [...current, option];
                  setProfile({ ...profile, looking_for: updated });
                }}
                style={[
                  styles.lookingForOption,
                  isSelected && styles.lookingForOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.lookingForOptionText,
                    isSelected && styles.lookingForOptionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveProfile}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Profile"}</Text>
      </Pressable>

      <Pressable
        style={styles.safetyTipsButton}
        onPress={() => setShowSafetyTips(true)}
      >
        <Text style={styles.safetyTipsButtonText}>View Safety Tips</Text>
      </Pressable>

      <SafetyTipsModal
        visible={showSafetyTips}
        onClose={() => setShowSafetyTips(false)}
      />

      {saveSuccess && (
        <View style={styles.successMessage}>
          <Text style={styles.successText}>✓ Profile saved successfully!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  title: {
    ...Typography.title,
    fontSize: 28,
    marginBottom: Spacing.lg,
    color: Colors.text,
  },
  photoRow: { flexDirection: "row", flexWrap: "wrap" },
  photoWrapper: { marginRight: Spacing.md, marginBottom: Spacing.md },
  photo: { width: 110, height: 110, borderRadius: Radius.lg },
  controls: { flexDirection: "row", marginTop: Spacing.sm },
  controlBtn: {
    padding: Spacing.sm,
    backgroundColor: Colors.border,
    borderRadius: Radius.sm,
    marginRight: Spacing.sm,
  },
  deleteBtn: { backgroundColor: Colors.destructive },
  addPhoto: {
    width: 110,
    height: 110,
    borderRadius: Radius.lg,
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoText: { fontSize: 38, color: Colors.textSecondary },
  addPhotoLabel: { ...Typography.body, fontWeight: "500", color: Colors.textSecondary },
  fieldContainer: { marginBottom: Spacing.lg },
  fieldLabel: {
    ...Typography.titleSmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    fontSize: 16,
    backgroundColor: Colors.surface,
  },
  saveButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: "center",
    ...Shadows.button,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: {
    color: "#fff",
    ...Typography.button,
  },
  successMessage: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: Radius.md,
  },
  successText: {
    color: "#065f46",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  safetyTipsButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  safetyTipsButtonText: {
    ...Typography.body,
    color: Colors.link,
    fontWeight: "500",
  },
  lookingForContainer: { marginBottom: Spacing.xl },
  lookingForLabel: {
    ...Typography.titleSmall,
    marginBottom: Spacing.md,
  },
  lookingForOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  lookingForOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  lookingForOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  lookingForOptionText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.text,
  },
  lookingForOptionTextSelected: { color: "#fff" },
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



