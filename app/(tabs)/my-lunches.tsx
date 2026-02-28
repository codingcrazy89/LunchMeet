import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import RateAttendeeModal from "../../components/RateAttendeeModal";
import { Colors, Radius, Shadows, Spacing, Typography } from "../../constants/theme";
import { useAuth } from "../../src/AuthContext";
import { useLunches } from "../../src/LunchContext";

export default function MyLunchesScreen() {
  const router = useRouter();
  const { lunches, loading, acceptRequest, denyRequest, closeLunch, submitRating, fetchLunches } = useLunches();
  const { user } = useAuth();
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [ratingModal, setRatingModal] = useState<{ lunchId: string; attendeeId: string; attendeeName: string } | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading your lunches…</Text>
      </View>
    );
  }

  const myLunches = lunches.filter(
    (lunch) => lunch.host_id === user?.id || lunch.co_host_id === user?.id
  );

  if (myLunches.length === 0) {
    return (
      <View style={styles.center}>
        <Text>You are not hosting or co-hosting any lunches.</Text>
      </View>
    );
  }

  // Format date and time for display
  const formatDateTime = (dateTimeString: string) => {
    if (!dateTimeString) return "Date TBD"
    try {
      const date = new Date(dateTimeString)
      return date.toLocaleString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    } catch {
      return dateTimeString
    }
  }

  const isLunchPast = (dateTime: string) => new Date(dateTime) < new Date();

  // Link to Google Search results for this restaurant
  const getGoogleSearchUrl = (lunch: any) => {
    const query = lunch.restaurant_address
      ? `${lunch.restaurant} ${lunch.restaurant_address}`
      : lunch.restaurant;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {myLunches.map((lunch) => (
        <View key={lunch.id} style={styles.card}>
          <Pressable
            onPress={() => Linking.openURL(getGoogleSearchUrl(lunch))}
          >
            <Text style={styles.titleLink}>{lunch.restaurant}</Text>
            {lunch.restaurant_address ? (
              <Text style={styles.restaurantAddress}>{lunch.restaurant_address}</Text>
            ) : null}
          </Pressable>
          <Text style={styles.dateTime}>{formatDateTime(lunch.date_time)}</Text>
          <View style={styles.hostContainer}>
            <Text style={styles.hostLabel}>Host: </Text>
            <Pressable
              onPress={() => router.push(`/profile/${lunch.host_id}`)}
            >
              <Text style={styles.hostLink}>
                {lunch.host_profile?.name || "Unknown user"}
              </Text>
            </Pressable>
          </View>
          {lunch.co_host_id && (
            <View style={styles.hostContainer}>
              <Text style={styles.hostLabel}>Co-host: </Text>
              <Pressable
                onPress={() => router.push(`/profile/${lunch.co_host_id}`)}
              >
                <Text style={styles.hostLink}>
                  {lunch.co_host_profile?.name || "Unknown user"}
                </Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.seats}>Seats left: {lunch.seats}</Text>

          {/* Pending Requests */}
          {(() => {
            const pendingRequests = lunch.lunch_attendees.filter((a) => a.status === "pending");
            if (pendingRequests.length > 0) {
              return (
                <View style={styles.pendingContainer}>
                  <Text style={styles.pendingTitle}>Pending Requests</Text>
                  {pendingRequests.map((request) => (
                    <View key={request.id} style={styles.pendingRequest}>
                      <Pressable
                        onPress={() => router.push(`/profile/${request.user_id}`)}
                      >
                        <Text style={styles.pendingNameLink}>
                          {request.profile?.name ?? "Unknown user"}
                        </Text>
                      </Pressable>
                      <View style={styles.requestButtons}>
                        <Pressable
                          style={[
                            styles.requestButton,
                            styles.acceptButton,
                            processingRequest === request.id && styles.requestButtonDisabled
                          ]}
                          onPress={async () => {
                            console.log("Accept button clicked for request:", request.id);
                            setProcessingRequest(request.id);
                            try {
                              await acceptRequest(lunch.id, request.id);
                            } catch (error) {
                              console.error("Error in accept handler:", error);
                            } finally {
                              setProcessingRequest(null);
                            }
                          }}
                          disabled={processingRequest === request.id}
                        >
                          <Text style={styles.requestButtonText}>
                            {processingRequest === request.id ? "Processing..." : "Accept"}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.requestButton,
                            styles.denyButton,
                            processingRequest === request.id && styles.requestButtonDisabled
                          ]}
                          onPress={async () => {
                            console.log("Deny button clicked for request:", request.id);
                            setProcessingRequest(request.id);
                            try {
                              await denyRequest(lunch.id, request.id);
                            } catch (error) {
                              console.error("Error in deny handler:", error);
                            } finally {
                              setProcessingRequest(null);
                            }
                          }}
                          disabled={processingRequest === request.id}
                        >
                          <Text style={styles.requestButtonText}>
                            {processingRequest === request.id ? "Processing..." : "Deny"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              );
            }
            return null;
          })()}

          <View style={styles.attendees}>
            <Text style={styles.attendeeTitle}>
              Attendees ({lunch.lunch_attendees.filter((a) => a.status === "accepted" || !a.status).length})
            </Text>

            {lunch.lunch_attendees
              .filter((a) => a.status === "accepted" || !a.status)
              .map((a) => (
                <View key={a.id} style={styles.attendeeRow}>
                  <Pressable
                    onPress={() => router.push(`/profile/${a.user_id}`)}
                    style={{ flex: 1 }}
                  >
                    <Text style={styles.attendeeItemLink}>
                      • {a.profile?.name ?? "Unknown user"}
                    </Text>
                  </Pressable>
                  {isLunchPast(lunch.date_time) && (
                    <Pressable
                      style={styles.rateButton}
                      onPress={() => setRatingModal({
                        lunchId: lunch.id,
                        attendeeId: a.user_id!,
                        attendeeName: a.profile?.name ?? "Unknown user",
                      })}
                    >
                      <Text style={styles.rateButtonText}>Rate</Text>
                    </Pressable>
                  )}
                </View>
              ))}
          </View>

          <View style={styles.buttonContainer}>
            <Pressable
              style={styles.chatButton}
              onPress={() => router.push({
                pathname: "/(tabs)/chat",
                params: { lunchId: lunch.id }
              })}
            >
              <Text style={styles.chatButtonText}>Open Chat</Text>
            </Pressable>
            <View style={styles.buttonSpacer} />
            <Pressable
              style={styles.closeButton}
              onPress={() => {
                if (Platform.OS === "web") {
                  if (window.confirm("Are you sure you want to close this lunch meet? This cannot be undone.")) {
                    closeLunch(lunch);
                  }
                } else {
                  Alert.alert(
                    "Close Lunch",
                    "Are you sure you want to close this lunch meet? This cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Close Lunch",
                        style: "destructive",
                        onPress: () => closeLunch(lunch),
                      },
                    ]
                  );
                }
              }}
            >
              <Text style={styles.closeButtonText}>Close Lunch</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <RateAttendeeModal
        visible={!!ratingModal}
        attendeeName={ratingModal?.attendeeName ?? ""}
        rating={ratingValue}
        onRatingChange={setRatingValue}
        onSubmit={async () => {
          if (!ratingModal) return;
          setRatingSubmitting(true);
          const ok = await submitRating(ratingModal.attendeeId, ratingModal.lunchId, ratingValue);
          setRatingSubmitting(false);
          if (ok) {
            setRatingModal(null);
            setRatingValue(0);
          }
        }}
        onClose={() => {
          setRatingModal(null);
          setRatingValue(0);
        }}
        submitting={ratingSubmitting}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  card: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  title: { ...Typography.titleSmall },
  titleLink: {
    ...Typography.titleSmall,
    color: Colors.link,
  },
  restaurantAddress: {
    ...Typography.bodySecondary,
    marginTop: 2,
  },
  dateTime: { 
    ...Typography.bodySecondary,
    marginTop: 4,
    marginBottom: Spacing.sm,
  },
  hostContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  hostLabel: { ...Typography.bodySecondary },
  hostLink: {
    ...Typography.bodySecondary,
    color: Colors.link,
    fontWeight: "500",
  },
  seats: {
    ...Typography.bodySecondary,
    marginBottom: 4,
  },
  attendees: { marginTop: Spacing.md },
  attendeeTitle: { ...Typography.label },
  attendeeItem: { ...Typography.caption },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  attendeeItemLink: {
    ...Typography.caption,
    color: Colors.link,
  },
  rateButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
  },
  rateButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  pendingContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  pendingTitle: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
    color: "#92400e",
  },
  pendingRequest: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning,
  },
  pendingName: { flex: 1, fontSize: 14 },
  pendingNameLink: {
    flex: 1,
    fontSize: 14,
    color: Colors.link,
    fontWeight: "500",
  },
  requestButtons: { flexDirection: "row", gap: Spacing.sm },
  requestButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  acceptButton: { backgroundColor: Colors.success },
  denyButton: { backgroundColor: Colors.destructive },
  requestButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  requestButtonDisabled: { opacity: 0.6 },
  buttonContainer: { marginTop: Spacing.sm, marginBottom: 4 },
  buttonSpacer: { height: Spacing.sm },
  chatButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignSelf: "flex-start",
  },
  chatButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  closeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.destructive,
    borderRadius: Radius.md,
    alignSelf: "flex-start",
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
});




