import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { inArray } from "drizzle-orm";
import { pushTokens } from "@lunchmeet/db";
import { db } from "../db.js";
import { env } from "../env.js";

/**
 * Push notifications via Expo's push service.
 *
 * v1 had none: every notification was in-app only, so a time-sensitive lunch
 * invitation reached nobody unless they happened to open the app. Expo's
 * service handles APNs and FCM credentials, which is the reason for choosing
 * it over talking to those directly.
 */
const expo = new Expo({
  accessToken: env.EXPO_ACCESS_TOKEN,
});

export interface PushPayload {
  userIds: string[];
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export async function sendPush({ userIds, title, body, data }: PushPayload): Promise<void> {
  if (userIds.length === 0) return;

  const rows = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(inArray(pushTokens.userId, userIds));

  const valid = rows.map((r) => r.token).filter((token) => Expo.isExpoPushToken(token));
  if (valid.length === 0) return;

  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    sound: "default",
    title,
    body,
    data: data ?? {},
  }));

  try {
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);

      // A DeviceNotRegistered ticket means the app was uninstalled. Dropping
      // the token stops us retrying it forever.
      const dead: string[] = [];
      receipts.forEach((receipt, index) => {
        if (receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
          const token = chunk[index]?.to;
          if (typeof token === "string") dead.push(token);
        }
      });

      if (dead.length > 0) {
        await db.delete(pushTokens).where(inArray(pushTokens.token, dead));
      }
    }
  } catch (error) {
    // Push is best-effort: failing to notify must never fail the action that
    // triggered it, since the in-app notification row is already committed.
    console.error("Push delivery failed:", error);
  }
}
