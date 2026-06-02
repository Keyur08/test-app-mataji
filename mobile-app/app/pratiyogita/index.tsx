// Pratiyogita (Daily Quiz) — landing screen with three sections:
//
//   1. Running   — the live quiz with a midnight / endsAt countdown,
//                  prize highlight and a "Play now" button.
//   2. Upcoming  — future quizzes with their scheduled date/time.
//   3. Past      — completed quizzes; tap to review answers + winners.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Link, Stack } from "expo-router";
import {
  Award,
  CalendarClock,
  ChevronRight,
  CircleDot,
  Clock3,
  History,
  Share2,
  Sparkles,
  Trophy,
  Users as UsersIcon,
} from "lucide-react-native";

import { ScreenContainer } from "../../components/ScreenContainer";
import { ZoomableImage } from "../../components/ZoomableImage";
import { useCollection } from "../../src/lib/useFirestore";
import { useBranding, useTheme } from "../../src/lib/useBranding";
import type { Quiz } from "../../../shared/types";
import { formatHMS, liveStatus, msUntil, tsToDate } from "../../src/lib/quizTime";
import { sharePratiyogita } from "../../src/lib/sharePratiyogita";

type TabKey = "running" | "upcoming" | "past";

const TAB_META: Record<
  TabKey,
  { label: string; Icon: typeof CircleDot }
> = {
  running: { label: "चालू", Icon: CircleDot },
  upcoming: { label: "आगामी", Icon: Clock3 },
  past: { label: "पूर्ण", Icon: History },
};

