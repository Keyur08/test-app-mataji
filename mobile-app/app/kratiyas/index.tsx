// Searchable list of all "Guru Maa ki Kratiya" PDFs. Tapping a row opens
// `/kratiyas/[id]` (full-screen PDF reader + download).

import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { BookOpen, FileText, Search } from "lucide-react-native";
import { Link, Stack } from "expo-router";

import { ScreenContainer } from "../../components/ScreenContainer";
import { useCollection } from "../../src/lib/useFirestore";
import { useTheme } from "../../src/lib/useBranding";
import type { Kratiya } from "../../../shared/types";

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function KratiyasListScreen() {
  const theme = useTheme();
  const { data, loading } = useCollection<Kratiya>("kratiyas", {
    orderByField: "order",
    orderDir: "asc",
  });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter(
      (k) =>
        k.title?.toLowerCase().includes(q) ||
        k.description?.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "कृतियाँ",
          headerStyle: { backgroundColor: theme.headerBg },
          headerTintColor: theme.primary,
          headerTitleStyle: { fontWeight: "800" },
        }}
      />
      <ScreenContainer>
        {/* Search bar */}
        <View
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: theme.saffron + "66",
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Search color={theme.primary} size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search kratiyas…"
            placeholderTextColor="#9CA3AF"
            style={{
              flex: 1,
              color: theme.primary,
              fontSize: 15,
              fontWeight: "600",
            }}
            returnKeyType="search"
          />
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View
            style={{
              marginTop: 24,
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: theme.saffron + "AA",
              alignItems: "center",
              backgroundColor: theme.cream,
            }}
          >
            <BookOpen color={theme.saffron} size={32} />
            <Text
              style={{
                color: theme.primary,
                fontWeight: "700",
                marginTop: 10,
              }}
            >
              {search ? "No matches" : "No kratiyas yet"}
            </Text>
            <Text
              style={{
                color: theme.accent,
                fontSize: 12,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              {search
                ? "Try a different search term."
                : "Check back soon — new kratiyas will appear here."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id!}
            scrollEnabled={false}
            contentContainerStyle={{ paddingVertical: 12, gap: 12 }}
            renderItem={({ item }) => (
              <KratiyaRow item={item} theme={theme} />
            )}
          />
        )}
      </ScreenContainer>
    </>
  );
}

function KratiyaRow({
  item,
  theme,
}: {
  item: Kratiya;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Link
      href={{ pathname: "/kratiyas/[id]", params: { id: item.id! } } as any}
      asChild
    >
      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          gap: 12,
          padding: 12,
          borderRadius: 16,
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: theme.saffron + "55",
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: pressed ? 0.06 : 0.12,
          shadowRadius: 8,
          elevation: pressed ? 1 : 3,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View
          style={{
            width: 72,
            height: 96,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: theme.cream,
            borderWidth: 1,
            borderColor: theme.saffron + "55",
          }}
        >
          {item.coverUrl ? (
            <Image
              source={{ uri: item.coverUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText color={theme.saffron} size={28} />
            </View>
          )}
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text
            numberOfLines={2}
            style={{
              color: theme.primary,
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            {item.title}
          </Text>
          {item.description ? (
            <Text
              numberOfLines={2}
              style={{ color: theme.accent, fontSize: 12, marginTop: 4 }}
            >
              {item.description}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
            }}
          >
            <FileText color={theme.saffron} size={12} />
            <Text
              style={{
                color: theme.accent,
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              PDF{item.pdfSize ? ` · ${formatBytes(item.pdfSize)}` : ""}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
