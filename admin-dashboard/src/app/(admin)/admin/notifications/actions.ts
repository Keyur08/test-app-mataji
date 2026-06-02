"use server";

// Server action to broadcast a push notification to every registered device.
// Reads `push_tokens/*` from Firestore, splits the list into:
//   • Expo push tokens → delivered via the Expo Push API
//   • Raw FCM tokens   → delivered via firebase-admin messaging.sendEachForMulticast
//
// Returns counts of successes / failures + the first few error messages so the
// admin can react.

import "server-only";
import { getMessaging } from "firebase-admin/messaging";

import { adminApp, adminDb } from "@/lib/firebaseAdmin";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type BroadcastInput = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type BroadcastResult = {
  totalTokens: number;
  successCount: number;
  failureCount: number;
  errors: string[];
  invalidTokensRemoved: number;
};

type StoredToken = {
  token: string;
  type: "expo" | "fcm" | "apns";
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadTokens(): Promise<StoredToken[]> {
  const snap = await adminDb.collection("push_tokens").get();
  return snap.docs
      .map((d) => {
        const data = d.data() as Partial<StoredToken>;
        const token = data.token || d.id;
        if (!token) return null;
        // Heuristic: any token that looks like ExponentPushToken[…] is Expo.
        const type: StoredToken["type"] =
            data.type ?? (token.startsWith("ExponentPushToken") ? "expo" : "fcm");
        return { token, type };
      })
      .filter((t): t is StoredToken => !!t);
}

async function removeInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const batch = adminDb.batch();
  tokens.forEach((t) =>
      batch.delete(adminDb.collection("push_tokens").doc(t))
  );
  await batch.commit();
}

async function sendViaFcm(
    tokens: string[],
    payload: BroadcastInput
): Promise<{ success: number; failure: number; invalid: string[]; errors: string[] }> {
  if (tokens.length === 0)
    return { success: 0, failure: 0, invalid: [], errors: [] };
// ⚠️ ADD THIS PROTECTION GUARD BLOCK:
  if (!adminApp) {
    console.error("Firebase Admin App is not initialized.");
    return { success: 0, failure: 0, invalid: [], errors: ["Admin SDK not ready"] };
  }

// TypeScript now guarantees that adminApp is defined for this call

  const messaging = getMessaging(adminApp);
  let success = 0;
  let failure = 0;
  const invalid: string[] = [];
  const errors: string[] = [];

  for (const group of chunk(tokens, 500)) {
    const res = await messaging.sendEachForMulticast({
      tokens: group,
      notification: { title: payload.title, body: payload.body },
      data: {
        // Strings only — FCM requires all data values to be strings.
        title: payload.title,
        body: payload.body,
        ...(payload.data ?? {}),
      },
      android: {
        priority: "high",
        notification: {
          channelId: "default",
          sound: "default",
          defaultSound: true,
          defaultVibrateTimings: true,
          priority: "high",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            "content-available": 1,
          },
        },
      },
    });
    success += res.successCount;
    failure += res.failureCount;
    res.responses.forEach((r, i) => {
      if (!r.success && r.error) {
        const code = r.error.code;
        if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
        ) {
          invalid.push(group[i]);
        }
        if (errors.length < 5) errors.push(`${code}: ${r.error.message}`);
      }
    });
  }

  return { success, failure, invalid, errors };
}

async function sendViaExpo(
    tokens: string[],
    payload: BroadcastInput
): Promise<{ success: number; failure: number; invalid: string[]; errors: string[] }> {
  if (tokens.length === 0)
    return { success: 0, failure: 0, invalid: [], errors: [] };
  let success = 0;
  let failure = 0;
  const invalid: string[] = [];
  const errors: string[] = [];

  for (const group of chunk(tokens, 100)) {
    const messages = group.map((to) => ({
      to,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      priority: "high",
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      const json = (await res.json()) as {
        data?: Array<{
          status: "ok" | "error";
          id?: string;
          message?: string;
          details?: { error?: string };
        }>;
        errors?: Array<{ message?: string }>;
      };

      if (json.errors?.length) {
        json.errors.forEach((e) => {
          failure += 1;
          if (errors.length < 5) errors.push(e.message ?? "Unknown Expo error");
        });
        continue;
      }

      json.data?.forEach((tic, i) => {
        if (tic.status === "ok") {
          success += 1;
        } else {
          failure += 1;
          if (
              tic.details?.error === "DeviceNotRegistered" ||
              tic.details?.error === "InvalidCredentials"
          ) {
            invalid.push(group[i]);
          }
          if (errors.length < 5)
            errors.push(tic.message ?? tic.details?.error ?? "Expo ticket error");
        }
      });
    } catch (e) {
      failure += group.length;
      if (errors.length < 5)
        errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return { success, failure, invalid, errors };
}

export async function broadcastNotification(
    input: BroadcastInput
): Promise<BroadcastResult> {
  const title = input.title?.trim();
  const body = input.body?.trim();

  if (!title || !body) {
    throw new Error("Title and body are required.");
  }

  const tokens = await loadTokens();
  if (tokens.length === 0) {
    return {
      totalTokens: 0,
      successCount: 0,
      failureCount: 0,
      errors: ["No registered devices."],
      invalidTokensRemoved: 0,
    };
  }

  const expoTokens = tokens.filter((t) => t.type === "expo").map((t) => t.token);
  const fcmTokens = tokens.filter((t) => t.type !== "expo").map((t) => t.token);

  const payload: BroadcastInput = { title, body, data: input.data };

  const [expoRes, fcmRes] = await Promise.all([
    sendViaExpo(expoTokens, payload),
    sendViaFcm(fcmTokens, payload),
  ]);

  const invalid = [...expoRes.invalid, ...fcmRes.invalid];
  await removeInvalidTokens(invalid);

  // Record the broadcast for audit/history.
  await adminDb.collection("notification_broadcasts").add({
    title,
    body,
    data: input.data ?? null,
    totalTokens: tokens.length,
    successCount: expoRes.success + fcmRes.success,
    failureCount: expoRes.failure + fcmRes.failure,
    invalidTokensRemoved: invalid.length,
    sentAt: new Date(),
  });

  return {
    totalTokens: tokens.length,
    successCount: expoRes.success + fcmRes.success,
    failureCount: expoRes.failure + fcmRes.failure,
    errors: [...expoRes.errors, ...fcmRes.errors].slice(0, 5),
    invalidTokensRemoved: invalid.length,
  };
}

export async function countRegisteredDevices(): Promise<number> {
  const snap = await adminDb.collection("push_tokens").count().get();
  return snap.data().count;
}