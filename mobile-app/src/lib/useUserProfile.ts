// Identity model
// ---------------
// We key profiles by **mobile number** so the same devotee gets the same
// document whether they open the app on a new install, on another device,
// or on the web. The anonymous Firebase Auth UID is *not* the identity —
// it's only used to satisfy Firestore Rules; we track every UID that has
// claimed this profile inside a `uids: string[]` array on the doc.
//
// Flow:
//   1. Get an anonymous Firebase auth session (so writes can pass rules).
//   2. Read the last-known mobile from AsyncStorage. If present, subscribe
//      to `users/{mobile}` — the cross-device "ready" path.
//   3. If no mobile is saved → status = "missing" → /register screen.
//   4. After /register submits, it calls `setActiveMobile(mobile)`; we
//      persist it and start listening to that doc.

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db, ensureAnonymousUser } from "./firebase";
import type { UserProfile } from "../../../shared/types";

export type ProfileStatus = "loading" | "missing" | "ready";

const ACTIVE_MOBILE_KEY = "@gyey/active_mobile_v1";
const LOADING_TIMEOUT_MS = 6000;

// Module-level so any caller (register screen, settings, etc.) can update
// the active mobile and every mounted hook re-subscribes.
const mobileListeners = new Set<(m: string | null) => void>();
let cachedMobile: string | null = null;

export async function setActiveMobile(mobile: string | null) {
  cachedMobile = mobile;
  try {
    if (mobile) await AsyncStorage.setItem(ACTIVE_MOBILE_KEY, mobile);
    else await AsyncStorage.removeItem(ACTIVE_MOBILE_KEY);
  } catch {
    /* ignore storage errors */
  }
  mobileListeners.forEach((cb) => cb(mobile));
}

export function useUserProfile() {
  const [uid, setUid] = useState<string | null>(
    () => auth.currentUser?.uid ?? null,
  );
  const [mobile, setMobile] = useState<string | null>(cachedMobile);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<ProfileStatus>("loading");
  const [authError, setAuthError] = useState<string | null>(null);

  // 1) Track the Firebase Auth session, but DO NOT create one automatically.
  //    A new anonymous UID is only created when the devotee actually
  //    registers (see `register.tsx` → `ensureAnonymousAuth`) or, for a
  //    returning user on this same device, when we have a saved mobile
  //    that we need to read from Firestore (see effect below).
  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setUid(u?.uid ?? null);
        if (u) setAuthError(null);
      },
      (err: any) => {
        // eslint-disable-next-line no-console
        console.warn("[useUserProfile] onAuthStateChanged error:", err);
        setAuthError(err?.message || "auth/listener-error");
        setStatus("missing");
      },
    );
    return unsub;
  }, []);

  // 1b) Returning-user auth: if this device already has a saved mobile,
  //     we need a Firebase auth session to satisfy `users/{mobile}` rules.
  //     `ensureAnonymousUser` waits for AsyncStorage persistence to
  //     hydrate before deciding whether to mint a new anon user, so a
  //     returning device reuses its existing UID instead of creating a
  //     duplicate one every cold start.
  useEffect(() => {
    if (!mobile) return;
    if (auth.currentUser) return;
    ensureAnonymousUser().catch((err: any) => {
      // eslint-disable-next-line no-console
      console.warn(
        "[useUserProfile] ensureAnonymousUser (returning user) failed:",
        err?.code || err?.message || err,
      );
      setAuthError(err?.code || err?.message || "auth/unknown");
      setStatus("missing");
    });
  }, [mobile]);

  // 2) Load remembered mobile on mount + subscribe to module-level changes.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ACTIVE_MOBILE_KEY)
      .then((m) => {
        if (cancelled) return;
        cachedMobile = m;
        setMobile(m);
        if (!m) setStatus("missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });

    const cb = (m: string | null) => setMobile(m);
    mobileListeners.add(cb);
    return () => {
      cancelled = true;
      mobileListeners.delete(cb);
    };
  }, []);

  // 3) Subscribe to `users/{mobile}` once we know the mobile.
  useEffect(() => {
    if (!mobile) {
      // Sign-out path: the active mobile was cleared. Drop any cached
      // profile and flip back to "missing" so the root layout sends the
      // devotee through /login → /register instead of bouncing them to
      // the home tabs on the stale "ready" status.
      setProfile(null);
      setStatus("missing");
      return;
    }
    const ref = doc(db, "users", mobile);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile({
            uid: uid ?? "",
            ...(snap.data() as Omit<UserProfile, "uid">),
          });
          setStatus("ready");
        } else {
          // Mobile remembered but doc was deleted server-side → re-register.
          setProfile(null);
          setStatus("missing");
        }
      },
      (err: any) => {
        // eslint-disable-next-line no-console
        console.warn(
          "[useUserProfile] users snapshot error:",
          err?.code || err?.message || err,
        );
        setProfile(null);
        setStatus("missing");
      },
    );
    return unsub;
  }, [mobile, uid]);

  // 4) Safety timeout.
  useEffect(() => {
    if (status !== "loading") return;
    const t = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(
        "[useUserProfile] loading timeout reached, falling back to 'missing'",
      );
      setStatus("missing");
    }, LOADING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status]);

  return { uid, mobile, profile, status, authError };
}
