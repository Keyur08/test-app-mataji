import { useCallback, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Calendar, CalendarDays, Megaphone, Newspaper } from "lucide-react-native";

import { useDoc } from "../../src/lib/useFirestore";
import type { NewsEvent } from "../../../shared/types";
import { ZoomableImage } from "../../components/ZoomableImage";

type Kind = "announcement" | "event" | "news";

const KIND_META: Record<
  Kind,
  { title: string; tint: string; tintBg: string; Icon: typeof Megaphone }
> = {
  announcement: {
    title: "Announcement",
    tint: "#B8336A",
    tintBg: "#FCE7F0",
    Icon: Megaphone,
  },
  event: {
    title: "Event",
    tint: "#A4470C",
    tintBg: "#FBE6CE",
    Icon: CalendarDays,
  },
  news: {
    title: "News",
    tint: "#0F766E",
    tintBg: "#D1FAE5",
    Icon: Newspaper,
  },
};

function formatDate(ts: NewsEvent["publishedAt"] | undefined) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, loading, refresh } = useDoc<NewsEvent>("news_events", id ?? "");

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const kind: Kind = ((item?.kind ?? "news") as Kind) in KIND_META
    ? ((item?.kind ?? "news") as Kind)
    : "news";
  const meta = KIND_META[kind];
  const KindIcon = meta.Icon;

  return (
    <>
      <Stack.Screen
        options={{
          title: meta.title,
          headerStyle: { backgroundColor: meta.tintBg },
          headerTitleStyle: { color: meta.tint, fontWeight: "700" },
          headerTintColor: meta.tint,
        }}
      />
      <ScrollView
        className="flex-1 bg-cream"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={meta.tint}
            colors={[meta.tint, "#F4A261"]}
          />
        }
      >
        {loading ? (
          <View className="mt-24 items-center">
            <ActivityIndicator color={meta.tint} />
          </View>
        ) : !item ? (
          <View className="mt-24 items-center px-6">
            <View
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: meta.tintBg }}
            >
              <Megaphone color={meta.tint} size={26} />
            </View>
            <Text className="mt-4 text-lg font-semibold text-zinc-800">
              Article not found
            </Text>
            <Text className="mt-1 text-center text-sm italic text-zinc-500">
              This announcement is no longer available.
            </Text>
          </View>
        ) : (
          <>
            {/* Hero image (or themed gradient if no image) */}
            {item.imageUrl ? (
              <View className="overflow-hidden">
                <ZoomableImage
                  uri={item.imageUrl}
                  caption={item.title}
                  style={{ width: "100%", height: 256 }}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View
                className="h-44 w-full items-center justify-center"
                style={{ backgroundColor: meta.tintBg }}
              >
                <KindIcon color={meta.tint} size={40} />
              </View>
            )}

            <View className="-mt-8 mx-4 rounded-3xl bg-white p-6 shadow-md">
              {/* Kind chip */}
              <View
                className="flex-row items-center self-start rounded-full px-3 py-1"
                style={{ backgroundColor: meta.tintBg }}
              >
                <KindIcon color={meta.tint} size={12} />
                <Text
                  className="ml-1.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: meta.tint }}
                >
                  {meta.title}
                </Text>
              </View>

              <Text className="mt-3 text-2xl font-bold leading-8 text-zinc-900">
                {item.title}
              </Text>

              {item.publishedAt ? (
                <View className="mt-3 flex-row items-center">
                  <Calendar color="#9CA3AF" size={14} />
                  <Text className="ml-2 text-xs text-zinc-500">
                    {formatDate(item.publishedAt)}
                  </Text>
                </View>
              ) : null}

              <View className="my-5 h-px bg-saffron/30" />

              {item.summary ? (
                <Text className="text-base italic leading-7 text-zinc-700">
                  {item.summary}
                </Text>
              ) : null}

              {item.body ? (
                <Text className="mt-4 text-[15px] leading-7 text-zinc-800">
                  {item.body}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
