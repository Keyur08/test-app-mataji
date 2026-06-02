// Home-tab card for the admin-published "Daily नियम".
// Reads `daily_niyam/{today}` for the content and lets the devotee opt-in by
// creating `daily_niyam/{today}/accepts/{mobile}`. The acceptance count
// updates live for everyone via an `onSnapshot` subscription.

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ZoomableImage } from "./ZoomableImage";
import {
  CheckCircle2,
  NotebookPen,
  Sparkles,
  Users as UsersIcon,
} from "lucide-react-native";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../src/lib/firebase";
import { useTheme } from "../src/lib/useBranding";
import { useUserProfile } from "../src/lib/useUserProfile";
import type { DailyNiyam } from "../../shared/types";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DailyNiyamCard() {
  const theme = useTheme();
  const { profile, uid } = useUserProfile();
  const date = todayISO();

  const [niyam, setNiyam] = useState<DailyNiyam | null>(null);
  const [niyamLoading, setNiyamLoading] = useState(true);

  const [count, setCount] = useState<number>(0);
  const [hasAccepted, setHasAccepted] = useState<boolean>(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to today's niyam doc.
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "daily_niyam", date),
      (snap) => {
        if (snap.exists()) {
          setNiyam({ ...(snap.data() as DailyNiyam) });
        } else {
          setNiyam(null);
        }
        setNiyamLoading(false);
      },
      () => setNiyamLoading(false),
    );
    return unsub;
  }, [date]);

  // Subscribe to acceptances for live count.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "daily_niyam", date, "accepts"),
      (snap) => setCount(snap.size),
      () => {
        /* rule denials would zero this for non-admins — fine. */
      },
    );
    return unsub;
  }, [date]);

  // Check if this devotee has already accepted today.
  useEffect(() => {
    if (!profile?.mobile) {
      setHasAccepted(false);
      return;
    }
    const ref = doc(db, "daily_niyam", date, "accepts", profile.mobile);
    getDoc(ref)
      .then((s) => setHasAccepted(s.exists()))
      .catch(() => setHasAccepted(false));
  }, [date, profile?.mobile]);

  if (niyamLoading) {
    return (
      <View
        className="overflow-hidden rounded-3xl border bg-white p-6"
        style={{ borderColor: theme.saffron + "55" }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!niyam) {
    // No niyam published today — render nothing rather than an empty card.
    return null;
  }

  async function onAccept() {
    if (!profile?.mobile || !uid) {
      setError("Please complete your profile first.");
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      const ref = doc(db, "daily_niyam", date, "accepts", profile.mobile);
      await setDoc(ref, {
        mobile: profile.mobile,
        name: profile.name,
        uid,
        acceptedAt: serverTimestamp(),
      });
      setHasAccepted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <View
      className="overflow-hidden rounded-3xl bg-white"
      style={{
        borderWidth: 1.5,
        borderColor: theme.saffron,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 3,
      }}
    >
      {niyam.imageUrl ? (
        <ZoomableImage
          uri={niyam.imageUrl}
          caption={niyam.title}
          style={{ width: "100%", height: 180 }}
          resizeMode="cover"
        />
      ) : null}

      <View className="p-5">
        <View className="flex-row items-center">
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.saffron + "33" }}
          >
            <NotebookPen color={theme.saffron} size={16} />
          </View>
          <Text
            className="ml-3 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: theme.saffron }}
          >
            आज का नियम · Niyam of the Day
          </Text>
        </View>

        <Text
          className="mt-3 text-xl font-bold"
          style={{ color: theme.primary }}
        >
          {niyam.title}
        </Text>

        {niyam.body ? (
          <Text className="mt-2 text-[14px] leading-6 text-zinc-700">
            {niyam.body}
          </Text>
        ) : null}

        {/* Count + CTA */}
        <View
          className="mt-5 flex-row items-center justify-between rounded-2xl p-3"
          style={{ backgroundColor: theme.cream }}
        >
          <View className="flex-row items-center">
            <View
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.primary + "1A" }}
            >
              <UsersIcon color={theme.primary} size={14} />
            </View>
            <View className="ml-2">
              <Text
                className="text-[15px] font-bold"
                style={{ color: theme.primary }}
              >
                {count}
              </Text>
              <Text className="text-[10px] uppercase tracking-wider text-zinc-500">
                Devotees accepted
              </Text>
            </View>
          </View>

          {hasAccepted ? (
            <View
              className="flex-row items-center rounded-full px-3 py-2"
              style={{ backgroundColor: "#16A34A" }}
            >
              <CheckCircle2 color="#FFFFFF" size={14} />
              <Text className="ml-1.5 text-[12px] font-bold text-white">
                Accepted
              </Text>
              {/* Live count badge — keeps the social-proof visible
                  even after the user accepts. */}
              <View
                className="ml-2 rounded-full px-2 py-0.5"
                style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
              >
                <Text className="text-[11px] font-extrabold text-white">
                  {count}
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={onAccept}
              disabled={accepting || !profile?.mobile}
              className="flex-row items-center rounded-full px-4 py-2 active:opacity-90"
              style={{
                backgroundColor: accepting
                  ? theme.primary + "99"
                  : theme.primary,
              }}
            >
              {accepting ? (
                <ActivityIndicator color={theme.textOnPrimary} size="small" />
              ) : (
                <Sparkles color={theme.textOnPrimary} size={14} />
              )}
              <Text
                className="ml-1.5 text-[12px] font-bold"
                style={{ color: theme.textOnPrimary }}
              >
                {accepting ? "Saving…" : "नियम स्वीकार करें"}
              </Text>
              {/* Live acceptance count badge — encourages action with
                  social proof ("42 already accepted"). */}
              {!accepting && count > 0 ? (
                <View
                  className="ml-2 rounded-full px-2 py-0.5"
                  style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
                >
                  <Text
                    className="text-[11px] font-extrabold"
                    style={{ color: theme.textOnPrimary }}
                  >
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}
        </View>

        {error ? (
          <Text className="mt-2 text-[11px] text-red-600">{error}</Text>
        ) : null}
      </View>
    </View>
  );
}
