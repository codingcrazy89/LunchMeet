import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabase";

function BrandHeader() {
  return (
    <View style={styles.brandHeader}>
      <Text style={styles.logo}>🍽️</Text>
      <Text style={styles.brandTitle}>Lunch Meet</Text>
    </View>
  );
}

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id]);

  const loadProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      // Normalize photos array
      const normalizedProfile = {
        ...data,
        photos: Array.isArray(data.photos) ? data.photos : (data.photos ? [data.photos] : []),
        looking_for: Array.isArray(data.looking_for) ? data.looking_for : (data.looking_for ? [data.looking_for] : []),
      };
      setProfile(normalizedProfile);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text>Profile not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <BrandHeader />
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Profile</Text>

      {/* Photos */}
      {profile.photos && profile.photos.length > 0 && (
        <View style={styles.photoRow}>
          {profile.photos.map((url: string, index: number) => (
            <View key={`${url}-${index}`} style={styles.photoWrapper}>
              <Image source={{ uri: url }} style={styles.photo} />
            </View>
          ))}
        </View>
      )}

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
  brandHeader: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0066cc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderBottomWidth: 2,
    borderColor: "#0052a3",
  },
  logo: {
    fontSize: 28,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F6F7FB",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  photoWrapper: {
    marginRight: 10,
    marginBottom: 10,
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: "#000",
  },
  lookingForContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  lookingForTag: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  lookingForText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
