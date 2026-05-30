import { useCallback, useMemo, useState } from "react";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { CalendarDays, Megaphone, Newspaper } from "lucide-react-native";

import { useCollection } from "../../src/lib/useFirestore";
import type { NewsEvent } from "../../../shared/types";

type Kind = "announcement" | "event" | "news";

const KIND_META: Record<
  Kind,
  { title: string; tint: string; tintBg: string; Icon: typeof Megaphone }
> = {
  announcement: { title: "Announcement", tint: "#B8336A", tintBg: "#FCE7F0", Icon: Megaphone },
  event:        { title: "Event",        tint: "#A4470C", tintBg: "#FBE6CE", Icon: CalendarDays },
  news:         { title: "News",         tint: "#0F766E", tintBg: "#D1FAE5", Icon: Newspaper },
};

function formatDate(ts: NewsEvent["publishedAt"] | undefined) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function NewsListScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const activeKind: Kind | "all" = (() => {
    const k = String(params.kind ?? "").toLowerCase();
    return k === "announcement" || k === "event" || k === "news" ? (k as Kind) : "all";
  })();

  const { data, loading, refresh } = useCollection<NewsEvent>("news_events", {
    orderByField: "publishedAt",
    orderDir: "desc",
    limit: 100,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeKind === "all") return data;
    return data.filter((d) => (d.kind ?? "news") === activeKind);
  }, [data, activeKind]);

  const screenTitle =
    activeKind === "announcement"
      ? "Announcements"
      : activeKind === "event"
      ? "Events"
      : activeKind === "news"
      ? "News"
      : "All Updates";

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return (
    <>
      <Stack.Screen options={{ title: screenTitle }} />
      {loading && !data ? (
        <View className="flex-1 items-center justify-center bg-cream">
          <ActivityIndicator color="#B8336A" />
        </View>
      ) : (
        <FlatList
          className="flex-1 bg-cream"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 32,
            gap: 14,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#B8336A"
              colors={["#B8336A", "#F4A261"]}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-6 py-20">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-saffron/20">
                <Megaphone color="#F4A261" size={26} />
              </View>
              <Text className="mt-4 text-base font-semibold text-zinc-700">
                {activeKind === "all"
                  ? "Nothing here yet."
                  : `No ${screenTitle.toLowerCase()} yet.`}
              </Text>
              <Text className="mt-1 text-center text-sm italic text-zinc-500">
                Pull down to refresh.
              </Text>
            </View>
          }
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const kind: Kind = ((item.kind ?? "news") as Kind) in KIND_META
              ? ((item.kind ?? "news") as Kind)
              : "news";
            const meta = KIND_META[kind];
            const KindIcon = meta.Icon;
            return (
              <Link href={{ pathname: "/news/[id]", params: { id: item.id } }} asChild>
                <Pressable
                  className="overflow-hidden rounded-3xl border border-primary/10 bg-white active:opacity-85"
                  style={{
                    shadowColor: "#000",
                    shadowOpacity: 0.06,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 3,
                  }}
                >
                  {item.imageUrl ? (
                    <View>
                      <Image
                        source={{ uri: item.imageUrl }}
                        className="h-44 w-full"
                        resizeMode="cover"
                      />
                      <View className="absolute inset-0 bg-black/10" />
                      <View
                        className="absolute left-3 top-3 flex-row items-center rounded-full px-2.5 py-1"
                        style={{ backgroundColor: meta.tintBg }}
                      >
                        <KindIcon color={meta.tint} size={11} />
                        <Text
                          className="ml-1 text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: meta.tint }}
                        >
                          {meta.title}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View
                      className="h-24 w-full items-center justify-center"
                      style={{ backgroundColor: meta.tintBg }}
                    >
                      <KindIcon color={meta.tint} size={28} />
                    </View>
                  )}
                  <View className="p-4">
                    {!item.imageUrl && (
                      <View
                        className="mb-2 flex-row items-center self-start rounded-full px-2.5 py-1"
                        style={{ backgroundColor: meta.tintBg }}
                      >
                        <KindIcon color={meta.tint} size={11} />
                        <Text
                          className="ml-1 text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: meta.tint }}
                        >
                          {meta.title}
                        </Text>
                      </View>
                    )}
                    <Text
                      className="text-base font-semibold text-zinc-900"
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    {item.summary ? (
                      <Text
                        className="mt-1 text-xs leading-5 text-zinc-600"
                        numberOfLines={2}
                      >
                        {item.summary}
                      </Text>
                    ) : null}
                    <Text className="mt-3 text-[11px] font-medium text-zinc-400">
                      {formatDate(item.publishedAt)}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </>
  );
}
