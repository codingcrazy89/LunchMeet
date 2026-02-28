import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import ProfilePhotoImage from "../../components/ProfilePhotoImage"
import SafetyConfirmModal from "../../components/SafetyConfirmModal"
import { useAuth } from "../../src/AuthContext"
import { useContacts } from "../../src/ContactsContext"
import { supabase } from "../../src/lib/supabase"
import { useLunches } from "../../src/LunchContext"
import { fetchFromPlacesProxy, getProxyUrl } from "../../src/utils/proxyUrl"
import { preparePhotosForDisplay } from "../../src/utils/photoUrls"

export default function HostScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { contactsVersion } = useContacts()
  const { fetchLunches } = useLunches()
  const [query, setQuery] = useState("")
  const [predictions, setPredictions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const [selectedPlace, setSelectedPlace] = useState<null | {
    place_id: string
    name: string
    address: string
    lat: number
    lng: number
  }>(null)

  // Date and time state
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [seats, setSeats] = useState("4")
  const [isPublic, setIsPublic] = useState(true)
  const [visibilityGender, setVisibilityGender] = useState<string[]>([])
  const [visibilityLookingFor, setVisibilityLookingFor] = useState<string[]>([])
  const [coHostEmail, setCoHostEmail] = useState("")
  const [showSafetyConfirm, setShowSafetyConfirm] = useState(false)

  // Contacts for private lunch invites
  const [contacts, setContacts] = useState<Array<{ id: string; contact_id: string; name: string; photoUrl?: string }>>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<Set<string>>(new Set())

  const fetchContacts = useCallback(async () => {
    if (!user?.id) return
    setLoadingContacts(true)
    const { data: contactRows } = await supabase
      .from("user_contacts")
      .select("id, contact_id")
      .eq("user_id", user.id)
    if (!contactRows?.length) {
      setContacts([])
      setLoadingContacts(false)
      return
    }
    const ids = contactRows.map((r) => r.contact_id)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, photos")
      .in("id", ids)
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))
    const withPhotos = await Promise.all(
      contactRows.map(async (row) => {
        const p = profileMap.get(row.contact_id)
        const rawPhotos = Array.isArray(p?.photos) ? p.photos : p?.photos ? [p.photos] : []
        const photos = rawPhotos.length ? await preparePhotosForDisplay(rawPhotos) : []
        return {
          id: row.id,
          contact_id: row.contact_id,
          name: p?.name || "Unknown",
          photoUrl: photos[0],
        }
      })
    )
    setContacts(withPhotos)
    setLoadingContacts(false)
  }, [user?.id])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts, contactsVersion])

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchContacts()
    }, [user?.id, fetchContacts])
  )

  const toggleInvitee = (contactId: string) => {
    setSelectedInviteeIds((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }

  useEffect(() => {
    if (isPublic) setSelectedInviteeIds(new Set())
  }, [isPublic])

  async function searchRestaurants(text: string) {
    setQuery(text)

    // Clear previous debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (text.length < 2) {
      setPredictions([])
      setError(null)
      return
    }

    // Debounce API calls
    debounceTimer.current = setTimeout(async () => {
      setLoading(true)

      try {
        const response = await fetchFromPlacesProxy(
          `/places/autocomplete?input=${encodeURIComponent(text)}`
        )

        if (!response.ok) {
          const body = await response.text().catch(() => "")
          const proxyUrl = getProxyUrl()
          const isTunnel = proxyUrl.includes("loca.lt") || proxyUrl.includes("ngrok")
          if (response.status === 503 && isTunnel) {
            setError("Tunnel unavailable (503). Keep 'npm run proxy' running, run 'npm run proxy:tunnel:lt' to get a fresh URL, put it in EXPO_PUBLIC_PLACES_PROXY_URL in .env, then restart Expo and reload the app.")
            setPredictions([])
            return
          }
          if (response.status === 408) {
            setError("Request timed out (408). Try again. If it keeps happening, use same Wi‑Fi and set EXPO_PUBLIC_PLACES_PROXY_URL to your computer's IP (e.g. http://192.168.0.61:8787), or restart the proxy tunnel.")
            setPredictions([])
            return
          }
          throw new Error(`HTTP ${response.status}${body.slice(0, 80) ? `: ${body.slice(0, 80)}…` : ""}`)
        }

        const contentType = response.headers.get("content-type") || ""
        const raw = await response.text()
        if (/text\/html/i.test(contentType) || /<\s*!?doctype|<\s*html/i.test(raw)) {
          setError("Tunnel returned a login page instead of data. Use same Wi‑Fi as your computer and set EXPO_PUBLIC_PLACES_PROXY_URL to your computer's IP (e.g. http://192.168.1.x:8787), or use ngrok for the proxy (see TUNNEL_AND_PLACES.md).")
          setPredictions([])
          return
        }
        const data = JSON.parse(raw)
        
        if (data.error) {
          console.error("API error:", data.error)
          setError(data.error)
          setPredictions([])
        } else if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          const msg = data.error_message || data.status
          console.error("Google Places error:", data.status, msg)
          setError(typeof msg === "string" ? msg : data.status)
          setPredictions([])
        } else {
          setError(null)
          setPredictions(data.predictions || [])
        }
      } catch (err: any) {
        console.error("Search failed:", err)
        setPredictions([])
        const msg = err?.message || String(err)
        setError(msg.includes("Tunnel") ? msg : `Cannot reach proxy at ${getProxyUrl()}. Ensure npm run proxy is running and EXPO_PUBLIC_PLACES_PROXY_URL is set (or use same Wi‑Fi with your computer's IP).`)
      } finally {
        setLoading(false)
      }
    }, 300) // 300ms debounce
  }

  async function selectPlace(prediction: any) {
    setLoading(true)
    setQuery(prediction.description)
    setPredictions([])

    try {
      // Get place details to get coordinates
      const response = await fetchFromPlacesProxy(
        `/places/details?place_id=${encodeURIComponent(prediction.place_id)}`
      )

      const data = await response.json()
      const place = data.result

      if (place) {
        setSelectedPlace({
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
        })
      }
    } catch (err) {
      console.error("Failed to get place details:", err)
    } finally {
      setLoading(false)
    }
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  function requestCreateLunch() {
    if (!selectedPlace) return
    if (!date || !time) {
      alert("Please select both date and time for the lunch meet")
      return
    }
    if (!seats || parseInt(seats) < 1) {
      alert("Please select the number of guests")
      return
    }
    setShowSafetyConfirm(true)
  }

  async function createLunch() {
    setShowSafetyConfirm(false)
    if (!selectedPlace) return
    if (!date || !time) {
      alert("Please select both date and time for the lunch meet")
      return
    }
    if (!seats || parseInt(seats) < 1) {
      alert("Please select the number of guests")
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    // Combine date and time into ISO string format
    const dateTime = new Date(`${date}T${time}`).toISOString()

    const insertData: Record<string, unknown> = {
      host_id: user.id,
      restaurant: selectedPlace.name,
      restaurant_name: selectedPlace.name,
      restaurant_address: selectedPlace.address,
      place_id: selectedPlace.place_id,
      latitude: selectedPlace.lat,
      longitude: selectedPlace.lng,
      date_time: dateTime,
      seats: parseInt(seats),
      description: "",
      is_public: isPublic,
    }
    if (isPublic) {
      if (visibilityGender.length > 0) insertData.visibility_gender = visibilityGender
      if (visibilityLookingFor.length > 0) insertData.visibility_looking_for = visibilityLookingFor
    }

    if (coHostEmail.trim()) {
      const { data: coHostData } = await supabase.rpc("get_user_by_email", { p_email: coHostEmail.trim() })
      const coHost = Array.isArray(coHostData) ? coHostData[0] : coHostData
      if (coHost?.id && coHost.id !== user.id) {
        insertData.co_host_id = coHost.id
      }
    }

    const { data: insertedLunch, error } = await supabase
      .from("lunches")
      .insert(insertData)
      .select("id")
      .single()

    if (error || !insertedLunch?.id) {
      console.error("Error creating lunch:", error)
      alert("Failed to create lunch. Please try again.")
      return
    }

    const lunchId = insertedLunch.id

    if (!isPublic && selectedInviteeIds.size > 0) {
      const inviteRows = Array.from(selectedInviteeIds).map((inviteeId) => ({
        lunch_id: lunchId,
        inviter_id: user.id,
        invitee_id: inviteeId,
        status: "pending",
      }))
      await supabase.from("lunch_invites").insert(inviteRows)
    }

    // Reset form
    setQuery("")
    setSelectedPlace(null)
    setDate("")
    setTime("")
    setSeats("4")
    setIsPublic(true)
    setVisibilityGender([])
    setVisibilityLookingFor([])
    setSelectedInviteeIds(new Set())
    setCoHostEmail("")
    
    // Refresh lunches list and navigate to Lunches tab
    if (fetchLunches) {
      fetchLunches()
    }
    
    // Navigate to Lunches tab to see the new lunch
    router.push("/(tabs)")
    
    alert("Lunch meet created successfully!")
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.searchContainer}>
        <TextInput
          value={query}
          placeholder="Search for a restaurant..."
          onChangeText={searchRestaurants}
          style={styles.input}
          autoFocus
        />

        {loading && (
          <Text style={styles.loadingText}>Searching…</Text>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Start the proxy server with: npm run proxy
            </Text>
          </View>
        )}

        {!loading && !error && query.length >= 2 && predictions.length === 0 && (
          <Text style={styles.noResultsText}>
            No restaurants found. Try a different search term.
          </Text>
        )}

        {predictions.length > 0 && (
          <View style={styles.predictionsContainer}>
            {predictions.map((prediction) => (
              <Pressable
                key={prediction.place_id}
                onPress={() => selectPlace(prediction)}
                style={styles.predictionItem}
              >
                <Text style={styles.predictionMainText}>
                  {prediction.structured_formatting?.main_text || prediction.description}
                </Text>
                <Text style={styles.predictionSecondaryText}>
                  {prediction.structured_formatting?.secondary_text || ""}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {selectedPlace && (
        <View style={styles.selectedContainer}>
          <Pressable
            onPress={() => {
              const query = `${selectedPlace.name} ${selectedPlace.address}`;
              Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
            }}
            style={styles.restaurantLink}
          >
            <Text style={styles.selectedName}>{selectedPlace.name}</Text>
          </Pressable>
          <Text style={styles.selectedAddress}>{selectedPlace.address}</Text>
          
          {/* Date and Time Input Fields - BEFORE map */}
          <View style={styles.dateTimeContainer}>
          <Text style={styles.dateTimeLabel}>Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeField}>
                <Text style={styles.dateTimeFieldLabel}>Date</Text>
                {/* @ts-ignore - HTML date input for web calendar */}
                <input
                  type="date"
                  value={date}
                  onChange={(e: any) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={styles.datePickerInputVisible}
                />
              </View>
            <View style={styles.dateTimeField}>
              <Text style={styles.dateTimeFieldLabel}>Time</Text>
              {/* @ts-ignore - Custom select with 30-minute increments, 7 AM to 9 PM */}
              <select
                value={time}
                onChange={(e: any) => setTime(e.target.value)}
                style={styles.timeSelectInput}
              >
                <option value="">Select time</option>
                {(() => {
                  const times = []
                  // Start at 7:00 AM (07:00), end at 9:30 PM (21:30)
                  for (let hour = 7; hour <= 21; hour++) {
                    for (let minute = 0; minute < 60; minute += 30) {
                      // Skip times after 9:30 PM
                      if (hour === 21 && minute > 30) break
                      const timeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                      const displayTime = new Date(`2000-01-01T${timeValue}`).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })
                      times.push(
                        <option key={timeValue} value={timeValue}>
                          {displayTime}
                        </option>
                      )
                    }
                  }
                  return times
                })()}
              </select>
            </View>
          </View>
            <Text style={styles.dateTimeHint}>
              Click the date or time fields to open pickers. Time slots are in 30-minute increments (e.g., 12:00, 12:30, 13:00)
            </Text>
          </View>

          {/* Number of Guests */}
          <View style={styles.guestsContainer}>
            <Text style={styles.guestsLabel}>Number of Guests</Text>
            {/* @ts-ignore - Custom select for number of guests */}
            <select
              value={seats}
              onChange={(e: any) => setSeats(e.target.value)}
              style={styles.guestsSelectInput}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={String(num)}>
                  {num} {num === 1 ? 'guest' : 'guests'}
                </option>
              ))}
            </select>
            <Text style={styles.guestsHint}>
              Maximum number of people (including yourself) who can join this lunch
            </Text>
          </View>

          {/* Public or Private */}
          <View style={styles.visibilityContainer}>
            <Text style={styles.visibilityLabel}>Visibility</Text>
            <View style={styles.publicPrivateRow}>
              <Pressable
                onPress={() => setIsPublic(true)}
                style={[styles.publicPrivateOption, isPublic && styles.publicPrivateOptionSelected]}
              >
                <Text style={[styles.publicPrivateText, isPublic && styles.publicPrivateTextSelected]}>
                  Public
                </Text>
                <Text style={styles.publicPrivateHint}>Anyone can discover and request to join</Text>
              </Pressable>
              <Pressable
                onPress={() => setIsPublic(false)}
                style={[styles.publicPrivateOption, !isPublic && styles.publicPrivateOptionSelected]}
              >
                <Text style={[styles.publicPrivateText, !isPublic && styles.publicPrivateTextSelected]}>
                  Private
                </Text>
                <Text style={styles.publicPrivateHint}>Invite-only from your contacts</Text>
              </Pressable>
            </View>
          </View>

          {/* Visibility filters - only when public */}
          {isPublic && (
          <View style={styles.visibilityContainer}>
            <Text style={styles.visibilityLabel}>Who can see this lunch? (optional)</Text>
            <Text style={styles.visibilityHint}>Leave empty to show to everyone</Text>
            <View style={styles.visibilitySection}>
              <Text style={styles.visibilitySectionLabel}>Gender</Text>
              <View style={styles.visibilityOptions}>
                {["male", "female", "nonbinary", "other"].map((g) => {
                  const isSelected = visibilityGender.includes(g)
                  return (
                    <Pressable
                      key={g}
                      onPress={() => {
                        setVisibilityGender((prev) =>
                          isSelected ? prev.filter((x) => x !== g) : [...prev, g]
                        )
                      }}
                      style={[styles.visibilityOption, isSelected && styles.visibilityOptionSelected]}
                    >
                      <Text style={[styles.visibilityOptionText, isSelected && styles.visibilityOptionTextSelected]}>
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
            <View style={styles.visibilitySection}>
              <Text style={styles.visibilitySectionLabel}>Looking for</Text>
              <View style={styles.visibilityOptions}>
                {["Networking", "Friendship", "Dating"].map((lf) => {
                  const isSelected = visibilityLookingFor.includes(lf)
                  return (
                    <Pressable
                      key={lf}
                      onPress={() => {
                        setVisibilityLookingFor((prev) =>
                          isSelected ? prev.filter((x) => x !== lf) : [...prev, lf]
                        )
                      }}
                      style={[styles.visibilityOption, isSelected && styles.visibilityOptionSelected]}
                    >
                      <Text style={[styles.visibilityOptionText, isSelected && styles.visibilityOptionTextSelected]}>
                        {lf}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </View>
          )}

          {/* Direct invites - only when private */}
          {!isPublic && (
          <View style={styles.visibilityContainer}>
            <Text style={styles.visibilityLabel}>Send direct invites</Text>
            <Text style={styles.visibilityHint}>Select contacts to invite (click to toggle)</Text>
            {loadingContacts ? (
              <Text style={styles.contactListPlaceholderText}>Loading contacts…</Text>
            ) : contacts.length === 0 ? (
              <View style={styles.contactListPlaceholder}>
                <Text style={styles.contactListPlaceholderText}>
                  No contacts yet. Add people from their profiles to invite them to private lunches.
                </Text>
              </View>
            ) : (
              <View style={styles.contactList}>
                {contacts.map((c) => {
                  const isSelected = selectedInviteeIds.has(c.contact_id)
                  return (
                    <Pressable
                      key={c.id}
                      style={[styles.contactRow, isSelected && styles.contactRowSelected]}
                      onPress={() => toggleInvitee(c.contact_id)}
                    >
                      {c.photoUrl ? (
                        <ProfilePhotoImage
                          source={{ uri: c.photoUrl }}
                          style={styles.contactAvatar}
                        />
                      ) : (
                        <View style={[styles.contactAvatar, styles.contactAvatarPlaceholder]} />
                      )}
                      <Text style={styles.contactName}>{c.name}</Text>
                      <View style={[styles.contactCheckbox, isSelected && styles.contactCheckboxSelected]}>
                        {isSelected && <Text style={styles.contactCheckmark}>✓</Text>}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>
          )}

          {/* Co-host (optional) */}
          <View style={styles.coHostContainer}>
            <Text style={styles.coHostLabel}>Co-host email (optional)</Text>
            <TextInput
              value={coHostEmail}
              onChangeText={setCoHostEmail}
              placeholder="Enter co-host's email address"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.coHostHint}>
              Co-host can accept/deny requests and manage the lunch like the host
            </Text>
          </View>
          
          <View style={styles.mapContainer}>
            <iframe
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0, borderRadius: 8 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${selectedPlace.lat},${selectedPlace.lng}&z=15&output=embed`}
              title={selectedPlace.name}
            />
          </View>
        </View>
      )}

        <View style={styles.buttonContainer}>
          <Pressable
            disabled={!selectedPlace || !date || !time || !seats}
            onPress={requestCreateLunch}
            style={[
              styles.submitButton,
              (!selectedPlace || !date || !time || !seats) && styles.submitButtonDisabled
            ]}
          >
            <Text style={styles.submitButtonText}>
              Host Lunch
            </Text>
          </Pressable>
          <SafetyConfirmModal
            visible={showSafetyConfirm}
            onProceed={createLunch}
            onCancel={() => setShowSafetyConfirm(false)}
          />
          
          {selectedPlace && (!date || !time || !seats) && (
            <Text style={styles.helperText}>
              Please select date, time, and number of guests to host a lunch
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  searchContainer: {
    position: "relative",
    zIndex: 10,
  },
  input: {
    borderWidth: 2,
    borderColor: "#e0e0e0",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 8,
    color: "#666",
    fontSize: 14,
  },
  noResultsText: {
    marginTop: 8,
    color: "#999",
    fontSize: 14,
    fontStyle: "italic",
  },
  errorContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#fee",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fcc",
  },
  errorText: {
    color: "#c00",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  errorHint: {
    color: "#800",
    fontSize: 12,
  },
  predictionsContainer: {
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 300,
    overflow: "hidden",
  },
  predictionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    cursor: "pointer",
  },
  predictionMainText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 2,
  },
  predictionSecondaryText: {
    fontSize: 14,
    color: "#666",
  },
  selectedContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  restaurantLink: {
    alignSelf: "flex-start",
  },
  selectedName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0066cc",
    marginBottom: 4,
    textDecorationLine: "underline",
  },
  selectedAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  mapContainer: {
    height: 300,
    borderRadius: 8,
    overflow: "hidden",
  },
  dateTimeContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  dateTimeLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  dateTimeField: {
    flex: 1,
  },
  dateTimeFieldLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
    fontWeight: "500",
  },
  dateTimeInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  datePickerInputVisible: {
    width: "100%",
    padding: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e0e0e0",
    borderRadius: "8px",
    fontSize: "16px",
    backgroundColor: "#fff",
    fontFamily: "inherit",
    boxSizing: "border-box",
    cursor: "pointer",
  } as any,
  timePickerInputVisible: {
    width: "100%",
    padding: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e0e0e0",
    borderRadius: "8px",
    fontSize: "16px",
    backgroundColor: "#fff",
    fontFamily: "inherit",
    boxSizing: "border-box",
    cursor: "pointer",
  } as any,
  timeSelectInput: {
    width: "100%",
    padding: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e0e0e0",
    borderRadius: "8px",
    fontSize: "16px",
    backgroundColor: "#fff",
    fontFamily: "inherit",
    boxSizing: "border-box",
    cursor: "pointer",
  } as any,
  dateTimeHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  visibilityContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  visibilityLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  visibilityHint: {
    fontSize: 12,
    color: "#999",
    marginBottom: 12,
  },
  visibilitySection: {
    marginBottom: 12,
  },
  visibilitySectionLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "500",
  },
  visibilityOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  visibilityOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  visibilityOptionSelected: {
    borderColor: "#E85D4C",
    backgroundColor: "#FFE8E5",
  },
  visibilityOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  visibilityOptionTextSelected: {
    color: "#E85D4C",
  },
  publicPrivateRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  publicPrivateOption: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  publicPrivateOptionSelected: {
    borderColor: "#E85D4C",
    backgroundColor: "#FFE8E5",
  },
  publicPrivateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  publicPrivateTextSelected: {
    color: "#E85D4C",
  },
  publicPrivateHint: {
    fontSize: 12,
    marginTop: 4,
    color: "#999",
  },
  contactListPlaceholder: {
    marginTop: 12,
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    backgroundColor: "#f9f9f9",
    alignItems: "center",
    justifyContent: "center",
  },
  contactListPlaceholderText: {
    fontSize: 14,
    color: "#999",
  },
  contactList: {
    marginTop: 12,
    gap: 8,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  contactRowSelected: {
    borderColor: "#E85D4C",
    backgroundColor: "#FFE8E5",
  },
  contactCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center",
  },
  contactCheckboxSelected: {
    borderColor: "#E85D4C",
    backgroundColor: "#E85D4C",
  },
  contactCheckmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  contactAvatarPlaceholder: {
    backgroundColor: "#e0e0e0",
  },
  contactName: {
    fontSize: 16,
    color: "#333",
  },
  coHostContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  coHostLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  coHostHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  guestsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  guestsLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  guestsSelectInput: {
    width: "100%",
    padding: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e0e0e0",
    borderRadius: "8px",
    fontSize: "16px",
    backgroundColor: "#fff",
    fontFamily: "inherit",
    boxSizing: "border-box",
    cursor: "pointer",
  } as any,
  guestsHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  buttonContainer: {
    marginTop: 24,
    width: "100%",
    position: "relative",
    zIndex: 1,
  },
  submitButton: {
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 8,
    width: "100%",
    minHeight: 50,
  },
  submitButtonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  helperText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
})