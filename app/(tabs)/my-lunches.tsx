import {
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Linking } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/AuthContext";
import { useLunches } from "../../src/LunchContext";

export default function MyLunchesScreen() {
  const router = useRouter();
  const { lunches, loading, acceptRequest, denyRequest, closeLunch } = useLunches();
  const { user } = useAuth();
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading your lunches…</Text>
      </View>
    );
  }

  const myLunches = lunches.filter(
    (lunch) => lunch.host_id === user?.id
  );

  if (myLunches.length === 0) {
    return (
      <View style={styles.center}>
        <Text>You are not hosting any lunches.</Text>
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

  // Create Google Maps URL
  const getGoogleMapsUrl = (lunch: any) => {
    if (lunch.place_id) {
      return `https://www.google.com/maps/place/?q=place_id:${lunch.place_id}`;
    } else if (lunch.restaurant_address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lunch.restaurant_address)}`;
    } else {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lunch.restaurant)}`;
    }
  };

  return (
    <ScrollView style={styles.container}>
      {myLunches.map((lunch) => (
        <View key={lunch.id} style={styles.card}>
          <Pressable
            onPress={() => Linking.openURL(getGoogleMapsUrl(lunch))}
          >
            <Text style={styles.titleLink}>{lunch.restaurant}</Text>
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
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/profile/${a.user_id}`)}
                >
                  <Text style={styles.attendeeItemLink}>
                    • {a.profile?.name ?? "Unknown user"}
                  </Text>
                </Pressable>
              ))}
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title="Open Chat"
              onPress={() => router.push({
                pathname: "/(tabs)/chat",
                params: { lunchId: lunch.id }
              })}
            />
            <View style={styles.buttonSpacer} />
            <Button
              title="Close Lunch"
              color="#c62828"
              onPress={() => closeLunch(lunch)}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "600" },
  titleLink: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0066cc",
    textDecorationLine: "underline",
  },
  dateTime: { 
    fontSize: 14, 
    color: "#666", 
    marginTop: 4,
    marginBottom: 8,
  },
  hostContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  hostLabel: {
    fontSize: 14,
    color: "#666",
  },
  hostLink: {
    fontSize: 14,
    color: "#0066cc",
    textDecorationLine: "underline",
    fontWeight: "500",
  },
  seats: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  attendees: { marginTop: 12 },
  attendeeTitle: { fontWeight: "600" },
  attendeeItem: { fontSize: 12 },
  attendeeItemLink: {
    fontSize: 12,
    color: "#0066cc",
    textDecorationLine: "underline",
  },
  pendingContainer: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#fff3cd",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffc107",
  },
  pendingTitle: {
    fontWeight: "600",
    marginBottom: 8,
    color: "#856404",
  },
  pendingRequest: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ffc107",
  },
  pendingName: {
    flex: 1,
    fontSize: 14,
  },
  pendingNameLink: {
    flex: 1,
    fontSize: 14,
    color: "#0066cc",
    textDecorationLine: "underline",
    fontWeight: "500",
  },
  requestButtons: {
    flexDirection: "row",
    gap: 8,
  },
  requestButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  acceptButton: {
    backgroundColor: "#28a745",
  },
  denyButton: {
    backgroundColor: "#dc3545",
  },
  requestButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  requestButtonDisabled: {
    opacity: 0.6,
  },
  buttonContainer: {
    marginTop: 12,
  },
  buttonSpacer: {
    height: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});




