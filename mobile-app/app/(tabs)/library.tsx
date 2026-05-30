import { useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
  Pressable,
} from "react-native";
import { Link } from "expo-router";
import {
  BookOpen,
  Sparkles,
  WifiOff,
  Flame,
  Flower2,
  ScrollText,
  Sun,
} from "lucide-react-native";

import { ScreenContainer } from "../../components/ScreenContainer";
import { SearchBar } from "../../components/SearchBar";
import { useCachedCollection } from "../../src/lib/useCachedFirestore";
import type { LibraryText } from "../../../shared/types";

type Category = { name: string; count: number };

/**
 * Rotating palette of card themes — keeps the grid visually varied
 * while staying on-brand (primary/saffron + warm accents).
 */
const PALETTE = [
  { bg: "#FDECEF", accent: "#B8336A", blob: "rgba(184,51,106,0.12)", icon: BookOpen },
  { bg: "#FFF1E0", accent: "#F4A261", blob: "rgba(244,162,97,0.18)", icon: Flame },
  { bg: "#FEF3C7", accent: "#B45309", blob: "rgba(180,83,9,0.14)", icon: ScrollText },
  { bg: "#FCE7F3", accent: "#9D174D", blob: "rgba(157,23,77,0.14)", icon: Flower2 },
  { bg: "#FFE4E6", accent: "#BE123C", blob: "rgba(190,18,60,0.14)", icon: Sun },
  { bg: "#FDF2F8", accent: "#B8336A", blob: "rgba(184,51,106,0.16)", icon: Sparkles },
] as const;

export default function LibraryScreen() {
  const { data, loading, fromCache, error, refresh } = useCachedCollection<LibraryText>(
    "texts_library",
    "texts_library:all",
    { orderByField: "order", orderDir: "asc" }
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  /**
   * When the user types, a category is kept if either its own name matches
   * OR at least one text inside it matches. The count is updated to reflect
   * the number of matching texts so users see "3 matches" instead of the
   * full count for partially-matching categories.
   */
  const categories: Category[] = useMemo(() => {
    if (!data) return [];
    const byCat = new Map<string, { total: number; matches: number; nameHit: boolean }>();
    for (const t of data) {
      const key = (t.category || "Other").trim();
      const entry = byCat.get(key) ?? {
        total: 0,
        matches: 0,
        nameHit: q ? key.toLowerCase().includes(q) : false,
      };
      entry.total += 1;
      if (q) {
        const hay = `${t.title ?? ""} ${t.subtitle ?? ""}`.toLowerCase();
        if (hay.includes(q)) entry.matches += 1;
      }
      byCat.set(key, entry);
    }
    const out: Category[] = [];
    for (const [name, info] of byCat) {
      if (!q) {
        out.push({ name, count: info.total });
      } else if (info.nameHit) {
        out.push({ name, count: info.total });
      } else if (info.matches > 0) {
        out.push({ name, count: info.matches });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, q]);

  return (
    <ScreenContainer>
      {fromCache ? (
        <View className="mt-3 flex-row justify-end">
          <View className="flex-row items-center rounded-full bg-saffron/15 px-2.5 py-1">
            <WifiOff color="#F4A261" size={12} />
            <Text className="ml-1 text-[10px] font-semibold text-saffron">
              Offline
            </Text>
          </View>
        </View>
      ) : null}

      {loading && !data ? (
        <View className="mt-12 items-center">
          <ActivityIndicator color="#B8336A" />
          <Text className="mt-3 text-sm text-zinc-500">Loading texts…</Text>
        </View>
      ) : error && !data ? (
        <Text className="mt-6 text-sm text-red-500">
          Could not load texts: {error.message}
        </Text>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(c) => c.name}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{
            paddingTop: 18,
            paddingBottom: 120,
            gap: 12,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#B8336A"
              colors={["#B8336A", "#F4A261"]}
            />
          }
          ListHeaderComponent={
            <View>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder="Search texts or category…"
                style={{ marginTop: 0, marginBottom: 14 }}
              />
              <Text className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-saffron">
                {q ? `Results for "${query.trim()}"` : "Browse by category"}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View className="mt-12 items-center">
              <BookOpen color="#9CA3AF" size={28} />
              <Text className="mt-3 text-sm italic text-zinc-500">
                {q ? "No matching texts." : "No texts available yet."}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const theme = PALETTE[index % PALETTE.length];
            const Icon = theme.icon;
            return (
              <Link
                href={{
                  pathname: "/library/category/[name]" as any,
                  params: { name: item.name },
                }}
                asChild
              >
                <Pressable
                  className="flex-1 overflow-hidden rounded-3xl p-4 active:opacity-85"
                  style={{
                    backgroundColor: theme.bg,
                    minHeight: 150,
                    shadowColor: theme.accent,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 12,
                    elevation: 3,
                  }}
                >
                  {/* Decorative blobs */}
                  <View
                    style={{
                      position: "absolute",
                      right: -22,
                      top: -22,
                      width: 90,
                      height: 90,
                      borderRadius: 45,
                      backgroundColor: theme.blob,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      right: 28,
                      bottom: -30,
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      backgroundColor: theme.blob,
                    }}
                  />

                  <View
                    className="h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
                  >
                    <Icon color={theme.accent} size={22} />
                  </View>

                  <View className="mt-auto pt-6">
                    <Text
                      className="text-base font-bold"
                      style={{ color: theme.accent }}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    <Text
                      className="mt-1 text-[11px] font-medium"
                      style={{ color: theme.accent, opacity: 0.75 }}
                    >
                      {item.count} {item.count === 1 ? "text" : "texts"}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}
