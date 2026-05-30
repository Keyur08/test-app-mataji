import { useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
  Pressable,
} from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { BookOpen, ChevronRight, WifiOff } from "lucide-react-native";

import { ScreenContainer } from "../../../components/ScreenContainer";
import { SearchBar } from "../../../components/SearchBar";
import { useCachedCollection } from "../../../src/lib/useCachedFirestore";
import type { LibraryText } from "../../../../shared/types";

export default function LibraryCategoryScreen() {
  const params = useLocalSearchParams<{ name: string }>();
  const categoryName = useMemo(() => {
    const raw = params?.name;
    const value = Array.isArray(raw) ? raw[0] : raw;
    try {
      return value ? decodeURIComponent(value) : "";
    } catch {
      return value ?? "";
    }
  }, [params]);

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

  const items = useMemo(() => {
    if (!data) return [];
    return data.filter((t) => (t.category || "Other").trim() === categoryName);
  }, [data, categoryName]);

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!q) return items;
    return items.filter((t) => {
      const hay = `${t.title ?? ""} ${t.subtitle ?? ""} ${t.body ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, q]);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: categoryName || "Category" }} />
      <View className="pt-4 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View
            className="h-11 w-11 items-center justify-center rounded-2xl bg-saffron/20"
            style={{ borderWidth: 1, borderColor: "rgba(244,162,97,0.35)" }}
          >
            <BookOpen color="#F4A261" size={22} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-2xl font-bold text-primary" numberOfLines={1}>
              {categoryName || "Category"}
            </Text>
            <Text className="text-xs text-zinc-600">
              {filteredItems.length} {filteredItems.length === 1 ? "text" : "texts"}
              {q && filteredItems.length !== items.length
                ? ` of ${items.length}`
                : ""}
            </Text>
          </View>
        </View>
        {fromCache ? (
          <View className="flex-row items-center rounded-full bg-saffron/15 px-2.5 py-1">
            <WifiOff color="#F4A261" size={12} />
            <Text className="ml-1 text-[10px] font-semibold text-saffron">
              Offline
            </Text>
          </View>
        ) : null}
      </View>

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
          data={filteredItems}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 18,
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
          ListHeaderComponent={
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={`Search in ${categoryName || "category"}…`}
              style={{ marginTop: 0, marginBottom: 14 }}
            />
          }
          ListEmptyComponent={
            <View className="mt-12 items-center">
              <BookOpen color="#9CA3AF" size={28} />
              <Text className="mt-3 text-sm italic text-zinc-500">
                {q ? "No matching texts." : "No texts in this category yet."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Link href={`/library/${item.id}` as any} asChild>
              <Pressable
                className="mb-2.5 flex-row items-center rounded-2xl bg-white p-4 active:opacity-80"
                style={{
                  shadowColor: "#B8336A",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 10,
                  elevation: 2,
                }}
              >
                <View className="mr-4 h-11 w-11 items-center justify-center rounded-xl bg-saffron/15">
                  <BookOpen color="#F4A261" size={20} />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-base font-semibold text-zinc-900"
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text
                      className="mt-0.5 text-xs text-zinc-500"
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight color="#B8336A" size={20} />
              </Pressable>
            </Link>
          )}
        />
      )}
    </ScreenContainer>
  );
}
