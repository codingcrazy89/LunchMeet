import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import NotificationToast from "../components/NotificationToast";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "../components/ErrorBoundary";
import LogViewerModal from "../components/LogViewerModal";
import { Colors } from "../constants/theme";
import { AppLogProvider } from "../src/AppLogContext";
import { AuthProvider, useAuth } from "../src/AuthContext";
import { ContactsProvider } from "../src/ContactsContext";
import { LunchProvider } from "../src/LunchContext";
import { NotificationProvider, useNotifications } from "../src/NotificationContext";

// Keep splash visible until we hide it (guard for standalone builds)
try {
  SplashScreen.preventAutoHideAsync();
} catch (_) {}

function NotificationToastLayer() {
  const { latestToast, dismissToast } = useNotifications();
  if (!latestToast) return null;
  return (
    <NotificationToast notification={latestToast} onDismiss={dismissToast} />
  );
}

function RootNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" }}>
        <ActivityIndicator color="#0d9488" size="large" />
      </View>
    );
  }

  // If user is not authenticated, redirect to login
  // The tabs layout will also check authentication as a secondary safeguard
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile/[id]" />
      <Stack.Screen name="rate-attendees/[lunchId]" />
    </Stack>
  );
}

export default function RootLayout() {
  // Hide native splash: try after interactions, and force-hide after 2.5s so we never get stuck on Android.
  useEffect(() => {
    let cancelled = false;
    const hide = () => {
      if (!cancelled) SplashScreen.hideAsync().catch(() => {});
    };
    const task = InteractionManager.runAfterInteractions(hide);
    const fallback = setTimeout(hide, 2500);
    return () => {
      cancelled = true;
      task.cancel();
      clearTimeout(fallback);
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: Colors.background }}>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
          <StatusBar style="light" />
          <AuthProvider>
            <AppLogProvider>
              <ContactsProvider>
                <LunchProvider>
                  <NotificationProvider>
                    <RootNavigator />
                    <NotificationToastLayer />
                    <LogViewerModal />
                  </NotificationProvider>
                </LunchProvider>
              </ContactsProvider>
            </AppLogProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}





