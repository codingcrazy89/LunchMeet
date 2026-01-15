import { Tabs, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/AuthContext";

function BrandHeader() {
  return (
    <View style={styles.brandHeader}>
      <Text style={styles.logo}>🍽️</Text>
      <Text style={styles.brandTitle}>Lunch Meet</Text>
    </View>
  );
}

function AuthHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Log out?")) signOut();
      return;
    }
    signOut();
  };

  const handleLogin = () => {
    router.push("/login");
  };

  return (
    <View style={styles.header}>
      {user ? (
        <>
          <Text style={styles.email}>{user.email}</Text>
          <Pressable onPress={handleLogout}>
            <Text style={styles.logout}>Log Out</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={handleLogin} style={styles.loginButton}>
          <Text style={styles.loginText}>Login</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <>
      <BrandHeader />
      <AuthHeader />
      <Tabs screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" options={{ title: "Lunches" }} />
        <Tabs.Screen name="host" options={{ title: "Host" }} />
        <Tabs.Screen name="my-lunches" options={{ title: "My Lunches" }} />
        <Tabs.Screen 
          name="chat" 
          options={{ 
            title: "Chat",
            href: null // Hide from tab bar, only accessible via navigation
          }} 
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0066cc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderBottomWidth: 2,
    borderColor: "#0052a3",
  },
  logo: {
    fontSize: 28,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f5f5f5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  email: {
    fontSize: 12,
    color: "#333",
  },
  logout: {
    color: "#c62828",
    fontWeight: "600",
  },
  loginButton: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#0066cc",
    borderRadius: 6,
  },
  loginText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});




