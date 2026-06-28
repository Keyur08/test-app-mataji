// Push notification setup for the Gey Mati Mata Ji app.
//
// We use `expo-notifications` configured to fetch raw device tokens (FCM on Android, APNs on iOS)
// so that the admin dashboard can send messages directly using the Firebase Admin SDK.
//
// Tokens are saved to Firestore at `push_tokens/<token>`.

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "./firebase";

// Foreground behavior — show banner + play sound when a push arrives while
// the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true, // legacy SDKs
  }),
});

export type PushTokenInfo = {
  /** Either an Expo push token ("ExponentPushToken[...]") or an FCM token. */
  token: string;
  /** "expo" for Expo push tokens, "fcm" / "apns" for raw device tokens. */
  type: "expo" | "fcm" | "apns";
  platform: "ios" | "android" | "web";
};

/**
 * Request notification permission and resolve a push token. Returns null if
 * the user denies or we're on a simulator / unsupported environment.
 */
export async function registerForPushNotificationsAsync(): Promise<PushTokenInfo | null> {
  if (Platform.OS === "web") return null;

  // iOS simulators cannot receive real push tokens; Android emulators *can*
  // (as long as they include Google Play Services), so we only block iOS sims.
  if (!Device.isDevice && Platform.OS === "ios") {
    console.warn("[push] iOS simulator cannot register for push notifications.");
    return null;
  }
  if (!Device.isDevice) {
    console.warn("[push] Running on an emulator — attempting to register anyway.");
  }

  // Android: ensure a default channel exists (required for heads-up display).
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#B8336A",
    });
  }

  // Check / request permission.
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") {
    console.warn("[push] Notification permission not granted.");
    return null;
  }

  try {
    // Primary Choice: Get native device token (FCM on Android, APNs on iOS)
    // This allows your Firebase Admin dashboard to communicate directly via Firebase Admin SDK.
    const dev = await Notifications.getDevicePushTokenAsync();
    return {
      token: typeof dev.data === "string" ? dev.data : String(dev.data),
      type: Platform.OS === "android" ? "fcm" : "apns",
      platform: Platform.OS as "ios" | "android",
    };
  } catch (err) {
    // Fallback: If native retrieval fails (e.g., inside the Expo Go sandbox client app),
    // we fall back to the Expo push token so things don't completely crash during testing.
    try {
      console.warn("[push] Failed native token fetch, trying Expo fallback...", err);
      const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;

      const tokenRes = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
      );

      return {
        token: tokenRes.data,
        type: "expo",
        platform: Platform.OS as "ios" | "android",
      };
    } catch (inner) {
      console.warn("[push] Failed to obtain any push token:", err, inner);
      return null;
    }
  }
}

/**
 * Persist a push token to Firestore so the admin can broadcast to it.
 * Uses the token itself as the document id so the same device only ever has
 * one record.
 */
export async function savePushToken(info: PushTokenInfo): Promise<void> {
  try {
    await setDoc(
        doc(db, "push_tokens", info.token),
        {
          token: info.token,
          type: info.type,
          platform: info.platform,
          deviceName: Device.deviceName ?? null,
          osName: Device.osName ?? null,
          osVersion: Device.osVersion ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
  } catch (err) {
    console.warn("[push] Failed to save token:", err);
  }
}

/**
 * Map a notification's `data` payload to an in-app route.
 */
function routeFromNotification(
    data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data) return null;
  const type = typeof data.type === "string" ? data.type : "";
  const id = typeof data.id === "string" ? data.id : "";
  const url = typeof data.url === "string" ? data.url : "";

  if (type === "news" && id) return `/news/${id}`;
  if (type === "quote") return "/";
  if (type === "niyam") return "/";

  if (url) {
    const m = url.match(/^gmmapp:\/\/([^?#]*)/i);
    if (m) {
      const path = "/" + (m[1] || "").replace(/^\/+/, "");
      return path === "/" ? "/" : path;
    }
  }
  return null;
}

/**
 * Install global listeners that navigate the app when the user taps a
 * notification.
 */
export function useNotificationTapHandler(): void {
  const navState = useRootNavigationState();
  const isReady = !!navState?.key;

  const pendingRouteRef = useRef<string | null>(null);
  const handledIdsRef = useRef<Set<string>>(new Set());

  const handleResponse = (
      response: Notifications.NotificationResponse | null,
  ) => {
    if (!response) return;
    const reqId = response.notification.request.identifier;
    if (handledIdsRef.current.has(reqId)) return;
    handledIdsRef.current.add(reqId);

    const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
    const path = routeFromNotification(data);
    if (!path) return;

    if (isReady) {
      router.push(path as never);
    } else {
      pendingRouteRef.current = path;
    }
  };

  useEffect(() => {
    if (!isReady) return;
    const pending = pendingRouteRef.current;
    if (pending) {
      pendingRouteRef.current = null;
      requestAnimationFrame(() => router.push(pending as never));
    }
  }, [isReady]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let cancelled = false;

    Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (cancelled) return;
          handleResponse(response);
        })
        .catch(() => {
          /* no-op */
        });

    const sub = Notifications.addNotificationResponseReceivedListener(
        (response) => handleResponse(response),
    );

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [isReady]);
}