// Exchanges a short-lived Firebase ID token (sent from the mobile app's
// WebView) for a custom token that the dashboard's client SDK can use to
// sign in automatically. We also enforce the same `admins/{uid}` gate as
// firestore.rules so non-admins can never bypass the login screen via
// this endpoint.

import { NextResponse, type NextRequest } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorRedirect(req: NextRequest, reason: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const nextParam = req.nextUrl.searchParams.get("next") || "/admin";

  // Only allow relative `next` paths to prevent open-redirects.
  const safeNext = nextParam.startsWith("/") ? nextParam : "/admin";

  if (!token) return errorRedirect(req, "missing-token");

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    uid = decoded.uid;
  } catch {
    return errorRedirect(req, "invalid-token");
  }

  // Admin gate — same shape as firestore.rules.
  try {
    const adminDoc = await adminDb.collection("admins").doc(uid).get();
    if (!adminDoc.exists) return errorRedirect(req, "not-admin");
  } catch {
    return errorRedirect(req, "server-error");
  }

  let customToken: string;
  try {
    customToken = await adminAuth.createCustomToken(uid);
  } catch {
    return errorRedirect(req, "mint-failed");
  }

  const bridge = new URL("/admin-bridge", req.url);
  bridge.searchParams.set("ct", customToken);
  bridge.searchParams.set("next", safeNext);
  return NextResponse.redirect(bridge);
}
