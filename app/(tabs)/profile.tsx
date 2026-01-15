import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabase";

export default function Profile() {
  const [profile, setProfile] = useState<any>({
    name: "",
    age: "",
    gender: "",
    bio: "",
    photos: [],
    looking_for: [],
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    if (!user) return;

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
      const updatedProfile = {
        name: String(data.name || ""),
        age: data.age?.toString() ?? "",
        gender: String(data.gender || ""),
        bio: String(data.bio || ""),
        photos: Array.isArray(data.photos) ? data.photos : (data.photos ? [data.photos] : []),
        looking_for: Array.isArray(data.looking_for) ? data.looking_for : (data.looking_for ? [data.looking_for] : []),
      };
      console.log("Loading profile data:", updatedProfile);
      console.log("Name value from DB:", data.name);
      console.log("Name type:", typeof data.name);
      // Force a complete state replacement with functional update
      setProfile(() => ({ ...updatedProfile }));
      console.log("Profile state updated");
    } else {
      // If no profile exists, reset to empty
      setProfile({
        name: "",
        age: "",
        gender: "",
        bio: "",
        photos: [],
        looking_for: [],
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
    const fileName = `${Date.now()}.jpg`;
    let uploadData: any;

    if (Platform.OS === "web") {
      const response = await fetch(asset.uri);
      uploadData = await response.blob();
    } else {
      uploadData = {
        uri: asset.uri,
        name: fileName,
        type: "image/jpeg",
      };
    }

    const { data, error } = await supabase.storage
      .from("profile-photos")
      .upload(fileName, uploadData, {
        contentType: "image/jpeg",
      });

    if (error) {
      Alert.alert("Upload failed", error.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(data.path);

    setProfile((prev: any) => ({
      ...prev,
      photos: [...prev.photos, publicUrl],
    }));
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

      const profileData: any = {
        id: user.id,
        name: profile.name.trim() || null,
        age: Number(profile.age) || null,
        gender: profile.gender.trim() || null,
        bio: profile.bio.trim() || null,
        photos: profile.photos,
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
            <Image source={{ uri: url }} style={styles.photo} />

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

      <TextInput
        placeholder="Name"
        style={styles.input}
        value={profile.name || ""}
        onChangeText={(t) =>
          setProfile((prev: any) => ({ ...prev, name: t }))
        }
      />

      <TextInput
        placeholder="Age"
        keyboardType="numeric"
        style={styles.input}
        value={profile.age}
        onChangeText={(t) => {
          // Only allow numeric characters
          const numericValue = t.replace(/[^0-9]/g, '');
          setProfile({ ...profile, age: numericValue });
        }}
      />

      <TextInput
        placeholder="Gender"
        style={styles.input}
        value={profile.gender}
        onChangeText={(t) =>
          setProfile({ ...profile, gender: t })
        }
      />

      <TextInput
        placeholder="Short bio"
        style={[styles.input, { height: 80 }]}
        multiline
        value={profile.bio}
        onChangeText={(t) =>
          setProfile({ ...profile, bio: t })
        }
      />

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

      <Button
        title={saving ? "Saving..." : "Save Profile"}
        onPress={saveProfile}
        disabled={saving}
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
  container: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 12 },
  photoRow: { flexDirection: "row", flexWrap: "wrap" },
  photoWrapper: { marginRight: 10, marginBottom: 10 },
  photo: { width: 90, height: 90, borderRadius: 8 },
  controls: { flexDirection: "row", marginTop: 4 },
  controlBtn: {
    padding: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginRight: 4,
  },
  deleteBtn: { backgroundColor: "#EF4444" },
  addPhoto: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoText: { fontSize: 32 },
  addPhotoLabel: { fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  successMessage: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#d4edda",
    borderWidth: 1,
    borderColor: "#c3e6cb",
    borderRadius: 8,
  },
  successText: {
    color: "#155724",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  lookingForContainer: {
    marginBottom: 16,
  },
  lookingForLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  lookingForOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  lookingForOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  lookingForOptionSelected: {
    borderColor: "#0066cc",
    backgroundColor: "#0066cc",
  },
  lookingForOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  lookingForOptionTextSelected: {
    color: "#fff",
  },
});



