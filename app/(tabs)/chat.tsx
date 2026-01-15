import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/AuthContext";

type Message = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_profile?: {
    name: string;
    photos?: string[];
  };
};

export default function ChatScreen() {
  const { lunchId } = useLocalSearchParams<{ lunchId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);
  const [lunchDetails, setLunchDetails] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!lunchId) return;

    loadChatRoom();
    loadCurrentUserPhoto();
    loadLunchDetails();
    return () => {
      // Cleanup subscription
    };
  }, [lunchId, user?.id]);

  const loadCurrentUserPhoto = async () => {
    if (!user?.id) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("photos")
      .eq("id", user.id)
      .single();

    if (profile?.photos && Array.isArray(profile.photos) && profile.photos.length > 0) {
      setCurrentUserPhoto(profile.photos[0]);
    }
  };

  const loadLunchDetails = async () => {
    if (!lunchId) return;

    // Fetch lunch details
    const { data: lunch, error: lunchError } = await supabase
      .from("lunches")
      .select(`
        id,
        restaurant,
        restaurant_address,
        place_id,
        date_time,
        host_id,
        lunch_attendees (
          id,
          user_id,
          status,
          profiles:user_id (
            id,
            name
          )
        )
      `)
      .eq("id", lunchId)
      .single();

    if (lunchError || !lunch) {
      console.error("Error loading lunch details:", lunchError);
      return;
    }

    setLunchDetails(lunch);

    // Get accepted attendees
    const acceptedAttendeeIds = (lunch.lunch_attendees || [])
      .filter((a: any) => a.status === "accepted" || !a.status)
      .map((a: any) => a.user_id);

    // Include host in the list
    const allParticipantIds = [...new Set([lunch.host_id, ...acceptedAttendeeIds])];

    // Fetch all attendee profiles
    const { data: attendeeProfiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", allParticipantIds);

    // Map to include host first, then others
    const attendeesList = [];
    if (attendeeProfiles) {
      // Add host first
      const host = attendeeProfiles.find((p: any) => p.id === lunch.host_id);
      if (host) {
        attendeesList.push({ id: host.id, name: host.name });
      }
      // Add other attendees
      attendeeProfiles
        .filter((p: any) => p.id !== lunch.host_id)
        .forEach((p: any) => {
          attendeesList.push({ id: p.id, name: p.name });
        });
    }

    setAttendees(attendeesList);
  };

  useEffect(() => {
    if (!chatRoomId) return;

    loadMessages();
    subscribeToMessages();
  }, [chatRoomId]);

  const loadChatRoom = async () => {
    if (!lunchId) return;

    // Get or create chat room
    const { data: roomData, error: roomError } = await supabase.rpc(
      "get_or_create_chat_room",
      { p_lunch_id: lunchId }
    );

    if (roomError) {
      // Fallback: try to find existing room
      const { data: existingRoom } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("lunch_id", lunchId)
        .single();

      if (existingRoom) {
        setChatRoomId(existingRoom.id);
      } else {
        // Create room directly
        const { data: newRoom, error: createError } = await supabase
          .from("chat_rooms")
          .insert({ lunch_id: lunchId })
          .select()
          .single();

        if (newRoom) {
          setChatRoomId(newRoom.id);
        } else {
          console.error("Could not create chat room:", createError);
        }
      }
    } else {
      setChatRoomId(roomData);
    }
  };

  const loadMessages = async () => {
    if (!chatRoomId) {
      console.log("No chatRoomId, cannot load messages");
      return;
    }

    console.log("Loading messages for chat room:", chatRoomId);
    setLoading(true);
    
    const { data, error } = await supabase
      .from("messages")
      .select(`
        id,
        sender_id,
        message,
        created_at
      `)
      .eq("chat_room_id", chatRoomId)
      .order("created_at", { ascending: true });

    console.log("Messages query result:", { data, error, count: data?.length });

    if (error) {
      console.error("Error loading messages:", error);
      setLoading(false);
      if (typeof window !== "undefined" && window.alert) {
        alert("Error loading messages: " + error.message);
      }
      return;
    }

    // Fetch sender profiles separately (including photos)
    const senderIds = [...new Set((data || []).map((msg: any) => msg.sender_id))];
    let profileMap = new Map();
    
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, photos")
        .in("id", senderIds);
      
      profileMap = new Map(
        (profiles || []).map((p: any) => [
          p.id, 
          {
            name: p.name,
            photos: Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : [])
          }
        ])
      );
    }

    // Normalize the response
    const normalizedMessages: Message[] = (data || []).map((msg: any) => ({
      id: msg.id,
      sender_id: msg.sender_id,
      message: msg.message,
      created_at: msg.created_at,
      sender_profile: profileMap.get(msg.sender_id) || null,
    }));

    console.log("Normalized messages:", normalizedMessages);
    setMessages(normalizedMessages);
    setLoading(false);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const subscribeToMessages = () => {
    if (!chatRoomId) {
      console.log("No chatRoomId, cannot subscribe to messages");
      return;
    }

    console.log("Subscribing to messages for chat room:", chatRoomId);

    const channel = supabase
      .channel(`chat:${chatRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_room_id=eq.${chatRoomId}`,
        },
        async (payload) => {
          console.log("New message received via subscription:", payload);
          
          // Fetch sender profile (including photos)
          const { data: profileData } = await supabase
            .from("profiles")
            .select("name, photos")
            .eq("id", payload.new.sender_id)
            .single();

          const normalizedProfile = profileData ? {
            name: profileData.name,
            photos: Array.isArray(profileData.photos) 
              ? profileData.photos 
              : (profileData.photos ? [profileData.photos] : [])
          } : null;

          const newMessage: Message = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            message: payload.new.message,
            created_at: payload.new.created_at,
            sender_profile: normalizedProfile,
          };

          console.log("Adding message to list:", newMessage);
          setMessages((prev) => {
            // Check if message already exists to avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) {
              console.log("Message already in list, skipping");
              return prev;
            }
            return [...prev, newMessage];
          });
          
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      console.log("Unsubscribing from chat channel");
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatRoomId || !user) {
      console.log("Cannot send message:", { 
        hasMessage: !!newMessage.trim(), 
        chatRoomId, 
        userId: user?.id 
      });
      return;
    }

    const messageText = newMessage.trim();
    setNewMessage("");

    console.log("Sending message:", { 
      chatRoomId, 
      senderId: user.id, 
      message: messageText 
    });

    const { data, error } = await supabase
      .from("messages")
      .insert({
        chat_room_id: chatRoomId,
        sender_id: user.id,
        message: messageText,
      })
      .select();

    console.log("Message insert result:", { data, error });

    if (error) {
      console.error("Error sending message:", error);
      if (typeof window !== "undefined" && window.alert) {
        alert("Failed to send message: " + error.message + ". This might be a permissions issue. Please check your database Row Level Security policies.");
      }
      setNewMessage(messageText); // Restore message
      return;
    }

    // If insert succeeded, reload messages to ensure we have the latest
    // This handles cases where real-time subscription might not fire immediately
    if (data && data.length > 0) {
      console.log("Message sent successfully, reloading messages");
      // Reload messages after a short delay to ensure DB consistency
      setTimeout(() => {
        loadMessages();
      }, 200);
    } else {
      // If no data returned (RLS might hide it), reload messages to check if it was saved
      console.warn("Message sent but no data returned - reloading messages to verify");
      setTimeout(() => {
        loadMessages();
      }, 300);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "Date TBD";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const openRestaurantInMaps = () => {
    if (!lunchDetails) return;
    
    let url = "";
    if (lunchDetails.place_id) {
      url = `https://www.google.com/maps/place/?q=place_id:${lunchDetails.place_id}`;
    } else if (lunchDetails.restaurant_address) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lunchDetails.restaurant_address)}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lunchDetails.restaurant)}`;
    }
    
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Lunch Details Header */}
      {lunchDetails && (
        <View style={styles.headerContainer}>
          <Pressable onPress={openRestaurantInMaps}>
            <Text style={styles.restaurantName}>
              {lunchDetails.restaurant}
            </Text>
          </Pressable>
          <Text style={styles.dateTime}>
            {formatDateTime(lunchDetails.date_time)}
          </Text>
          <View style={styles.attendeesList}>
            <Text style={styles.attendeesLabel}>
              Attendees ({attendees.length}):
            </Text>
            <View style={styles.attendeesRow}>
              {attendees.map((attendee) => (
                <Pressable
                  key={attendee.id}
                  onPress={() => router.push(`/profile/${attendee.id}`)}
                  style={styles.attendeeChip}
                >
                  <Text style={styles.attendeeChipText}>{attendee.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
          </View>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.sender_id === user?.id;
            const senderPhoto = msg.sender_profile?.photos?.[0];
            const senderName = msg.sender_profile?.name || "Unknown";
            
            return (
              <View
                key={msg.id}
                style={[
                  styles.messageWrapper,
                  isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper,
                ]}
              >
                {!isOwnMessage && (
                  <View style={styles.otherMessageHeader}>
                    {senderPhoto ? (
                      <Image source={{ uri: senderPhoto }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarText}>
                          {senderName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.senderName}>{senderName}</Text>
                  </View>
                )}
                {isOwnMessage && (
                  <View style={styles.ownMessageHeader}>
                    <Text style={styles.ownSenderName}>You</Text>
                    {currentUserPhoto ? (
                      <Image source={{ uri: currentUserPhoto }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarText}>Y</Text>
                      </View>
                    )}
                  </View>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    isOwnMessage ? styles.ownMessage : styles.otherMessage,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                    ]}
                  >
                    {msg.message}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
                    ]}
                  >
                    {formatTime(msg.created_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          onSubmitEditing={sendMessage}
        />
        <Pressable
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  headerContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0066cc",
    textDecorationLine: "underline",
    marginBottom: 4,
  },
  dateTime: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  attendeesList: {
    marginTop: 8,
  },
  attendeesLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  attendeesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attendeeChip: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0066cc",
  },
  attendeeChipText: {
    fontSize: 12,
    color: "#0066cc",
    fontWeight: "500",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    color: "#999",
    fontSize: 16,
  },
  messageWrapper: {
    marginBottom: 12,
  },
  ownMessageWrapper: {
    alignItems: "flex-end",
  },
  otherMessageWrapper: {
    alignItems: "flex-start",
  },
  otherMessageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    marginLeft: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarPlaceholder: {
    backgroundColor: "#0066cc",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  senderName: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  ownMessageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    marginRight: 4,
    justifyContent: "flex-end",
  },
  ownSenderName: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    backgroundColor: "#0066cc",
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: "#fff",
  },
  otherMessageText: {
    color: "#000",
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  ownMessageTime: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  otherMessageTime: {
    color: "#999",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
