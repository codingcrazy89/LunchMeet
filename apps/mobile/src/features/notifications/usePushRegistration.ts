import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { api } from "../../api/client";

/**
 * Registers the device for push notifications and sends the token to the API.
 *
 * v1 shipped with no push at all, so a lunch invitation reached nobody unless
 * they happened to open the app. Registration is deliberately best-effort: a
 * user who declines the permission still gets in-app notifications.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPush(): Promise<string | null> {
  // Push tokens are not issued to simulators.
  if (!Constants.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Lunch updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return token.data;
}

export function usePushRegistration(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const token = await registerForPush();
        if (!token || cancelled) return;

        await api.v2.push.tokens.$post({
          json: {
            token,
            platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
          },
        });
      } catch (error) {
        // Never block sign-in on push registration.
        console.warn("Push registration skipped:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
