import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useCallback, useMemo, useState } from "react";
import { Music, Pause, Play } from "lucide-react-native";

import { ScreenContainer } from "../../components/ScreenContainer";
import { SearchBar } from "../../components/SearchBar";
import { useCollection } from "../../src/lib/useFirestore";
import { useAudio } from "../../src/lib/AudioPlayerProvider";
import type { Bhajan } from "../../../shared/types";

const formatTime = (s?: number) => {
  if (!s || !Number.isFinite(s)) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export default function AudioScreen() {
  const { data: bhajans, loading, error, refresh } = useCollection<Bhajan>("bhajans", {
    orderByField: "order",
    orderDir: "asc",
    limit: 100,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const { current, isPlaying, setQueueAndPlay, toggle } = useAudio();

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!bhajans) return [];
    if (!q) return bhajans;
    return bhajans.filter((b) => {
      const hay = `${b.title ?? ""} ${b.artist ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bhajans, q]);

  const onPressTrack = (index: number) => {
    const track = filtered[index];
    if (!track) return;
    if (current?.id === track.id) {
      toggle();
    } else {
      setQueueAndPlay(filtered, index);
    }
  };

  return (
    <ScreenContainer>
      {loading && !bhajans ? (
        <View className="mt-12 items-center">
          <ActivityIndicator color="#B8336A" />
          <Text className="mt-3 text-sm text-zinc-500">Loading tracks…</Text>
        </View>
      ) : error && !bhajans ? (
        <Text className="mt-6 text-sm text-red-500">
          Could not load tracks: {error.message}
        </Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 16, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#B8336A"
              colors={["#B8336A", "#F4A261"]}
            />
          }
          ListHeaderComponent={
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search bhajans or artists…"
              style={{ marginTop: 0, marginBottom: 14 }}
            />
          }
          ListEmptyComponent={
            <View className="mt-12 items-center">
              <Music color="#9CA3AF" size={28} />
              <Text className="mt-3 text-sm italic text-zinc-500">
                {q ? "No matching bhajans." : "No bhajans yet."}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const active = current?.id === item.id;
            const showPause = active && isPlaying;
            return (
              <Pressable
                onPress={() => onPressTrack(index)}
                className={`mb-3 flex-row items-center rounded-2xl p-4 active:opacity-80 ${
                  active ? "bg-primary/5" : "bg-white"
                }`}
                style={{
                  shadowColor: active ? "#B8336A" : "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: active ? 0.18 : 0.06,
                  shadowRadius: 10,
                  elevation: active ? 4 : 2,
                  borderWidth: active ? 1 : 0,
                  borderColor: active ? "#B8336A" : "transparent",
                }}
              >
                <View
                  className={`mr-4 h-12 w-12 items-center justify-center rounded-xl ${
                    active ? "bg-primary" : "bg-primary/10"
                  }`}
                >
                  {showPause ? (
                    <Pause
                      color={active ? "#fff" : "#B8336A"}
                      size={20}
                      fill={active ? "#fff" : "#B8336A"}
                    />
                  ) : (
                    <Play
                      color={active ? "#fff" : "#B8336A"}
                      size={20}
                      fill={active ? "#fff" : "#B8336A"}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base font-semibold ${
                      active ? "text-primary" : "text-zinc-900"
                    }`}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text className="mt-1 text-xs text-zinc-500" numberOfLines={1}>
                    {(item.artist ?? "Bhajan") + " · " + formatTime(item.durationSec)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}
