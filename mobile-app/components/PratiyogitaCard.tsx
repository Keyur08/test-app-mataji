// Home card for Pratiyogita (Daily Quiz). Highlights the currently
// "running" quiz (with a countdown to its end) and otherwise shows the
// next upcoming one. Tapping it opens the /pratiyogita tabs screen.

import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import {
  CalendarClock,
  ChevronRight,
  Share2,
  Sparkles,
  Trophy,
  Users as UsersIcon,
} from "lucide-react-native";

import { useCollection } from "../src/lib/useFirestore";
import { useBranding, useTheme } from "../src/lib/useBranding";
import { ZoomableImage } from "./ZoomableImage";
import type { Quiz } from "../../shared/types";
import { formatHMS, liveStatus, msUntil, tsToDate } from "../src/lib/quizTime";
import { sharePratiyogita } from "../src/lib/sharePratiyogita";

export function PratiyogitaCard() {
  const theme = useTheme();
  const branding = useBranding();
  const { data, loading } = useCollection<Quiz>("quizzes", {
    orderByField: "startsAt",
    orderDir: "desc",
    limit: 20,
  });

  // Tick every second so countdowns stay live.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const featured = useMemo(() => {
    if (!data) return null;
    const running = data.find((q) => liveStatus(q, now) === "running");
    if (running) return { quiz: running, kind: "running" as const };
    const upcoming = data
      .filter((q) => liveStatus(q, now) === "upcoming")
      .sort((a, b) => {
        const at = tsToDate(a.startsAt)?.getTime() ?? 0;
        const bt = tsToDate(b.startsAt)?.getTime() ?? 0;
        return at - bt;
      })[0];
    if (upcoming) return { quiz: upcoming, kind: "upcoming" as const };
    return null;
  }, [data, now]);

  if (loading) return null;
  if (!featured) return null;

  const { quiz, kind } = featured;
  const remaining =
    kind === "running"
      ? msUntil(tsToDate(quiz.endsAt), now)
      : msUntil(tsToDate(quiz.startsAt), now);

  return (
    <View
      className="mt-6 overflow-hidden rounded-3xl bg-white"
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
      <Link href={"/pratiyogita" as never} asChild>
        <Pressable className="active:opacity-95">
          {quiz.imageUrl ? (
            <ZoomableImage
              uri={quiz.imageUrl}
              caption={quiz.title}
              style={{ width: "100%", height: 140 }}
              resizeMode="cover"
            />
          ) : (
            <View
              className="items-center justify-center"
              style={{ height: 120, backgroundColor: theme.saffron + "1F" }}
            >
              <Trophy color={theme.saffron} size={42} />
            </View>
          )}

          <View className="px-5 pb-5 pt-4">
            <View className="flex-row items-center">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.saffron + "33" }}
              >
                <Trophy color={theme.saffron} size={16} />
              </View>
              <View className="ml-3 flex-1">
                <Text
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: theme.saffron }}
                >
                  प्रतियोगिता — दैनिक प्रश्नोत्तरी
                </Text>
                <Text
                  className="text-[10px] font-semibold"
                  style={{
                    color: kind === "running" ? "#059669" : theme.primary,
                  }}
                >
                  {kind === "running" ? "● अभी चालू" : "आगामी"}
                </Text>
              </View>
              {/* Countdown chip */}
              <View
                className="rounded-full px-3 py-1"
                style={{
                  backgroundColor:
                    kind === "running" ? "#D1FAE5" : theme.cream,
                  borderWidth: 1,
                  borderColor:
                    kind === "running" ? "#10B98166" : theme.saffron + "66",
                }}
              >
                <Text
                  className="text-[11px] font-bold tracking-wider"
                  style={{
                    color: kind === "running" ? "#047857" : theme.primary,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatHMS(remaining)}
                </Text>
              </View>
            </View>

            <Text
              className="mt-3 text-lg font-bold"
              style={{ color: theme.primary }}
              numberOfLines={2}
            >
              {quiz.title}
            </Text>

            {quiz.description ? (
              <Text
                className="mt-1 text-[13px] leading-5 text-zinc-700"
                numberOfLines={2}
              >
                {quiz.description}
              </Text>
            ) : null}

            <View className="mt-3 flex-row flex-wrap items-center gap-3">
              <View className="flex-row items-center">
                <Sparkles color={theme.primary} size={12} />
                <Text className="ml-1 text-[11px] font-semibold text-zinc-600">
                  {quiz.questions?.length ?? quiz.totalQuestions ?? 0} प्रश्न
                </Text>
              </View>
              <View className="flex-row items-center">
                <UsersIcon color={theme.primary} size={12} />
                <Text className="ml-1 text-[11px] font-semibold text-zinc-600">
                  {quiz.participantCount ?? 0} भक्त जुड़े
                </Text>
              </View>
              {kind === "upcoming" && (
                <View className="flex-row items-center">
                  <CalendarClock color={theme.primary} size={12} />
                  <Text className="ml-1 text-[11px] font-semibold text-zinc-600">
                    {tsToDate(quiz.startsAt)?.toLocaleString() ?? ""}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Link>

      {/* CTA + share row (siblings so share doesn't trigger Link nav) */}
      <View className="flex-row items-center px-5 pb-5">
        <Link href={"/pratiyogita" as never} asChild>
          <Pressable
            className="mr-2 flex-1 flex-row items-center justify-center rounded-full py-3 active:opacity-90"
            style={{ backgroundColor: theme.primary }}
          >
            <Text className="text-sm font-bold text-white">
              {kind === "running" ? "अभी खेलें" : "प्रतियोगिता देखें"}
            </Text>
            <ChevronRight color="#fff" size={16} style={{ marginLeft: 4 }} />
          </Pressable>
        </Link>
        <Pressable
          onPress={() =>
            sharePratiyogita({
              quiz,
              kind,
              appUrl: branding.shareAppUrl,
              appName: branding.appName,
            })
          }
          accessibilityRole="button"
          accessibilityLabel="प्रतियोगिता साझा करें"
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-80"
          style={{
            backgroundColor: theme.cream,
            borderWidth: 1.5,
            borderColor: theme.saffron,
          }}
        >
          <Share2 color={theme.primary} size={16} />
        </Pressable>
      </View>
    </View>
  );
}
