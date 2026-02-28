import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ProfilePhotoImage from "../../components/ProfilePhotoImage";
import StarRating from "../../components/StarRating";
import { Colors, Radius, Spacing, Typography } from "../../constants/theme";
import { useAuth } from "../../src/AuthContext";
import { useLunches } from "../../src/LunchContext";
import { supabase } from "../../src/lib/supabase";
import { preparePhotosForDisplay } from "../../src/utils/photoUrls";

type AttendeeToRate = {
  id: string;
  user_id: string;
  name: string;
  photoUrl?: string;
  rating: number;
};

export default function RateAttendeesScreen() {
  const params = useLocalSearchParams<{ lunchId: string }>();
  const lunchId = typeof params.lunchId === "string" ? params.lunchId : Array.isArray(params.lunchId) ? params.lunchId?.[0] : undefined;
  const router = useRouter();
  const { user } = useAuth();
  const { submitRating, fetchLunches } = useLunches();
  const [attendees, setAttendees] = useState<AttendeeToRate[]>([]);
  const [restaurant, setRestaurant] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!lunchId || !user?.id) return;
    setLoading(true);
    try {
      const { data: lunch, error: lunchError } = await supabase
        .from("lunches")
        .select("id, restaurant, host_id, co_host_id")
        .eq("id", lunchId)
        .single();

      if (lunchError || !lunch) {
        setLoading(false);
        router.back();
        return;
      }

      setRestaurant(lunch.restaurant || "the lunch");

      // Get all accepted attendees (host, co-host, accepted lunch_attendees)
      const { data: attendeesData } = await supabase
        .from("lunch_attendees")
        .select("id, user_id, status, profiles(id, name, photos)")
        .eq("lunch_id", lunchId);

      const hostId = lunch.host_id;
      const coHostId = lunch.co_host_id;
      const acceptedIds = new Set<string>();
      if (hostId) acceptedIds.add(hostId);
      if (coHostId) acceptedIds.add(coHostId);
      (attendeesData || []).forEach((a: any) => {
        if ((a.status === "accepted" || !a.status) && a.user_id) acceptedIds.add(a.user_id);
      });

      // Exclude current user
      acceptedIds.delete(user.id);

      if (acceptedIds.size === 0) {
        setAttendees([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for host/co-host if not in attendeesData
      const idsToFetch = Array.from(acceptedIds);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, photos")
        .in("id", idsToFetch);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Get existing ratings from current user for this lunch
      const { data: existingRatings } = await supabase
        .from("user_ratings")
        .select("rated_id, rating")
        .eq("rater_id", user.id)
        .eq("lunch_id", lunchId);

      const ratingMap = new Map(
        (existingRatings || []).map((r: any) => [r.rated_id, r.rating])
      );

      const attendeeList: AttendeeToRate[] = [];
      for (const uid of acceptedIds) {
        const p = profileMap.get(uid);
        const name = p?.name || "Unknown";
        const rawPhotos = Array.isArray(p?.photos) ? p.photos : p?.photos ? [p.photos] : [];
        const photos = rawPhotos.length ? await preparePhotosForDisplay(rawPhotos) : [];
        attendeeList.push({
          id: uid,
          user_id: uid,
          name,
          photoUrl: photos[0],
          rating: ratingMap.get(uid) || 0,
        });
      }

      setAttendees(attendeeList);
    } catch (err) {
      console.error("Error loading rate attendees:", err);
    } finally {
      setLoading(false);
    }
  }, [lunchId, user?.id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setRatingFor = (userId: string, rating: number) => {
    setAttendees((prev) =>
      prev.map((a) => (a.user_id === userId ? { ...a, rating } : a))
    );
  };

  const handleSubmit = async () => {
    if (!lunchId || !user) return;
    const toSubmit = attendees.filter((a) => a.rating >= 1 && a.rating <= 5);
    if (toSubmit.length === 0) return;

    setSubmitting(true);
    try {
      for (const a of toSubmit) {
        await submitRating(a.user_id, lunchId, a.rating);
      }
      fetchLunches();
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const allRated = attendees.length > 0 && attendees.every((a) => a.rating >= 1 && a.rating <= 5);
  const someRated = attendees.some((a) => a.rating >= 1 && a.rating <= 5);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Rate Attendees</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          How was your experience at {restaurant}? Rate each attendee 1–5 stars. Ratings are private and never shared.
        </Text>

        {attendees.length === 0 ? (
          <Text style={styles.emptyText}>No other attendees to rate.</Text>
        ) : (
          attendees.map((a) => (
            <View key={a.user_id} style={styles.attendeeRow}>
              <View style={styles.attendeeInfo}>
                {a.photoUrl ? (
                  <ProfilePhotoImage source={{ uri: a.photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{a.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.attendeeName}>{a.name}</Text>
              </View>
              <StarRating value={a.rating} onChange={(r) => setRatingFor(a.user_id, r)} />
            </View>
          ))
        )}

        {(someRated || allRated) && (
          <Pressable
            style={[styles.submitButton, (!allRated || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!allRated || submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? "Submitting..." : allRated ? "Submit All Ratings" : "Rate everyone to submit"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    ...Typography.bodySecondary,
    marginTop: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  backText: {
    ...Typography.body,
    color: Colors.link,
    fontWeight: "600",
  },
  title: {
    ...Typography.titleSmall,
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  subtitle: {
    ...Typography.bodySecondary,
    marginBottom: Spacing.xl,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: "center",
  },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  attendeeInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  attendeeName: {
    ...Typography.body,
    fontWeight: "500",
  },
  submitButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...Typography.button,
    color: "#fff",
  },
});
