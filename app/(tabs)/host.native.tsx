import DateTimePicker from "@react-native-community/datetimepicker"
import * as Location from "expo-location"
import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native"
import ProfilePhotoImage from "../../components/ProfilePhotoImage"
import SafetyConfirmModal from "../../components/SafetyConfirmModal"
import { Colors, Radius, Shadows, Spacing, Typography } from "../../constants/theme"
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
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showSafetyConfirm, setShowSafetyConfirm] = useState(false)
  const [pickerDate, setPickerDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    return d
  })
  const [pickerTime, setPickerTime] = useState<Date>(() => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    return d
  })

  // Nearby map: center and places
  const defaultMapCenter = { latitude: 38.9072, longitude: -77.0369 }
  const [mapRegion, setMapRegion] = useState({
    ...defaultMapCenter,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  })
  const [nearbyPlaces, setNearbyPlaces] = useState<Array<{
    place_id: string
    name: string
    vicinity: string
    lat: number
    lng: number
  }>>([])
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [nearbyError, setNearbyError] = useState<string | null>(null)
  const [tappedPlaceForInfo, setTappedPlaceForInfo] = useState<null | {
    place_id: string
    name: string
    vicinity: string
    lat: number
    lng: number
  }>(null)
  const nearbyMapRef = useRef<any>(null)
  const nearbyFetchDebounce = useRef<NodeJS.Timeout | null>(null)
  const lastFetchedCenter = useRef<{ latitude: number; longitude: number } | null>(null)
  const MIN_FETCH_MOVE_METERS = 150

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

  // Clear selected invitees when switching to public
  useEffect(() => {
    if (isPublic) setSelectedInviteeIds(new Set())
  }, [isPublic])

  function resetHostToDefault() {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    if (nearbyFetchDebounce.current) {
      clearTimeout(nearbyFetchDebounce.current)
      nearbyFetchDebounce.current = null
    }
    setQuery("")
    setPredictions([])
    setError(null)
    setSelectedPlace(null)
    setDate("")
    setTime("")
    setSeats("4")
    setVisibilityGender([])
    setVisibilityLookingFor([])
    setSelectedInviteeIds(new Set())
    setCoHostEmail("")
    setShowDatePicker(false)
    setShowTimePicker(false)
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    setPickerDate(noon)
    setPickerTime(noon)
    setMapRegion({
      ...defaultMapCenter,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    })
    setNearbyPlaces([])
    setNearbyError(null)
    setTappedPlaceForInfo(null)
  }

  async function handlePullToRefresh() {
    resetHostToDefault()
    await fetchNearbyPlaces()
  }

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

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (nearbyFetchDebounce.current) clearTimeout(nearbyFetchDebounce.current)
    }
  }, [])

  function metersBetween(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
  ): number {
    const R = 6371000
    const toRad = (x: number) => (x * Math.PI) / 180
    const dLat = toRad(b.latitude - a.latitude)
    const dLon = toRad(b.longitude - a.longitude)
    const lat1 = toRad(a.latitude)
    const lat2 = toRad(b.latitude)
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  }

  // Fetch nearby restaurants for the map
  async function fetchNearbyPlaces(region?: { latitude: number; longitude: number }) {
    const center = region ?? mapRegion
    lastFetchedCenter.current = { latitude: center.latitude, longitude: center.longitude }
    setLoadingNearby(true)
    setNearbyError(null)
    try {
      const { latitude, longitude } = center
      const path = `/places/nearby?lat=${latitude}&lng=${longitude}&radius=5000`
      console.log("[Host] Fetching nearby:", getProxyUrl() + path)
      const response = await fetchFromPlacesProxy(path)
      const raw = await response.text()
      const contentType = response.headers.get("content-type") || ""
      if (/text\/html/i.test(contentType) || /<\s*!?doctype|<\s*html/i.test(raw)) {
        setNearbyPlaces([])
        setNearbyError("Tunnel returned a login page. Use same Wi‑Fi and set EXPO_PUBLIC_PLACES_PROXY_URL to your computer's IP, or use ngrok for the proxy.")
        return
      }
      const data = (() => { try { return JSON.parse(raw) } catch { return {} } })()
      if (!response.ok) {
        const proxyUrl = getProxyUrl()
        const isTunnel = proxyUrl.includes("loca.lt") || proxyUrl.includes("ngrok")
        if (response.status === 503 && isTunnel) {
          setNearbyPlaces([])
          setNearbyError("Tunnel unavailable (503). Keep npm run proxy running, run npm run proxy:tunnel:lt, put the new URL in EXPO_PUBLIC_PLACES_PROXY_URL, restart Expo and reload.")
          return
        }
        if (response.status === 408) {
          setNearbyPlaces([])
          setNearbyError("Request timed out (408). Try again, or use same Wi‑Fi with EXPO_PUBLIC_PLACES_PROXY_URL set to your computer's IP (e.g. http://192.168.0.61:8787).")
          return
        }
        const msg = (data as any)?.error || (data as any)?.error_message || response.statusText || "Request failed"
        const hint = (data as any)?.hint
        let fullMsg = `Nearby request failed (HTTP ${response.status}): ${typeof msg === "string" ? msg : JSON.stringify(msg)}`
        if (response.status === 404 && hint) {
          fullMsg += ` — ${hint}`
        }
        console.error("[Host]", fullMsg)
        throw new Error(fullMsg)
      }
      if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        const msg = (data as any).error_message || data.status
        console.error("[Host] Google Places status:", data.status, msg)
        throw new Error(typeof msg === "string" ? msg : data.status)
      }
      const results = (data.results || []).filter(
        (p: any) =>
          p?.geometry?.location?.lat != null &&
          p?.geometry?.location?.lng != null &&
          p.place_id &&
          p.name
      )
      const places = results.map((p: any) => ({
        place_id: p.place_id,
        name: p.name,
        vicinity: p.vicinity || "",
        lat: Number(p.geometry.location.lat),
        lng: Number(p.geometry.location.lng),
      }))
      console.log("[Host] Nearby places loaded:", places.length, places.length === 0 ? "- run proxy on PC (npm run proxy) and use same Wi‑Fi, or enable Places API in Google Cloud" : "")
      setNearbyPlaces(places)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[Host] Failed to fetch nearby places:", message)
      setNearbyPlaces([])
      setNearbyError(message)
    } finally {
      setLoadingNearby(false)
    }
  }

  // Get user location, center map on it, and fetch nearby places
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (cancelled) return
        if (status !== "granted") {
          fetchNearbyPlaces()
          return
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (cancelled) return
        const { latitude, longitude } = loc.coords
        const region = {
          latitude,
          longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }
        setMapRegion(region)
        const map = nearbyMapRef.current
        if (map?.animateToRegion) {
          map.animateToRegion(region, 400)
        }
        fetchNearbyPlaces({ latitude, longitude })
      } catch {
        if (!cancelled) fetchNearbyPlaces()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function selectPlaceFromMap(place: { place_id: string; name: string }) {
    setTappedPlaceForInfo(null) // hide the modal immediately
    await selectPlace({ place_id: place.place_id, description: place.name })
  }

  function requestCreateLunch() {
    if (!selectedPlace) return
    if (!date || !time) {
      Alert.alert("Error", "Please select both date and time for the lunch meet")
      return
    }
    if (!seats || parseInt(seats) < 1) {
      Alert.alert("Error", "Please select the number of guests")
      return
    }
    setShowSafetyConfirm(true)
  }

  async function createLunch() {
    setShowSafetyConfirm(false)
    if (!selectedPlace) return
    if (!date || !time) {
      Alert.alert("Error", "Please select both date and time for the lunch meet")
      return
    }
    if (!seats || parseInt(seats) < 1) {
      Alert.alert("Error", "Please select the number of guests")
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
      Alert.alert("Error", "Failed to create lunch. Please try again.")
      return
    }

    const lunchId = insertedLunch.id

    // Send invites to selected contacts (private lunch only)
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
    setCoHostEmail("")
    setShowDatePicker(false)
    setShowTimePicker(false)
    const nextDefault = new Date()
    nextDefault.setHours(12, 0, 0, 0)
    setPickerDate(nextDefault)
    setPickerTime(nextDefault)
    
    // Refresh lunches list and navigate to Lunches tab
    if (fetchLunches) {
      fetchLunches()
    }
    
    // Navigate to Lunches tab to see the new lunch
    router.push("/(tabs)")
    
    Alert.alert("Success", "Lunch meet created successfully!")
  }

  // Mobile-optimized date/time inputs
  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  }

  const getMinTime = () => {
    if (date === getTodayDate()) {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, "0")
      const minutes = String(now.getMinutes()).padStart(2, "0")
      return `${hours}:${minutes}`
    }
    return "00:00"
  }

  const formatDateForDisplay = (isoDateStr: string) => {
    if (!isoDateStr) return ""
    const d = new Date(isoDateStr + "T12:00:00")
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  }

  const onDatePickerChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false)
    if (selectedDate) {
      const y = selectedDate.getFullYear()
      const m = String(selectedDate.getMonth() + 1).padStart(2, "0")
      const day = String(selectedDate.getDate()).padStart(2, "0")
      setDate(`${y}-${m}-${day}`)
      setPickerDate(selectedDate)
    }
  }

  const openDatePicker = () => {
    if (date) {
      const [y, m, d] = date.split("-").map(Number)
      setPickerDate(new Date(y, (m || 1) - 1, d || 1))
    } else {
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      setPickerDate(today)
    }
    setShowDatePicker(true)
  }

  const formatTimeForDisplay = (timeStr: string) => {
    if (!timeStr) return ""
    const [hours, minutes] = timeStr.split(":")
    if (!hours || !minutes) return timeStr
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const onTimePickerChange = (_event: unknown, selectedTime?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false)
    if (selectedTime) {
      const hours = String(selectedTime.getHours()).padStart(2, "0")
      const minutes = String(selectedTime.getMinutes()).padStart(2, "0")
      setTime(`${hours}:${minutes}`)
      setPickerTime(selectedTime)
    }
  }

  const openTimePicker = () => {
    if (time) {
      const [hours, minutes] = time.split(":").map(Number)
      const d = new Date()
      d.setHours(hours || 12, minutes || 0, 0, 0)
      setPickerTime(d)
    } else {
      const now = new Date()
      // Round to nearest 30 minutes
      const minutes = Math.round(now.getMinutes() / 30) * 30
      now.setMinutes(minutes, 0, 0)
      if (minutes >= 60) {
        now.setHours(now.getHours() + 1)
        now.setMinutes(0, 0, 0)
      }
      setPickerTime(now)
    }
    setShowTimePicker(true)
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loadingNearby}
            onRefresh={handlePullToRefresh}
          />
        }
      >
        <View style={styles.searchContainer}>
          <Text style={styles.label}>Search for a Restaurant</Text>
          <TextInput
            value={query}
            placeholder="Search for a restaurant..."
            onChangeText={searchRestaurants}
            style={styles.input}
            autoFocus
            returnKeyType="search"
          />

          {loading && (
            <Text style={styles.loadingText}>Searching…</Text>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorHint}>
                Proxy: {getProxyUrl()}. Run npm run proxy on your computer. On a device, set EXPO_PUBLIC_PLACES_PROXY_URL in .env to your computer's IP (e.g. http://192.168.1.100:8787) and use the same Wi‑Fi.
              </Text>
            </View>
          )}

          {predictions.length > 0 && (
            <View style={styles.predictionsContainer}>
              <ScrollView
                style={styles.predictionsScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={true}
              >
                {predictions.map((prediction) => (
                  <Pressable
                    key={prediction.place_id}
                    style={styles.predictionItem}
                    onPress={() => selectPlace(prediction)}
                  >
                    <Text style={styles.predictionMainText}>
                      {prediction.structured_formatting?.main_text || prediction.description}
                    </Text>
                    <Text style={styles.predictionSecondaryText}>
                      {prediction.structured_formatting?.secondary_text || ""}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {selectedPlace && (
          <View style={styles.selectedContainer}>
            <Text style={styles.selectedTitle}>Selected Restaurant</Text>
            <Pressable
              onPress={() => {
                const query = `${selectedPlace.name} ${selectedPlace.address}`;
                Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
              }}
            >
              <Text style={[styles.selectedName, { textDecorationLine: "underline", color: "#0066cc" }]}>{selectedPlace.name}</Text>
            </Pressable>
            <Text style={styles.selectedAddress}>{selectedPlace.address}</Text>

            {/* Map preview for mobile - react-native-maps only in .native.tsx */}
            {(() => {
              const MapView = require("react-native-maps").default;
              const Marker = require("react-native-maps").Marker;
              
              return (
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: selectedPlace.lat,
                      longitude: selectedPlace.lng,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: selectedPlace.lat,
                        longitude: selectedPlace.lng,
                      }}
                      title={selectedPlace.name}
                    />
                  </MapView>
                </View>
              );
            })()}

            {/* Date - Calendar Picker */}
            <View style={styles.dateTimeContainer}>
              <Text style={styles.label}>Date</Text>
              <Pressable style={styles.datePickerButton} onPress={openDatePicker}>
                <Text style={date ? styles.datePickerText : styles.datePickerPlaceholder}>
                  {date ? formatDateForDisplay(date) : "Tap to choose a date"}
                </Text>
                <Text style={styles.datePickerChevron}>📅</Text>
              </Pressable>
              {Platform.OS === "ios" && showDatePicker ? (
                <Modal
                  visible={true}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowDatePicker(false)}
                >
                  <Pressable
                    style={styles.pickerModalOverlay}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Pressable style={styles.pickerModalContent} onPress={(e) => e.stopPropagation()}>
                      <DateTimePicker
                        value={pickerDate}
                        mode="date"
                        display="spinner"
                        minimumDate={new Date()}
                        onChange={onDatePickerChange}
                      />
                      <Pressable style={styles.datePickerDone} onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.datePickerDoneText}>Done</Text>
                      </Pressable>
                    </Pressable>
                  </Pressable>
                </Modal>
              ) : showDatePicker && Platform.OS === "android" ? (
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={onDatePickerChange}
                />
              ) : null}
            </View>

            {/* Time - Clock Picker */}
            <View style={styles.dateTimeContainer}>
              <Text style={styles.label}>Time</Text>
              <Pressable style={styles.datePickerButton} onPress={openTimePicker}>
                <Text style={time ? styles.datePickerText : styles.datePickerPlaceholder}>
                  {time ? formatTimeForDisplay(time) : "Tap to choose a time"}
                </Text>
                <Text style={styles.datePickerChevron}>🕐</Text>
              </Pressable>
              {Platform.OS === "ios" && showTimePicker ? (
                <Modal
                  visible={true}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowTimePicker(false)}
                >
                  <Pressable
                    style={styles.pickerModalOverlay}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Pressable style={styles.pickerModalContent} onPress={(e) => e.stopPropagation()}>
                      <DateTimePicker
                        value={pickerTime}
                        mode="time"
                        display="spinner"
                        is24Hour={false}
                        minuteInterval={30}
                        onChange={onTimePickerChange}
                      />
                      <Pressable style={styles.datePickerDone} onPress={() => setShowTimePicker(false)}>
                        <Text style={styles.datePickerDoneText}>Done</Text>
                      </Pressable>
                    </Pressable>
                  </Pressable>
                </Modal>
              ) : showTimePicker && Platform.OS === "android" ? (
                <DateTimePicker
                  value={pickerTime}
                  mode="time"
                  display="default"
                  is24Hour={false}
                  minuteInterval={30}
                  onChange={onTimePickerChange}
                />
              ) : null}
            </View>

            {/* Number of Guests - Mobile Input */}
            <View style={styles.guestsContainer}>
              <Text style={styles.label}>Number of Guests</Text>
              <TextInput
                style={styles.input}
                value={seats}
                onChangeText={(text) => {
                  const numericValue = text.replace(/[^0-9]/g, "");
                  if (numericValue === "") {
                    setSeats("");
                  } else {
                    const num = parseInt(numericValue, 10);
                    if (num >= 1 && num <= 20) setSeats(numericValue);
                  }
                }}
                placeholder="4"
                keyboardType="number-pad"
                returnKeyType="done"
              />
              <Text style={styles.hint}>
                Maximum number of people (including yourself) who can join this lunch (1-20)
              </Text>
            </View>

            {/* Public or Private */}
            <View style={styles.visibilityContainer}>
              <Text style={styles.label}>Visibility</Text>
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
              <Text style={styles.label}>Who can see this lunch? (optional)</Text>
              <Text style={styles.hint}>Leave empty to show to everyone</Text>
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
              <Text style={styles.label}>Send direct invites</Text>
              <Text style={styles.hint}>Select contacts to invite (tap to toggle)</Text>
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
              <Text style={styles.label}>Co-host email (optional)</Text>
              <TextInput
                value={coHostEmail}
                onChangeText={setCoHostEmail}
                placeholder="Enter co-host's email address"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.hint}>
                Co-host can accept/deny requests and manage the lunch like the host
              </Text>
            </View>

            <Pressable style={styles.createButton} onPress={requestCreateLunch}>
              <Text style={styles.createButtonText}>Create Lunch Meet</Text>
            </Pressable>
            <SafetyConfirmModal
              visible={showSafetyConfirm}
              onProceed={createLunch}
              onCancel={() => setShowSafetyConfirm(false)}
            />
          </View>
        )}

        {/* Nearby restaurants map - only show when no restaurant selected */}
        {!selectedPlace && (
        <View style={styles.nearbyMapSection}>
          <View style={styles.nearbyMapHeader}>
            <Text style={styles.nearbyMapTitle}>Nearby restaurants</Text>
            <Text style={styles.nearbyMapHint}>Tap a red pin to see details and choose. Pull down to refresh the map.</Text>
          </View>
          {loadingNearby && (
            <Text style={styles.loadingText}>Loading nearby restaurants…</Text>
          )}
          {nearbyError && (
            <View style={styles.nearbyErrorBox}>
              <Text style={styles.nearbyErrorText}>Could not load nearby restaurants</Text>
              <Text style={styles.nearbyErrorHint}>{nearbyError}</Text>
              {!nearbyError.includes("EXPO_PUBLIC_PLACES_PROXY_URL") && (
                <Text style={[styles.nearbyErrorHint, { marginTop: Spacing.sm }]}>
                  Proxy: {getProxyUrl()}. Run npm run proxy. Set EXPO_PUBLIC_PLACES_PROXY_URL in .env (tunnel URL or your IP if on same Wi‑Fi), then restart Expo and reload.
                </Text>
              )}
            </View>
          )}
          {!loadingNearby && nearbyPlaces.length === 0 && !nearbyError && (
            <View style={styles.nearbyEmptyWrap}>
              <Text style={styles.nearbyEmptyText}>No restaurants on the map.</Text>
              <Text style={styles.nearbyEmptyHint}>
                Run the proxy on your computer (npm run proxy) and connect your device to the same Wi‑Fi, then tap Refresh. Or search for a restaurant above. Enable "Places API" in Google Cloud for nearby search.
              </Text>
              <Text style={[styles.nearbyEmptyHint, { marginTop: Spacing.xs }]}>
                Using proxy: {getProxyUrl()}
              </Text>
            </View>
          )}
          <View style={styles.nearbyMapContainer}>
            {(() => {
              const MapView = require("react-native-maps").default
              const Marker = require("react-native-maps").Marker
              return (
                <MapView
                  ref={nearbyMapRef}
                  style={styles.nearbyMap}
                  initialRegion={mapRegion}
                  onRegionChangeComplete={(region) => {
                    setMapRegion(region)
                    if (nearbyFetchDebounce.current) clearTimeout(nearbyFetchDebounce.current)
                    nearbyFetchDebounce.current = setTimeout(() => {
                      nearbyFetchDebounce.current = null
                      const center = { latitude: region.latitude, longitude: region.longitude }
                      const last = lastFetchedCenter.current
                      if (!last || metersBetween(last, center) >= MIN_FETCH_MOVE_METERS) {
                        fetchNearbyPlaces(center)
                      }
                    }, 800)
                  }}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                  followsUserLocation={false}
                >
                  {nearbyPlaces.map((place) => (
                    <Marker
                      key={place.place_id}
                      coordinate={{ latitude: place.lat, longitude: place.lng }}
                      title={place.name}
                      description={place.vicinity}
                      pinColor="red"
                      onPress={() => setTappedPlaceForInfo(place)}
                    />
                  ))}
                </MapView>
              )
            })()}
          </View>
        </View>
        )}
      </ScrollView>

      {/* Modal: restaurant info when user taps a map marker */}
      <Modal
        visible={!!tappedPlaceForInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setTappedPlaceForInfo(null)}
      >
        <Pressable style={styles.placeModalOverlay} onPress={() => setTappedPlaceForInfo(null)}>
          <Pressable style={styles.placeModalCard} onPress={(e) => e.stopPropagation()}>
            {tappedPlaceForInfo && (
              <>
                <Pressable
                  onPress={() => {
                    const q = tappedPlaceForInfo.vicinity
                      ? `${tappedPlaceForInfo.name} ${tappedPlaceForInfo.vicinity}`
                      : tappedPlaceForInfo.name
                    Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(q)}`)
                  }}
                  style={styles.placeModalTitleWrap}
                >
                  <Text style={styles.placeModalTitle}>{tappedPlaceForInfo.name}</Text>
                  <Text style={styles.placeModalTitleLinkHint}> — view on Google</Text>
                </Pressable>
                {tappedPlaceForInfo.vicinity ? (
                  <Text style={styles.placeModalVicinity}>{tappedPlaceForInfo.vicinity}</Text>
                ) : null}
                <View style={styles.placeModalActions}>
                  <Pressable
                    style={[styles.placeModalButton, styles.placeModalButtonPrimary]}
                    onPress={() => selectPlaceFromMap(tappedPlaceForInfo)}
                  >
                    <Text style={styles.placeModalButtonPrimaryText}>Choose this restaurant</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.placeModalButton, styles.placeModalButtonSecondary]}
                    onPress={() => setTappedPlaceForInfo(null)}
                  >
                    <Text style={styles.placeModalButtonSecondaryText}>Continue browsing</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  searchContainer: { marginBottom: Spacing.xl },
  label: { ...Typography.label, marginBottom: Spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    backgroundColor: Colors.surface,
  },
  loadingText: { marginTop: Spacing.sm, ...Typography.bodySecondary },
  errorContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: { color: Colors.error, fontSize: 14, fontWeight: "600" },
  errorHint: { color: Colors.error, fontSize: 12, marginTop: 4 },
  predictionsContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    maxHeight: 200,
    overflow: "hidden",
  },
  predictionsScroll: { maxHeight: 200, flexGrow: 0 },
  predictionItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  predictionMainText: { fontSize: 16, fontWeight: "500", color: Colors.text },
  predictionSecondaryText: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  selectedContainer: { marginTop: Spacing.xl },
  selectedTitle: { ...Typography.titleSmall, marginBottom: Spacing.sm },
  selectedName: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.link,
    marginBottom: 4,
  },
  selectedAddress: { ...Typography.bodySecondary, marginBottom: Spacing.lg },
  mapContainer: {
    height: 200,
    borderRadius: Radius.md,
    overflow: "hidden",
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  map: { flex: 1 },
  dateTimeContainer: { marginBottom: Spacing.lg },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  datePickerText: { fontSize: 16, color: Colors.text },
  datePickerPlaceholder: { fontSize: 16, color: Colors.textMuted },
  datePickerChevron: { fontSize: 18 },
  datePickerDone: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  datePickerDoneText: { color: "#fff", ...Typography.button },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.xxl,
  },
  guestsContainer: { marginBottom: Spacing.xl },
  hint: { ...Typography.caption, marginTop: 4 },
  visibilityContainer: {
    marginBottom: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  visibilitySection: { marginBottom: Spacing.md },
  visibilitySectionLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
    color: Colors.textSecondary,
  },
  visibilityOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  visibilityOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  visibilityOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  visibilityOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text,
  },
  visibilityOptionTextSelected: {
    color: Colors.primary,
  },
  publicPrivateRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  publicPrivateOption: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  publicPrivateOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  publicPrivateText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  publicPrivateTextSelected: {
    color: Colors.primary,
  },
  publicPrivateHint: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    color: Colors.textSecondary,
  },
  contactListPlaceholder: {
    marginTop: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  contactListPlaceholderText: {
    ...Typography.bodySecondary,
    color: Colors.textMuted,
  },
  contactList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  contactCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center",
  },
  contactCheckboxSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
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
    marginRight: Spacing.md,
  },
  contactAvatarPlaceholder: {
    backgroundColor: Colors.border,
  },
  contactName: {
    ...Typography.body,
    fontSize: 16,
    color: Colors.text,
  },
  coHostContainer: {
    marginBottom: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  createButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: "center",
    marginTop: Spacing.sm,
    ...Shadows.button,
  },
  createButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  nearbyMapSection: { marginTop: Spacing.xxl, marginBottom: Spacing.xxl },
  nearbyMapHeader: { marginBottom: Spacing.sm },
  nearbyMapTitle: { ...Typography.titleSmall, marginBottom: 4 },
  nearbyMapHint: { ...Typography.bodySecondary, marginBottom: 0 },
  nearbyEmptyWrap: { marginBottom: Spacing.md },
  nearbyEmptyText: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  nearbyEmptyHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  nearbyErrorBox: {
    backgroundColor: Colors.errorBg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  nearbyErrorText: { fontSize: 14, color: Colors.error, fontWeight: "600" },
  nearbyErrorHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
  nearbyMapContainer: {
    height: 280,
    borderRadius: Radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nearbyMap: { flex: 1, width: "100%", height: "100%" },
  placeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xxl,
  },
  placeModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 340,
    ...Shadows.card,
  },
  placeModalTitleWrap: { marginBottom: Spacing.sm },
  placeModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.link,
    textDecorationLine: "underline",
  },
  placeModalTitleLinkHint: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.link,
    textDecorationLine: "underline",
  },
  placeModalVicinity: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  placeModalActions: { gap: Spacing.sm },
  placeModalButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  placeModalButtonPrimary: { backgroundColor: Colors.primary },
  placeModalButtonPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  placeModalButtonSecondary: { backgroundColor: Colors.borderLight },
  placeModalButtonSecondaryText: { color: Colors.text, fontSize: 16 },
})
