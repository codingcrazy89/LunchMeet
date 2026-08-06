import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    Linking,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import RateAttendeeModal from "../../components/RateAttendeeModal";
import SafetyConfirmModal from "../../components/SafetyConfirmModal";
import { Colors, Radius, Shadows, Spacing, Typography } from "../../constants/theme";
import { useAuth } from "../../src/AuthContext";
import { useLunches } from "../../src/LunchContext";
import { fetchFromPlacesProxy } from "../../src/utils/proxyUrl";

type ViewMode = "list" | "map";

export default function LunchesScreen() {
  const router = useRouter();
  const { lunches, loading, fetchError, joinLunch, acceptRequest, denyRequest, leaveLunch, closeLunch, submitRating, invites, acceptInvite, declineInvite, fetchLunches, version } = useLunches();
  const { user } = useAuth();
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);
  const [ratingModal, setRatingModal] = useState<{ lunchId: string; attendeeId: string; attendeeName: string } | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [refreshing, setRefreshing] = useState(false);
  const [lunchCoordinates, setLunchCoordinates] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [selectedMapLunchId, setSelectedMapLunchId] = useState<string | null>(null);
  const [joinLunchToConfirm, setJoinLunchToConfirm] = useState<any>(null);
  
  // Force re-render when version changes (indicates data was refreshed)
  useEffect(() => {
    // This effect runs when version changes, ensuring component re-renders
  }, [version]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLunches();
    setRefreshing(false);
  };

  // Only show upcoming lunches on the Lunches tab (past lunches stay visible on My Lunches)
  const upcomingLunches = lunches.filter((l) => new Date(l.date_time) >= new Date());

  // Use stored lat/lng when available (works in standalone; no proxy needed)
  const coordsFromLunches = (): Map<string, { lat: number; lng: number }> => {
    const map = new Map<string, { lat: number; lng: number }>();
    for (const lunch of upcomingLunches) {
      if (lunch.latitude != null && lunch.longitude != null) {
        map.set(lunch.id, { lat: lunch.latitude, lng: lunch.longitude });
      }
    }
    return map;
  };

  // Fetch coordinates for map view (only for lunches that have place_id but no stored lat/lng)
  const fetchCoordinates = async () => {
    const stored = coordsFromLunches();
    setLunchCoordinates((prev) => new Map([...prev, ...stored]));

    const coordsMap = new Map<string, { lat: number; lng: number }>();

    for (const lunch of upcomingLunches) {
      if (lunch.latitude != null && lunch.longitude != null) continue;
      if (!lunch.place_id || lunchCoordinates.has(lunch.id)) continue;
      try {
        let response: Response | null = null;
        try {
          response = await fetchFromPlacesProxy(`/places/details?place_id=${lunch.place_id}`);
        } catch (e1) {
          if (Platform.OS === "web") {
            try {
              response = await fetch(`http://localhost:3001/places/details?place_id=${lunch.place_id}`);
            } catch (e2) {
              console.error("Both proxy ports failed for lunch:", lunch.id);
            }
          } else {
            console.error("Proxy request failed for lunch:", lunch.id, e1);
          }
        }

        if (response?.ok) {
          const data = await response.json();
          if (data.result?.geometry?.location) {
            coordsMap.set(lunch.id, {
              lat: data.result.geometry.location.lat,
              lng: data.result.geometry.location.lng,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching coordinates for lunch:", lunch.id, error);
      }
    }

    if (coordsMap.size > 0) {
      setLunchCoordinates((prev) => new Map([...prev, ...coordsMap]));
    }
  };

  // Fetch coordinates when switching to map view
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "map") {
      const stored = coordsFromLunches();
      if (stored.size > 0) {
        setLunchCoordinates((prev) => new Map([...prev, ...stored]));
      }
      fetchCoordinates();
    }
  };

  // Format date and time for display (shared by lunch cards and invite cards)
  const formatDateTime = (dateTimeString: string) => {
    if (!dateTimeString) return "Date TBD";
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateTimeString;
    }
  };

  // Render invite card with full details (location, date, time, attendees)
  const renderInviteCard = (inv: { id: string; lunch: any; inviter_profile: { name: string } | null }) => {
    const lunch = inv.lunch;
    const acceptedAttendees = (lunch.lunch_attendees || []).filter(
      (a: { status?: string }) => a.status === "accepted" || !a.status
    );
    const seenIds = new Set<string>();
    const attendeeNames: string[] = [];
    if (lunch.host_profile?.name) {
      attendeeNames.push(lunch.host_profile.name + " (host)");
      if (lunch.host_id) seenIds.add(lunch.host_id);
    }
    if (lunch.co_host_id && lunch.co_host_profile?.name) {
      attendeeNames.push(lunch.co_host_profile.name + " (co-host)");
      seenIds.add(lunch.co_host_id);
    }
    acceptedAttendees.forEach((a: { user_id?: string; profile?: { name?: string } }) => {
      if (a.user_id && !seenIds.has(a.user_id)) {
        attendeeNames.push(a.profile?.name ?? "Unknown");
        seenIds.add(a.user_id);
      }
    });
    return (
      <View key={inv.id} style={styles.inviteCard}>
        <Text style={styles.inviteRestaurant}>{lunch.restaurant}</Text>
        <Text style={styles.inviteFrom}>From {inv.inviter_profile?.name || "Unknown"}</Text>
        {lunch.restaurant_address ? (
          <Text style={styles.inviteDetail}>{lunch.restaurant_address}</Text>
        ) : null}
        <Text style={styles.inviteDetail}>{formatDateTime(lunch.date_time)}</Text>
        {attendeeNames.length > 0 ? (
          <Text style={styles.inviteDetail}>
            Attendees: {attendeeNames.join(", ")}
          </Text>
        ) : (
          <Text style={styles.inviteDetail}>Attendees: No attendees yet</Text>
        )}
        <View style={styles.inviteButtons}>
          <Pressable
            style={[styles.requestButton, styles.acceptButton, processingInvite === inv.id && styles.requestButtonDisabled]}
            onPress={async () => {
              setProcessingInvite(inv.id);
              try {
                await acceptInvite(inv.id);
              } finally {
                setProcessingInvite(null);
              }
            }}
            disabled={!!processingInvite}
          >
            <Text style={styles.requestButtonText}>{processingInvite === inv.id ? "Accepting..." : "Accept"}</Text>
          </Pressable>
          <Pressable
            style={[styles.requestButton, styles.denyButton, processingInvite === inv.id && styles.requestButtonDisabled]}
            onPress={async () => {
              setProcessingInvite(inv.id);
              try {
                await declineInvite(inv.id);
              } finally {
                setProcessingInvite(null);
              }
            }}
            disabled={!!processingInvite}
          >
            <Text style={styles.requestButtonText}>{processingInvite === inv.id ? "Declining..." : "Decline"}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // Render lunch card with all details (used in both list and map views)
  const renderLunchCard = (lunch: any) => {
    const isHost = lunch.host_id === user?.id;
    const isCoHost = lunch.co_host_id === user?.id;
    
    // Get accepted attendees only
    const acceptedAttendees = lunch.lunch_attendees.filter(
      (a: { status?: string }) => a.status === "accepted" || !a.status
    );
    
    // Get pending requests (only for host or co-host)
    const pendingRequests = (isHost || isCoHost)
      ? lunch.lunch_attendees.filter((a: { status?: string }) => a.status === "pending")
      : [];
    
    // Check if current user has a pending request
    const userPendingRequest = lunch.lunch_attendees.find(
      (a: { user_id?: string; status?: string }) => a.user_id === user?.id && a.status === "pending"
    );
    
    // Check if current user is already accepted
    const userAccepted = lunch.lunch_attendees.some(
      (a: { user_id?: string; status?: string }) => a.user_id === user?.id && (a.status === "accepted" || !a.status)
    );
    
    const canJoin = lunch.seats > 0 && !isHost && !userPendingRequest && !userAccepted;
    const isLunchPast = (dt: string) => new Date(dt) < new Date();

    // Link to Google Search results for this restaurant
    const getGoogleSearchUrl = () => {
      const query = lunch.restaurant_address
        ? `${lunch.restaurant} ${lunch.restaurant_address}`
        : lunch.restaurant;
      return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    };

    return (
      <View key={lunch.id} style={styles.card}>
        <Pressable
          onPress={() => Linking.openURL(getGoogleSearchUrl())}
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
            style={{ flex: 1 }}
          >
            <Text style={styles.hostLink}>
              {lunch.host_profile?.name || "Unknown user"}
            </Text>
          </Pressable>
          {!isHost && userAccepted && isLunchPast(lunch.date_time) && (
            <Pressable
              style={styles.rateButton}
              onPress={() => setRatingModal({
                lunchId: lunch.id,
                attendeeId: lunch.host_id,
                attendeeName: lunch.host_profile?.name || "Unknown user",
              })}
            >
              <Text style={styles.rateButtonText}>Rate</Text>
            </Pressable>
          )}
        </View>
        {lunch.co_host_id && (
          <View style={styles.hostContainer}>
            <Text style={styles.hostLabel}>Co-host: </Text>
            <Pressable
              onPress={() => router.push(`/profile/${lunch.co_host_id}`)}
              style={{ flex: 1 }}
            >
              <Text style={styles.hostLink}>
                {lunch.co_host_profile?.name || "Unknown user"}
              </Text>
            </Pressable>
            {!isHost && !isCoHost && userAccepted && isLunchPast(lunch.date_time) && (
              <Pressable
                style={styles.rateButton}
                onPress={() => setRatingModal({
                  lunchId: lunch.id,
                  attendeeId: lunch.co_host_id!,
                  attendeeName: lunch.co_host_profile?.name || "Unknown user",
                })}
              >
                <Text style={styles.rateButtonText}>Rate</Text>
              </Pressable>
            )}
          </View>
        )}
        <Text style={styles.seats}>Seats left: {lunch.seats}</Text>

        {/* Pending Requests (only visible to host or co-host) */}
        {(isHost || isCoHost) && pendingRequests.length > 0 && (
          <View style={styles.pendingContainer}>
            <Text style={styles.pendingTitle}>Pending Requests</Text>
            {pendingRequests.map((request: any) => (
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
            acceptedAttendees.map((a: any) => (
              <View key={a.id} style={styles.attendeeRow}>
                <Pressable
                  onPress={() => router.push(`/profile/${a.user_id}`)}
                  style={{ flex: 1 }}
                >
                  <Text style={styles.attendeeItemLink}>
                    • {a.profile?.name ?? "Unknown user"}
                  </Text>
                </Pressable>
                {(isHost || isCoHost || userAccepted) && isLunchPast(lunch.date_time) && a.user_id !== user?.id && (
                  <Pressable
                    style={styles.rateButton}
                    onPress={() => setRatingModal({
                      lunchId: lunch.id,
                      attendeeId: a.user_id,
                      attendeeName: a.profile?.name ?? "Unknown user",
                    })}
                  >
                    <Text style={styles.rateButtonText}>Rate</Text>
                  </Pressable>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noAttendees}>No attendees yet</Text>
          )}
        </View>

        {/* Chat button - show if user is host, co-host, or accepted attendee */}
        {(isHost || isCoHost || userAccepted) && (
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
          </View>
        )}

        {/* Leave Lunch button - show for accepted attendees (not host) */}
        {!isHost && userAccepted && (
          <View style={styles.buttonContainer}>
            <Pressable
              style={styles.leaveButton}
              onPress={async () => {
                if (Platform.OS === "web") {
                  if (window.confirm("Are you sure you want to leave this lunch meet?")) {
                    await leaveLunch(lunch.id);
                  }
                } else {
                  Alert.alert(
                    "Leave Lunch",
                    "Are you sure you want to leave this lunch meet?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Leave",
                        style: "destructive",
                        onPress: async () => await leaveLunch(lunch.id),
                      },
                    ]
                  );
                }
              }}
            >
              <Text style={styles.leaveButtonText}>Leave Lunch</Text>
            </Pressable>
          </View>
        )}

        {(isHost || isCoHost) && (
          <View style={styles.buttonContainer}>
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
        )}

        {userPendingRequest && (
          <View style={styles.requestStatus}>
            <Text style={styles.requestStatusText}>
              Request pending - waiting for host approval
            </Text>
          </View>
        )}

        {canJoin && (
          <Pressable
            style={styles.joinButton}
            onPress={() => setJoinLunchToConfirm(lunch)}
          >
            <Text style={styles.joinButtonText}>Join Lunch</Text>
          </Pressable>
        )}
      </View>
    );
  };

  // Generate map URL - center on first lunch with zoom to show area
  const getMapUrl = () => {
    const coords: { lat: number; lng: number }[] = [];
    upcomingLunches.forEach((lunch) => {
      const coord = lunchCoordinates.get(lunch.id);
      if (coord) {
        coords.push(coord);
      }
    });
    
    if (coords.length === 0) {
      // If no coordinates yet, use first lunch's place_id
      const firstLunch = upcomingLunches.find((l) => l.place_id);
      if (firstLunch?.place_id) {
        return `https://www.google.com/maps/place/?q=place_id:${firstLunch.place_id}&z=12&output=embed`;
      }
      return null;
    }
    
    // Calculate center point and bounds
    const lats = coords.map((c) => c.lat);
    const lngs = coords.map((c) => c.lng);
    const centerLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const centerLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;
    
    // Calculate zoom level based on spread of coordinates
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    const maxRange = Math.max(latRange, lngRange);
    const zoom = maxRange > 0.1 ? 10 : maxRange > 0.05 ? 11 : 12;
    
    // Create Google Maps embed URL centered on average location
    return `https://www.google.com/maps?q=${centerLat},${centerLng}&z=${zoom}&output=embed`;
  };

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  );

  return (
    <View style={styles.wrapper}>
      <RateAttendeeModal
        visible={!!ratingModal}
        attendeeName={ratingModal?.attendeeName ?? ""}
        rating={ratingValue}
        comment={ratingComment}
        onRatingChange={setRatingValue}
        onCommentChange={setRatingComment}
        onSubmit={async () => {
          if (!ratingModal) return;
          setRatingSubmitting(true);
          const commentToUse = ratingValue >= 1 && ratingValue < 3 ? ratingComment : undefined;
          const ok = await submitRating(ratingModal.attendeeId, ratingModal.lunchId, ratingValue, commentToUse);
          setRatingSubmitting(false);
          if (ok) {
            setRatingModal(null);
            setRatingValue(0);
            setRatingComment("");
          }
        }}
        onClose={() => {
          setRatingModal(null);
          setRatingValue(0);
          setRatingComment("");
        }}
        submitting={ratingSubmitting}
      />
      <SafetyConfirmModal
        visible={!!joinLunchToConfirm}
        onProceed={async () => {
          if (!joinLunchToConfirm) return;
          const lunch = joinLunchToConfirm;
          setJoinLunchToConfirm(null);
          const success = await joinLunch(lunch);
          if (success) {
            setShowMessage("The host has been notified of your request and will respond shortly.");
            setTimeout(() => setShowMessage(null), 5000);
          }
        }}
        onCancel={() => setJoinLunchToConfirm(null)}
      />
      {/* View Toggle */}
      <View style={styles.viewToggleContainer}>
        <Pressable
          style={[styles.viewToggleButton, viewMode === "list" && styles.viewToggleButtonActive]}
          onPress={() => handleViewModeChange("list")}
        >
          <Text style={[styles.viewToggleText, viewMode === "list" && styles.viewToggleTextActive]}>
            📋 List
          </Text>
        </Pressable>
        <Pressable
          style={[styles.viewToggleButton, viewMode === "map" && styles.viewToggleButtonActive]}
          onPress={() => handleViewModeChange("map")}
        >
          <Text style={[styles.viewToggleText, viewMode === "map" && styles.viewToggleTextActive]}>
            🗺️ Map
          </Text>
        </Pressable>
      </View>

      {showMessage && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>{showMessage}</Text>
          <Pressable onPress={() => setShowMessage(null)}>
            <Text style={styles.messageClose}>✕</Text>
          </Pressable>
        </View>
      )}

      {loading && !fetchError ? (
        <View style={styles.center}>
          <Text style={[Typography.bodySecondary, { color: Colors.textMuted }]}>Loading lunches…</Text>
        </View>
      ) : fetchError ? (
        <View style={[styles.center, { paddingHorizontal: Spacing.xl }]}>
          <Text style={[Typography.bodySecondary, { color: Colors.error, textAlign: "center", marginBottom: Spacing.md }]}>{fetchError}</Text>
          <Pressable
            onPress={() => fetchLunches()}
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : viewMode === "map" ? (
        <View style={styles.mapViewContainer}>
          {Platform.OS === "web" ? (
            // Web: Use iframe for Google Maps embed
            getMapUrl() ? (
              <>
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0, borderRadius: 8 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={getMapUrl() ?? ""}
                  title="Lunch Locations Map"
                />
                <ScrollView
                  style={styles.mapListOverlay}
                  contentContainerStyle={styles.mapListContent}
                  refreshControl={refreshControl}
                >
                  {invites.length > 0 && (
                    <View style={styles.invitesSection}>
                      <Text style={styles.invitesTitle}>You have lunch invites</Text>
                      {invites.map((inv) => renderInviteCard(inv))}
                    </View>
                  )}
                  {upcomingLunches.map((lunch) => (
                    <View key={`${lunch.id}-${version}`}>
                      {renderLunchCard(lunch)}
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <View style={styles.center}>
                <Text>Loading map...</Text>
                <Text style={styles.mapLoadingHint}>
                  {upcomingLunches.length === 0 
                    ? "No upcoming lunches" 
                    : "Fetching restaurant locations..."}
                </Text>
              </View>
            )
          ) : (
            // Mobile: Use react-native-maps
            (() => {
              const MapView = require("react-native-maps").default;
              const Marker = require("react-native-maps").Marker;
              
              const coords: { lat: number; lng: number }[] = [];
              const markers: Array<{ id: string; lat: number; lng: number; title: string }> = [];
              
              upcomingLunches.forEach((lunch) => {
                const coord =
                  lunch.latitude != null && lunch.longitude != null
                    ? { lat: lunch.latitude, lng: lunch.longitude }
                    : lunchCoordinates.get(lunch.id);
                if (coord) {
                  coords.push(coord);
                  markers.push({
                    id: lunch.id,
                    lat: coord.lat,
                    lng: coord.lng,
                    title: lunch.restaurant ?? "",
                  });
                }
              });
              
              const hasMarkers = coords.length > 0;
              const defaultRegion = {
                latitude: 39.8283,
                longitude: -98.5795,
                latitudeDelta: 40,
                longitudeDelta: 40,
              };
              const region = hasMarkers
                ? (() => {
                    const lats = coords.map((c) => c.lat);
                    const lngs = coords.map((c) => c.lng);
                    const centerLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
                    const centerLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;
                    const latDelta = Math.max(...lats) - Math.min(...lats);
                    const lngDelta = Math.max(...lngs) - Math.min(...lngs);
                    return {
                      latitude: centerLat,
                      longitude: centerLng,
                      latitudeDelta: Math.max(latDelta * 1.5, 0.01),
                      longitudeDelta: Math.max(lngDelta * 1.5, 0.01),
                    };
                  })()
                : defaultRegion;
              
              const selectedLunch = selectedMapLunchId
                ? upcomingLunches.find((l) => l.id === selectedMapLunchId)
                : null;

              return (
                <>
                  <MapView
                    style={styles.map}
                    initialRegion={region}
                    showsUserLocation={true}
                    showsMyLocationButton={true}
                  >
                    {markers.map((marker) => (
                      <Marker
                        key={marker.id}
                        coordinate={{ latitude: marker.lat, longitude: marker.lng }}
                        title={marker.title}
                        pinColor="red"
                        onPress={() => setSelectedMapLunchId(marker.id)}
                      />
                    ))}
                  </MapView>
                  {!hasMarkers && (
                    <View style={styles.mapEmptyOverlay} pointerEvents="none">
                      <Text style={styles.mapEmptyText}>
                        {upcomingLunches.length === 0
                          ? "No upcoming lunches"
                          : "No locations for lunches yet. Create one from the Host tab with a place to see the map."}
                      </Text>
                    </View>
                  )}
                  <Modal
                    visible={selectedLunch != null}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setSelectedMapLunchId(null)}
                  >
                    <Pressable
                      style={styles.mapModalBackdrop}
                      onPress={() => setSelectedMapLunchId(null)}
                    >
                      <Pressable style={styles.mapModalCard} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.mapModalHeader}>
                          <Text style={styles.mapModalTitle}>Lunch</Text>
                          <Pressable
                            onPress={() => setSelectedMapLunchId(null)}
                            style={styles.mapModalClose}
                          >
                            <Text style={styles.mapModalCloseText}>✕ Close</Text>
                          </Pressable>
                        </View>
                        {selectedLunch && (
                          <ScrollView
                            style={styles.mapModalScroll}
                            contentContainerStyle={styles.mapModalScrollContent}
                            refreshControl={refreshControl}
                          >
                            {renderLunchCard(selectedLunch)}
                          </ScrollView>
                        )}
                      </Pressable>
                    </Pressable>
                  </Modal>
                </>
              );
            })()
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          refreshControl={refreshControl}
        >
          {invites.length > 0 && (
            <View style={styles.invitesSection}>
              <Text style={styles.invitesTitle}>You have lunch invites</Text>
              {invites.map((inv) => renderInviteCard(inv))}
            </View>
          )}
          {upcomingLunches.map((lunch) => renderLunchCard(lunch))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: { 
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  invitesSection: {
    marginBottom: Spacing.xl,
  },
  invitesTitle: {
    ...Typography.titleSmall,
    marginBottom: Spacing.md,
    color: Colors.text,
  },
  inviteCard: {
    padding: Spacing.lg,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  inviteRestaurant: {
    ...Typography.titleSmall,
    color: Colors.text,
  },
  inviteFrom: {
    ...Typography.bodySecondary,
    marginTop: Spacing.xs,
  },
  inviteDetail: {
    ...Typography.bodySecondary,
    marginTop: Spacing.xs,
    fontSize: 14,
  },
  inviteButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  viewToggleContainer: {
    flexDirection: "row",
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
    alignItems: "center",
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  viewToggleButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  viewToggleTextActive: {
    color: "#fff",
  },
  mapViewContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  mapEmptyOverlay: {
    position: "absolute",
    top: 60,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: "center",
    ...Shadows.card,
  },
  mapEmptyText: {
    fontSize: 14,
    color: Colors.text,
    textAlign: "center",
  },
  mapModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  mapModalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: "85%",
    ...Shadows.card,
  },
  mapModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  mapModalTitle: {
    ...Typography.titleSmall,
  },
  mapModalClose: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  mapModalCloseText: {
    fontSize: 16,
    color: Colors.link,
    fontWeight: "600",
  },
  mapModalScroll: {
    maxHeight: 400,
  },
  mapModalScrollContent: {
    padding: Spacing.lg,
    paddingBottom: 32,
  },
  mapListOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  mapListContent: {
    padding: Spacing.lg,
  },
  mapLoadingHint: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  card: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    borderWidth: 0,
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
  hostLabel: {
    ...Typography.bodySecondary,
  },
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
  noAttendees: {
    ...Typography.caption,
    fontStyle: "italic",
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
  pendingName: {
    flex: 1,
    fontSize: 14,
  },
  pendingNameLink: {
    flex: 1,
    fontSize: 14,
    color: Colors.link,
    fontWeight: "500",
  },
  requestButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  requestButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  acceptButton: {
    backgroundColor: Colors.success,
  },
  denyButton: {
    backgroundColor: Colors.destructive,
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
    padding: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  requestStatusText: {
    color: Colors.primaryDark,
    fontSize: 14,
    textAlign: "center",
  },
  messageContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    margin: Spacing.lg,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  messageText: {
    flex: 1,
    color: "#065f46",
    fontSize: 14,
  },
  messageClose: {
    color: "#065f46",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: Spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  retryButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  retryButtonText: {
    ...Typography.button,
    color: "#fff",
  },
  buttonContainer: {
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
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
  leaveButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.warning,
    borderRadius: Radius.md,
    alignSelf: "flex-start",
  },
  leaveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  joinButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  joinButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});











