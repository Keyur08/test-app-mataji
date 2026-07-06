import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Music,
  Pause,
  Play,
} from "lucide-react-native";

import { ScreenContainer } from "../../components/ScreenContainer";
import { SearchBar } from "../../components/SearchBar";
import { useCollection } from "../../src/lib/useFirestore";
import { useAudio } from "../../src/lib/AudioPlayerProvider";
import type { Bhajan, BhajanCategory } from "../../../shared/types";

const formatTime = (s?: number) => {
  if (!s || !Number.isFinite(s)) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const normalizeCategoryId = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

type CategoryView = {
  id: string;
  label: string;
  count: number;
  order: number;
  fromBhajan: boolean;
};

export default function AudioScreen() {
  const { data: bhajans, loading, error, refresh } = useCollection<Bhajan>(
      "bhajans",
      {
        orderByField: "order",
        orderDir: "asc",
        limit: 100,
      },
  );
  const { data: categories } = useCollection<BhajanCategory>(
      "bhajan_categories",
      {
        orderByField: "order",
        orderDir: "asc",
        limit: 100,
      },
  );

  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
      null,
  );
  const [query, setQuery] = useState("");

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const { current, isPlaying, setQueueAndPlay, toggle } = useAudio();

  const categoryMap = useMemo(() => {
    const map = new Map<string, BhajanCategory>();
    (categories ?? []).forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  const categoryViews = useMemo<CategoryView[]>(() => {
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();
    const orders = new Map<string, number>();

    (bhajans ?? []).forEach((b) => {
      const id = b.categoryId || normalizeCategoryId(b.categoryName || "");
      if (!id) return;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (b.categoryName) labels.set(id, b.categoryName);
    });

    (categories ?? []).forEach((cat) => {
      counts.set(cat.id, counts.get(cat.id) ?? 0);
      labels.set(cat.id, cat.name);
      orders.set(cat.id, cat.order ?? 0);
    });

    const views: CategoryView[] = Array.from(counts.entries()).map(
        ([id, count]) => ({
          id,
          label: labels.get(id) || categoryMap.get(id)?.name || id,
          count,
          order: orders.get(id) ?? 0,
          fromBhajan: !categoryMap.has(id),
        }),
    );

    views.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    return views;
  }, [bhajans, categories, categoryMap]);

  const uncategorizedTracks = useMemo(
      () =>
          (bhajans ?? []).filter((b) => {
            const id = b.categoryId || normalizeCategoryId(b.categoryName || "");
            return !id || !categoryMap.has(id);
          }),
      [bhajans, categoryMap],
  );

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    if (selectedCategoryId === "all") {
      return {
        id: "all",
        label: "All Bhajans",
        count: bhajans?.length ?? 0,
        order: -1,
        fromBhajan: false,
      };
    }
    if (selectedCategoryId === "__uncategorized__") {
      return {
        id: "__uncategorized__",
        label: "Uncategorized",
        count: uncategorizedTracks.length,
        order: 999999,
        fromBhajan: true,
      };
    }
    return categoryViews.find((c) => c.id === selectedCategoryId) ?? null;
  }, [categoryViews, selectedCategoryId, bhajans, uncategorizedTracks.length]);

  const tracksInSelection = useMemo(() => {
    if (!bhajans) return [];
    if (!selectedCategoryId || selectedCategoryId === "all") return bhajans;
    if (selectedCategoryId === "__uncategorized__") return uncategorizedTracks;
    return bhajans.filter((b) => {
      const id = b.categoryId || normalizeCategoryId(b.categoryName || "");
      return id === selectedCategoryId;
    });
  }, [bhajans, selectedCategoryId, uncategorizedTracks]);

  const filteredTracks = useMemo(() => {
    const source = selectedCategoryId ? tracksInSelection : bhajans ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((b) => {
      const categoryLabel =
          (b.categoryId && categoryMap.get(b.categoryId)?.name) ||
          b.categoryName ||
          "";
      const hay = `${b.title ?? ""} ${b.artist ?? ""} ${categoryLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }, [selectedCategoryId, tracksInSelection, bhajans, query, categoryMap]);

  const onPressTrack = (index: number) => {
    const track = filteredTracks[index];
    if (!track) return;
    if (current?.id === track.id) {
      toggle();
    } else {
      setQueueAndPlay(filteredTracks, index);
    }
  };

  const openCategory = (id: string) => {
    setSelectedCategoryId(id);
    setQuery("");
  };

  const isAllView = selectedCategoryId === "all";
  const isUncategorizedView = selectedCategoryId === "__uncategorized__";

  const selectedCount = selectedCategoryId === "all"
      ? bhajans?.length ?? 0
      : selectedCategoryId === "__uncategorized__"
          ? uncategorizedTracks.length
          : selectedCategory?.count ?? tracksInSelection.length;

  return (
      <ScreenContainer>
        {loading && !(bhajans && bhajans.length > 0) ? (
            <View className="mt-12 items-center">
              <ActivityIndicator color="#B8336A" />
              <Text className="mt-3 text-sm text-zinc-500">Loading tracks…</Text>
            </View>
        ) : error && !(bhajans && bhajans.length > 0) ? (
            <Text className="mt-6 text-sm text-red-500">
              Could not load tracks: {error.message}
            </Text>
        ) : selectedCategoryId ? (
            <View style={{ flex: 1, paddingTop: 16 }}>
              <View className="mb-3 flex-row items-center justify-between">
                <Pressable
                    onPress={() => setSelectedCategoryId(null)}
                    className="flex-row items-center gap-1 rounded-full bg-white px-3 py-2"
                >
                  <ChevronLeft color="#B8336A" size={16} />
                  <Text className="text-sm font-semibold text-primary">Categories</Text>
                </Pressable>
                <Text className="text-xs text-zinc-500">
                  {selectedCount} tracks
                </Text>
              </View>

              <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${selectedCategory?.label ?? "tracks"}…`}
                  style={{ marginTop: 0, marginBottom: 14 }}
              />

              <FlatList
                  data={filteredTracks}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingBottom: 120,
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
                    <View className="mt-12 items-center">
                      <Music color="#9CA3AF" size={28} />
                      <Text className="mt-3 text-sm italic text-zinc-500">
                        {query ? "No matching bhajans." : "No bhajans in this category."}
                      </Text>
                    </View>
                  }
                  renderItem={({ item, index }) => {
                    const active = current?.id === item.id;
                    const showPause = active && isPlaying;
                    const categoryLabel =
                        (item.categoryId && categoryMap.get(item.categoryId)?.name) ||
                        item.categoryName ||
                        (isAllView ? "Bhajan" : selectedCategory?.label) ||
                        "Bhajan";
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
                              {categoryLabel +
                                  " · " +
                                  (item.artist ?? "Bhajan") +
                                  " · " +
                                  formatTime(item.durationSec)}
                            </Text>
                          </View>
                        </Pressable>
                    );
                  }}
              />
            </View>
        ) : (
            <View style={{ flex: 1, paddingTop: 16 }}>
              <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search categories or bhajans…"
                  style={{ marginTop: 0, marginBottom: 14 }}
              />

              <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 120 }}
              >
                <View className="mb-4 rounded-2xl bg-white p-4">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Browse by category
                  </Text>
                  <Text className="mt-1 text-sm text-zinc-600">
                    Tap a category to open the bhajans inside it.
                  </Text>
                </View>

                {(bhajans && bhajans.length > 0) && (
                    <View className="mb-3 flex-row flex-wrap gap-3">
                      <Pressable
                          onPress={() => openCategory("all")}
                          className="min-w-[44%] flex-1 rounded-2xl bg-primary p-4"
                      >
                        <FolderOpen color="#fff" size={22} />
                        <Text className="mt-4 text-base font-semibold text-white">
                          All Bhajans
                        </Text>
                        <Text className="mt-1 text-xs text-white/80">
                          {bhajans?.length ?? 0} tracks
                        </Text>
                      </Pressable>
                    </View>
                )}

                <View className="flex-row flex-wrap gap-3">
                  {categoryViews
                      .filter((cat) => {
                        const q = query.trim().toLowerCase();
                        if (!q) return true;
                        return (
                            cat.label.toLowerCase().includes(q) ||
                            String(cat.count).includes(q)
                        );
                      })
                      .map((cat) => (
                          <Pressable
                              key={cat.id}
                              onPress={() => openCategory(cat.id)}
                              className="min-w-[44%] flex-1 rounded-2xl bg-white p-4"
                              style={{
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 3 },
                                shadowOpacity: 0.08,
                                shadowRadius: 8,
                                elevation: 2,
                              }}
                          >
                            <View className="flex-row items-start justify-between">
                              <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                <FolderOpen color="#B8336A" size={18} />
                              </View>
                              <ChevronRight color="#A1A1AA" size={18} />
                            </View>
                            <Text className="mt-4 text-base font-semibold text-zinc-900">
                              {cat.label}
                            </Text>
                            <Text className="mt-1 text-xs text-zinc-500">
                              {cat.count} track{cat.count === 1 ? "" : "s"}
                            </Text>
                          </Pressable>
                      ))}

                  {uncategorizedTracks.length > 0 && (
                      <Pressable
                          onPress={() => openCategory("__uncategorized__")}
                          className="min-w-[44%] flex-1 rounded-2xl bg-white p-4"
                          style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.08,
                            shadowRadius: 8,
                            elevation: 2,
                          }}
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <Music color="#B8336A" size={18} />
                          </View>
                          <ChevronRight color="#A1A1AA" size={18} />
                        </View>
                        <Text className="mt-4 text-base font-semibold text-zinc-900">
                          Uncategorized
                        </Text>
                        <Text className="mt-1 text-xs text-zinc-500">
                          {uncategorizedTracks.length} track
                          {uncategorizedTracks.length === 1 ? "" : "s"}
                        </Text>
                      </Pressable>
                  )}
                </View>
              </ScrollView>
            </View>
        )}
      </ScreenContainer>
  );
}