import { useState, useEffect, useRef } from "react"
import { Pressable, Text, TextInput, View, StyleSheet, Linking, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { supabase } from "../../src/lib/supabase"
import { useLunches } from "../../src/LunchContext"

export default function HostScreen() {
  const router = useRouter()
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

  async function searchRestaurants(text: string) {
    setQuery(text)

    // Clear previous debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (text.length < 2) {
      setPredictions([])
      return
    }

    // Debounce API calls
    debounceTimer.current = setTimeout(async () => {
      setLoading(true)

      try {
        const response = await fetch(
          `http://localhost:8787/places/autocomplete?input=${encodeURIComponent(text)}`
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.error) {
          console.error("API error:", data.error)
          setError(data.error)
          setPredictions([])
        } else {
          setError(null)
          setPredictions(data.predictions || [])
        }
      } catch (err: any) {
        console.error("Search failed:", err)
        setPredictions([])
        setError(`Failed to connect to proxy server. Make sure it's running: npm run proxy`)
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
      const response = await fetch(
        `http://localhost:8787/places/details?place_id=${encodeURIComponent(prediction.place_id)}`
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

  async function createLunch() {
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

    const { error } = await supabase.from("lunches").insert({
      host_id: user.id,
      restaurant: selectedPlace.name,
      restaurant_name: selectedPlace.name,
      restaurant_address: selectedPlace.address,
      place_id: selectedPlace.place_id,
      latitude: selectedPlace.lat,
      longitude: selectedPlace.lng,
      date_time: dateTime,
      seats: parseInt(seats),
      description: "", // Can be made configurable later
    })

    if (error) {
      console.error("Error creating lunch:", error)
      alert("Failed to create lunch. Please try again.")
      return
    }

    // Reset form
    setQuery("")
    setSelectedPlace(null)
    setDate("")
    setTime("")
    setSeats("4")
    
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
              const url = `https://www.google.com/maps/place/?q=place_id:${selectedPlace.place_id}`
              Linking.openURL(url)
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
            onPress={createLunch}
            style={[
              styles.submitButton,
              (!selectedPlace || !date || !time || !seats) && styles.submitButtonDisabled
            ]}
          >
            <Text style={styles.submitButtonText}>
              Host Lunch
            </Text>
          </Pressable>
          
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