export default function PratiyogitaScreen() {
  const theme = useTheme();
  const { data, loading } = useCollection<Quiz>("quizzes", {
    orderByField: "startsAt",
    orderDir: "desc",
  });

  const [tab, setTab] = useState<TabKey>("running");

  /* Re-render every second so the countdown stays live. */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const grouped = useMemo(() => {
    const r: Quiz[] = [];
    const u: Quiz[] = [];
    const p: Quiz[] = [];
    for (const q of data ?? []) {
      const s = liveStatus(q, now);
      if (s === "running") r.push(q);
      else if (s === "upcoming") u.push(q);
      else p.push(q);
    }
    // Upcoming sorted ascending by startsAt.
    u.sort((a, b) => {
      const at = tsToDate(a.startsAt)?.getTime() ?? 0;
      const bt = tsToDate(b.startsAt)?.getTime() ?? 0;
      return at - bt;
    });
    return { running: r, upcoming: u, past: p };
  }, [data, now]);

  const current = grouped[tab];

  return (
    <>
      <Stack.Screen
        options={{
          title: "प्रतियोगिता",
          headerStyle: { backgroundColor: theme.headerBg },
          headerTintColor: theme.primary,
          headerTitleStyle: { fontWeight: "800" },
        }}
      />
      <ScreenContainer scroll>
        {/* Section heading */}
        <View className="pt-3">
          <View className="flex-row items-center">
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.saffron + "33" }}
            >
              <Trophy color={theme.saffron} size={18} />
            </View>
            <View className="ml-3">
              <Text
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: theme.saffron }}
              >
                प्रतियोगिता — दैनिक प्रश्नोत्तरी
              </Text>
              <Text className="text-[12px] text-zinc-600">
                जप, स्मरण और ज्ञान की प्रतियोगिता
              </Text>
            </View>
          </View>
        </View>

        {/* Tab bar */}
        <View
          className="mt-4 flex-row rounded-2xl p-1"
          style={{
            backgroundColor: theme.cream,
            borderWidth: 1,
            borderColor: theme.saffron + "66",
          }}
        >
          {(Object.keys(TAB_META) as TabKey[]).map((key) => {
            const meta = TAB_META[key];
            const active = tab === key;
            const TabIcon = meta.Icon;
            const count = grouped[key].length;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                className="flex-1 items-center justify-center rounded-xl py-2"
                style={{
                  backgroundColor: active ? theme.primary : "transparent",
                }}
              >
                <View className="flex-row items-center">
                  <TabIcon
                    color={active ? "#fff" : theme.primary}
                    size={13}
                  />
                  <Text
                    className="ml-1.5 text-[12px] font-bold"
                    style={{ color: active ? "#fff" : theme.primary }}
                  >
                    {meta.label}
                  </Text>
                  {count > 0 && (
                    <View
                      className="ml-1.5 rounded-full px-1.5"
                      style={{
                        backgroundColor: active ? "#FFFFFF" : theme.primary + "22",
                      }}
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{
                          color: active ? theme.primary : theme.primary,
                        }}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Body */}
        <View className="mt-5">
          {loading ? (
            <ActivityIndicator color={theme.primary} />
          ) : current.length === 0 ? (
            <EmptyTab tab={tab} />
          ) : tab === "running" ? (
            current.map((q) => (
              <RunningQuizCard key={q.id} quiz={q} now={now} />
            ))
          ) : (
            current.map((q) => (
              <SimpleQuizRow key={q.id} quiz={q} tab={tab} />
            ))
          )}
        </View>
      </ScreenContainer>
    </>
  );
}

/* ------------------------------------------------------------------ */

function EmptyTab({ tab }: { tab: TabKey }) {
  const theme = useTheme();
  const text =
    tab === "running"
      ? "अभी कोई प्रतियोगिता नहीं चल रही।"
      : tab === "upcoming"
        ? "कोई आगामी प्रतियोगिता निर्धारित नहीं है।"
        : "अभी तक कोई पूर्ण प्रतियोगिता नहीं।";
  const sub =
    tab === "running"
      ? "जल्द ही आज की प्रतियोगिता देखें।"
      : tab === "upcoming"
        ? "माता जी की टीम जल्द ही नई प्रतियोगिता जोड़ेगी।"
        : "प्रतियोगिता समाप्त होने पर परिणाम यहाँ दिखेंगे।";
  return (
    <View
      className="items-center rounded-3xl bg-white px-6 py-10"
      style={{
        borderWidth: 1,
        borderColor: theme.saffron + "55",
      }}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.saffron + "33" }}
      >
        <Trophy color={theme.saffron} size={22} />
      </View>
      <Text
        className="mt-3 text-center text-sm font-semibold"
        style={{ color: theme.primary }}
      >
        {text}
      </Text>
      <Text className="mt-1 text-center text-xs italic text-zinc-500">{sub}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */

function RunningQuizCard({ quiz, now }: { quiz: Quiz; now: Date }) {
  const theme = useTheme();
  const branding = useBranding();
  const remaining = msUntil(tsToDate(quiz.endsAt), now);

  return (
    <View
      className="mb-4 overflow-hidden rounded-3xl bg-white"
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
      {quiz.imageUrl ? (
        <ZoomableImage
          uri={quiz.imageUrl}
          caption={quiz.title}
          style={{ width: "100%", height: 170 }}
          resizeMode="cover"
        />
      ) : null}

      <View className="px-5 pb-5 pt-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "#10B981" }}
            />
            <Text className="ml-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              अभी चालू · समाप्ति में
            </Text>
          </View>
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: "#D1FAE5" }}
          >
            <Text
              className="text-[12px] font-bold text-emerald-800"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatHMS(remaining)}
            </Text>
          </View>
        </View>

        <Text
          className="mt-2 text-xl font-bold"
          style={{ color: theme.primary }}
        >
          {quiz.title}
        </Text>
        {quiz.description ? (
          <Text className="mt-1 text-[13px] leading-5 text-zinc-700">
            {quiz.description}
          </Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap items-center gap-3">
          <View className="flex-row items-center">
            <Sparkles color={theme.primary} size={12} />
            <Text className="ml-1 text-[11px] font-semibold text-zinc-600">
              {quiz.questions?.length ?? 0} प्रश्न
            </Text>
          </View>
          <View className="flex-row items-center">
            <UsersIcon color={theme.primary} size={12} />
            <Text className="ml-1 text-[11px] font-semibold text-zinc-600">
              {quiz.participantCount ?? 0} भक्त जुड़े
            </Text>
          </View>
          <View className="flex-row items-center">
            <CalendarClock color={theme.primary} size={12} />
            <Text className="ml-1 text-[11px] font-semibold text-zinc-600">
              {tsToDate(quiz.startsAt)?.toLocaleTimeString() ?? ""}
              {" → "}
              {tsToDate(quiz.endsAt)?.toLocaleTimeString() ?? ""}
            </Text>
          </View>
        </View>

        {/* Rules */}
        {quiz.rules ? (
          <View
            className="mt-4 rounded-2xl p-3"
            style={{ backgroundColor: theme.cream }}
          >
            <Text
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: theme.saffron }}
            >
              नियम
            </Text>
            <Text className="mt-1 text-[12px] leading-5 text-zinc-700">
              {quiz.rules}
            </Text>
          </View>
        ) : null}

        {/* Prize */}
        {quiz.prize?.title ? (
          <View
            className="mt-3 flex-row items-center rounded-2xl p-3"
            style={{
              backgroundColor: theme.saffron + "18",
              borderWidth: 1,
              borderColor: theme.saffron + "55",
            }}
          >
            {quiz.prize.imageUrl ? (
              <ZoomableImage
                uri={quiz.prize.imageUrl}
                caption={quiz.prize.title}
                style={{ width: 52, height: 52, borderRadius: 10 }}
                resizeMode="cover"
              />
            ) : (
              <View
                className="h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: theme.saffron + "33" }}
              >
                <Award color={theme.saffron} size={22} />
              </View>
            )}
            <View className="ml-3 flex-1">
              <Text
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: theme.saffron }}
              >
                पुरस्कार
              </Text>
              <Text
                className="text-[14px] font-bold"
                style={{ color: theme.primary }}
              >
                {quiz.prize.title}
              </Text>
              {quiz.prize.description ? (
                <Text
                  className="text-[11px] text-zinc-600"
                  numberOfLines={2}
                >
                  {quiz.prize.description}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Play CTA + share */}
        <View className="mt-4 flex-row items-center">
          <Link
            href={{ pathname: "/pratiyogita/[id]", params: { id: quiz.id! } } as never}
            asChild
          >
            <Pressable
              className="mr-2 flex-1 flex-row items-center justify-center rounded-full py-3 active:opacity-90"
              style={{ backgroundColor: theme.primary }}
            >
              <Text className="text-sm font-bold text-white">अभी खेलें</Text>
              <ChevronRight color="#fff" size={16} style={{ marginLeft: 4 }} />
            </Pressable>
          </Link>
          <Pressable
            onPress={() =>
              sharePratiyogita({
                quiz,
                kind: "running",
                appUrl: branding.shareAppUrl,
                appName: branding.appName,
              })
            }
            accessibilityRole="button"
            accessibilityLabel="प्रतियोगिता साझा करें"
            className="h-12 w-12 items-center justify-center rounded-full active:opacity-80"
            style={{
              backgroundColor: theme.cream,
              borderWidth: 1.5,
              borderColor: theme.saffron,
            }}
          >
            <Share2 color={theme.primary} size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

function SimpleQuizRow({
  quiz,
  tab,
}: {
  quiz: Quiz;
  tab: Exclude<TabKey, "running">;
}) {
  const theme = useTheme();
  const branding = useBranding();
  const starts = tsToDate(quiz.startsAt);
  const ends = tsToDate(quiz.endsAt);

  const href =
    tab === "past"
      ? ({ pathname: "/pratiyogita/[id]/review", params: { id: quiz.id! } } as const)
      : ({ pathname: "/pratiyogita/[id]", params: { id: quiz.id! } } as const);

  return (
    <View
      className="mb-3 flex-row items-center rounded-2xl bg-white p-3"
      style={{
        borderWidth: 1,
        borderColor: theme.saffron + "55",
      }}
    >
      {quiz.imageUrl ? (
        <ZoomableImage
          uri={quiz.imageUrl}
          caption={quiz.title}
          style={{ width: 64, height: 64, borderRadius: 12 }}
          resizeMode="cover"
        />
      ) : (
        <View
          className="items-center justify-center"
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            backgroundColor: theme.saffron + "1F",
          }}
        >
          <Trophy color={theme.saffron} size={22} />
        </View>
      )}

      <Link href={href as never} asChild>
        <Pressable className="ml-3 flex-1 active:opacity-80">
          <Text
            className="text-[14px] font-bold"
            style={{ color: theme.primary }}
            numberOfLines={1}
          >
            {quiz.title}
          </Text>
          <Text className="mt-0.5 text-[11px] text-zinc-500" numberOfLines={1}>
            {tab === "upcoming"
              ? `प्रारंभ: ${starts?.toLocaleString() ?? ""}`
              : `समाप्त: ${ends?.toLocaleString() ?? ""}`}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Sparkles color={theme.saffron} size={10} />
            <Text className="ml-1 text-[10px] font-semibold text-zinc-500">
              {quiz.questions?.length ?? 0} प्रश्न ·{" "}
              {quiz.participantCount ?? 0} भक्त
            </Text>
          </View>
        </Pressable>
      </Link>

      <Pressable
        onPress={() =>
          sharePratiyogita({
            quiz,
            kind: tab,
            appUrl: branding.shareAppUrl,
            appName: branding.appName,
          })
        }
        accessibilityRole="button"
        accessibilityLabel="प्रतियोगिता साझा करें"
        className="ml-2 h-9 w-9 items-center justify-center rounded-full active:opacity-80"
        style={{
          backgroundColor: theme.cream,
          borderWidth: 1,
          borderColor: theme.saffron + "88",
        }}
      >
        <Share2 color={theme.primary} size={15} />
      </Pressable>
    </View>
  );
}
