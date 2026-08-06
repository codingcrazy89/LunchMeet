import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "../components/ErrorBoundary";
import { Colors } from "../constants/theme";
import { AuthProvider, useAuth } from "../src/AuthContext";
import { ContactsProvider } from "../src/ContactsContext";
import { LunchProvider } from "../src/LunchContext";
import { NotificationProvider } from "../src/NotificationContext";
import { queryClient } from "../src/api/queryClient";
import { useRealtime } from "../src/api/realtime";
import { NotificationToastLayer } from "../src/features/notifications/NotificationToastLayer";
import { usePushRegistration } from "../src/features/notifications/usePushRegistration";

// Keep splash visible until we hide it (guard for standalone builds)
try {
  SplashScreen.preventAutoHideAsync();
} catch {
  // Splash control is unavailable in some standalone build configurations.
}

function RootNavigator() {
  const { loading, user } = useAuth();

  // Both are no-ops until there is a session to authenticate them with.
  useRealtime(Boolean(user));
  usePushRegistration(Boolean(user));

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

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
  // Hide the native splash after interactions, with a timeout so a slow first
  // render can never leave the app stuck behind it on Android.
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

  /**
   * Provider tree, down from six to three.
   *
   * QueryClientProvider replaces LunchContext, ContactsContext and
   * NotificationContext, whose combined job was caching server state and
   * signalling when to refetch. AppLogProvider is gone entirely: it patched
   * console methods into a buffer that captured auth deep links containing
   * session tokens.
   */
  return (
    <ErrorBoundary>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: Colors.background }}>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
          <StatusBar style="light" />
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ContactsProvider>
                <LunchProvider>
                  <NotificationProvider>
                    <RootNavigator />
                    <NotificationToastLayer />
                  </NotificationProvider>
                </LunchProvider>
              </ContactsProvider>
            </AuthProvider>
          </QueryClientProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
