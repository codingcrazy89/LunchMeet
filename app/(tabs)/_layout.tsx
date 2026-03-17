import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import RatePromptModal from "../../components/RatePromptModal";
import SafetyTipsModal from "../../components/SafetyTipsModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radius, Spacing, Typography } from "../../constants/theme";
import NotificationsModal from "../../components/NotificationsModal";
import { useAuth } from "../../src/AuthContext";
import { useLunches } from "../../src/LunchContext";
import { useNotifications } from "../../src/NotificationContext";
import { supabase } from "../../src/lib/supabase";

function AppHeader() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const router = useRouter();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const hasNotifications = unreadCount > 0;

  useEffect(() => {
    if (user?.id) {
      const t = setTimeout(loadProfileName, 2000);
      const channel = supabase
        .channel(`profile-${user.id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, (payload) => {
          setProfileName(payload.new.name || null);
        })
        .subscribe();
      return () => {
        clearTimeout(t);
        supabase.removeChannel(channel);
      };
    } else setProfileName(null);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { if (user?.id) loadProfileName(); }, [user?.id]));

  const loadProfileName = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      setProfileName(data?.name || null);
    } catch (err) {
      console.warn("loadProfileName network error:", err);
    }
  };

  const displayName = profileName || user?.email?.split("@")[0] || "You";

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.headerLeft}>
        <Image source={require("../../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandTitle}>LunchMeet</Text>
      </View>
      {user ? (
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setShowNotificationsModal(true)}
            style={styles.iconButton}
            hitSlop={12}
          >
            <View>
              <Ionicons
                name="notifications"
                size={24}
                color={hasNotifications ? Colors.primary : Colors.textSecondary}
              />
              {hasNotifications && <View style={styles.notificationDot} />}
            </View>
          </Pressable>
          <Pressable onPress={() => router.push("/profile")} style={styles.iconButton} hitSlop={12}>
            <Ionicons name="person-circle-outline" size={26} color={Colors.text} />
          </Pressable>
          <Pressable onPress={() => { if (Platform.OS === "web" && window.confirm("Log out?")) signOut(); else signOut(); }} hitSlop={12}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
          <NotificationsModal
            visible={showNotificationsModal}
            notifications={notifications}
            onClose={() => setShowNotificationsModal(false)}
            onMarkAsRead={(id) => markAsRead(id)}
            onMarkAllAsRead={() => markAllAsRead()}
          />
        </View>
      ) : (
        <Pressable onPress={() => router.push("/login")} style={styles.loginPill}>
          <Text style={styles.loginPillText}>Log in</Text>
        </Pressable>
      )}
    </View>
  );
}

const SAFETY_TIPS_SEEN_KEY = "lunchmeet_has_seen_safety_tips";

const RATING_PROMPT_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { invites, lunches } = useLunches();
  const insets = useSafeAreaInsets();
  const [openingPhase, setOpeningPhase] = useState(true);
  const [showSafetyTips, setShowSafetyTips] = useState(false);
  const [lunchNeedingRating, setLunchNeedingRating] = useState<{ id: string; restaurant: string } | null>(null);

  const inviteCount = invites?.length ?? 0;
  const pendingRequestCount = user
    ? lunches.reduce((sum, lunch) => {
        const isHostOrCoHost = lunch.host_id === user.id || lunch.co_host_id === user.id;
        if (!isHostOrCoHost) return sum;
        const pending = lunch.lunch_attendees?.filter((a) => a.status === "pending") ?? [];
        return sum + pending.length;
      }, 0)
    : 0;

  // One short "Opening…" frame after mount so we can see we reached the tabs (helps debug blank screen on Android).
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => setOpeningPhase(false), 250);
    return () => clearTimeout(t);
  }, [user]);

  // Show safety tips modal on first app launch (when user is logged in)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    AsyncStorage.getItem(SAFETY_TIPS_SEEN_KEY).then((value) => {
      if (!cancelled && value !== "true") {
        setShowSafetyTips(true);
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  const handleCloseSafetyTips = useCallback(() => {
    setShowSafetyTips(false);
    AsyncStorage.setItem(SAFETY_TIPS_SEEN_KEY, "true");
  }, []);

  const checkLunchesNeedingRating = useCallback(async () => {
    if (!user?.id || lunches.length === 0) return;
    const cutoff = Date.now() - RATING_PROMPT_AFTER_MS;
    for (const lunch of lunches) {
      const lunchEnd = new Date(lunch.date_time).getTime();
      if (lunchEnd > cutoff) continue;
      const isHost = lunch.host_id === user.id;
      const isCoHost = lunch.co_host_id === user.id;
      const isAccepted = (lunch.lunch_attendees ?? []).some(
        (a) => a.user_id === user.id && (a.status === "accepted" || !a.status)
      );
      if (!isHost && !isCoHost && !isAccepted) continue;
      const otherIds = new Set<string>();
      if (lunch.host_id && lunch.host_id !== user.id) otherIds.add(lunch.host_id);
      if (lunch.co_host_id && lunch.co_host_id !== user.id) otherIds.add(lunch.co_host_id);
      (lunch.lunch_attendees ?? []).forEach((a) => {
        if (a.user_id && a.user_id !== user.id && (a.status === "accepted" || !a.status))
          otherIds.add(a.user_id);
      });
      if (otherIds.size === 0) continue;
      const { data: ratings } = await supabase
        .from("user_ratings")
        .select("rated_id")
        .eq("rater_id", user.id)
        .eq("lunch_id", lunch.id);
      const ratedIds = new Set((ratings ?? []).map((r: { rated_id: string }) => r.rated_id));
      if (ratedIds.size < otherIds.size) {
        setLunchNeedingRating({ id: lunch.id, restaurant: lunch.restaurant || "the lunch" });
        return;
      }
    }
    setLunchNeedingRating(null);
  }, [user?.id, lunches]);

  useFocusEffect(useCallback(() => { checkLunchesNeedingRating(); }, [checkLunchesNeedingRating]));

  useEffect(() => {
    if (!user?.id) return;
    // Defer 3s so it doesn't compete with initial fetchLunches (reduces timeout risk)
    const t = setTimeout(checkLunchesNeedingRating, 3000);
    const interval = setInterval(checkLunchesNeedingRating, 60 * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [user?.id, checkLunchesNeedingRating]);

  // Redirect to login if not authenticated
  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background }}>
        <Text style={{ ...Typography.bodySecondary, color: Colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  // Brief visible "Opening…" so we know we reached tabs (if you see this then blank, the crash is in tab content).
  if (openingPhase) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background }}>
        <Text style={{ ...Typography.bodySecondary, color: Colors.textMuted }}>Opening…</Text>
      </View>
    );
  }

  const tabBarHeight = 64 + Math.max(insets.bottom, 0);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <AppHeader />
      <SafetyTipsModal visible={showSafetyTips} onClose={handleCloseSafetyTips} />
      <RatePromptModal
        visible={!!lunchNeedingRating}
        lunchId={lunchNeedingRating?.id ?? ""}
        restaurant={lunchNeedingRating?.restaurant ?? ""}
        onClose={() => setLunchNeedingRating(null)}
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.tabIconDefault,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.borderLight,
            borderTopWidth: 1,
            paddingTop: Spacing.sm,
            paddingBottom: Math.max(insets.bottom, Spacing.sm),
            height: tabBarHeight,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
          },
          tabBarItemStyle: {
            paddingVertical: Spacing.xs,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Lunches",
            tabBarLabel: "Lunches",
            tabBarBadge: inviteCount > 0 ? inviteCount : undefined,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="host"
          options={{
            title: "Host",
            tabBarLabel: "Host",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={26} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="my-lunches"
          options={{
            title: "My Lunches",
            tabBarLabel: "My Lunches",
            tabBarBadge: pendingRequestCount > 0 ? pendingRequestCount : undefined,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarLabel: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{ title: "Chat", href: null, tabBarStyle: { display: "none" } }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    ...Typography.titleSmall,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  iconButton: {
    padding: Spacing.xs,
  },
  notificationDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  logoutText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  loginPill: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
  },
  loginPillText: {
    ...Typography.buttonSmall,
    color: "#fff",
  },
});




