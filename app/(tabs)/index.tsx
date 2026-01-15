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

export default function LunchesScreen() {
  const router = useRouter();
  const { lunches, loading, joinLunch, acceptRequest, denyRequest, closeLunch } = useLunches();
  const { user } = useAuth();
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading lunches…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {showMessage && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>{showMessage}</Text>
          <Pressable onPress={() => setShowMessage(null)}>
            <Text style={styles.messageClose}>✕</Text>
          </Pressable>
        </View>
      )}

      {lunches.map((lunch) => {
        const isHost = lunch.host_id === user?.id;
        
        // Get accepted attendees only
        const acceptedAttendees = lunch.lunch_attendees.filter(
          (a) => a.status === "accepted" || !a.status
        );
        
        // Get pending requests (only for host)
        const pendingRequests = isHost
          ? lunch.lunch_attendees.filter((a) => a.status === "pending")
          : [];
        
        // Check if current user has a pending request
        const userPendingRequest = lunch.lunch_attendees.find(
          (a) => a.user_id === user?.id && a.status === "pending"
        );
        
        // Check if current user is already accepted
        const userAccepted = lunch.lunch_attendees.some(
          (a) => a.user_id === user?.id && (a.status === "accepted" || !a.status)
        );
        
        const canJoin = lunch.seats > 0 && !isHost && !userPendingRequest && !userAccepted;

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
        const getGoogleMapsUrl = () => {
          if (lunch.place_id) {
            return `https://www.google.com/maps/place/?q=place_id:${lunch.place_id}`;
          } else if (lunch.restaurant_address) {
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lunch.restaurant_address)}`;
          } else {
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lunch.restaurant)}`;
          }
        };

        return (
          <View key={lunch.id} style={styles.card}>
            <Pressable
              onPress={() => Linking.openURL(getGoogleMapsUrl())}
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

            {/* Pending Requests (only visible to host) */}
            {isHost && pendingRequests.length > 0 && (
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
            )}

            <View style={styles.attendees}>
              <Text style={styles.attendeeTitle}>
                Attendees ({acceptedAttendees.length})
              </Text>

              {acceptedAttendees.length > 0 ? (
                acceptedAttendees.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push(`/profile/${a.user_id}`)}
                  >
                    <Text style={styles.attendeeItemLink}>
                      • {a.profile?.name ?? "Unknown user"}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.noAttendees}>No attendees yet</Text>
              )}
            </View>

            {/* Chat button - show if user is host or accepted attendee */}
            {(isHost || userAccepted) && (
              <Button
                title="Open Chat"
                onPress={() => router.push({
                  pathname: "/(tabs)/chat",
                  params: { lunchId: lunch.id }
                })}
              />
            )}

            {isHost && (
              <Button
                title="Close Lunch"
                color="#c62828"
                onPress={() => closeLunch(lunch)}
              />
            )}

            {userPendingRequest && (
              <View style={styles.requestStatus}>
                <Text style={styles.requestStatusText}>
                  Request pending - waiting for host approval
                </Text>
              </View>
            )}

            {canJoin && (
              <Button
                title="Join Lunch"
                onPress={async () => {
                  const success = await joinLunch(lunch);
                  if (success) {
                    setShowMessage("The host has been notified of your request and will respond shortly.");
                    setTimeout(() => setShowMessage(null), 5000);
                  }
                }}
              />
            )}
          </View>
        );
      })}
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
  noAttendees: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
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
  requestStatus: {
    padding: 12,
    backgroundColor: "#d1ecf1",
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  requestStatusText: {
    color: "#0c5460",
    fontSize: 14,
    textAlign: "center",
  },
  messageContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    margin: 16,
    backgroundColor: "#d4edda",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c3e6cb",
  },
  messageText: {
    flex: 1,
    color: "#155724",
    fontSize: 14,
  },
  messageClose: {
    color: "#155724",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});











