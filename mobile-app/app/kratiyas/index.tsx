// Searchable grid of all "Guru Maa ki Kratiya" PDFs. Tapping a card opens
// `/kratiyas/[id]` (full-screen PDF reader + download).

import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
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

const NUM_COLUMNS = 3;
const GRID_GAP = 12;
const SCREEN_PADDING = 20; // matches ScreenContainer's horizontal px-5
// Fixed pixel sizes (rather than aspectRatio) so every card comes out
// exactly the same height regardless of image load state or title length.
const CARD_IMAGE_HEIGHT = 116;
const CARD_TITLE_HEIGHT = 56;

export default function KratiyasListScreen() {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  // A literal pixel width (not a percentage) so the card's size can never be
  // influenced by its own content — text always wraps inside it instead of
  // growing it.
  const cardWidth =
    (windowWidth - SCREEN_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) /
    NUM_COLUMNS;
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
      <ScreenContainer scroll>
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

        {!loading && data && data.length > 0 ? (
          <Text
            style={{
              marginTop: 16,
              marginBottom: 2,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: theme.saffron,
            }}
          >
            {search
              ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}`
              : `${data.length} kratiya${data.length === 1 ? "" : "s"}`}
          </Text>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
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
          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: GRID_GAP,
            }}
          >
            {filtered.map((item) => (
              <KratiyaCard
                key={item.id}
                item={item}
                theme={theme}
                width={cardWidth}
              />
            ))}
          </View>
        )}
      </ScreenContainer>
    </>
  );
}

function KratiyaCard({
  item,
  theme,
  width,
}: {
  item: Kratiya;
  theme: ReturnType<typeof useTheme>;
  width: number;
}) {
  return (
    <Link
      href={{ pathname: "/kratiyas/[id]", params: { id: item.id! } } as any}
      asChild
    >
      <Pressable
        style={({ pressed }) => ({
          width,
          flexGrow: 0,
          flexShrink: 0,
          // The "border" is drawn as a colored padding box rather than the
          // native `border` style — combining borderWidth + borderRadius +
          // elevation on one Android view is unreliable and can make the
          // border invisible. This approach always renders correctly.
          padding: 3,
          borderRadius: 16,
          backgroundColor: pressed ? theme.primary : theme.saffron,
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: pressed ? 0.06 : 0.14,
          shadowRadius: 9,
          elevation: pressed ? 1 : 4,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View
          style={{
            borderRadius: 13,
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
          }}
        >
          <View
            style={{
              width: "100%",
              height: CARD_IMAGE_HEIGHT,
              backgroundColor: theme.cream,
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
                <FileText color={theme.saffron} size={22} />
              </View>
            )}

            <View
              style={{
                position: "absolute",
                left: 5,
                bottom: 5,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                backgroundColor: "rgba(0,0,0,0.6)",
                borderRadius: 6,
                paddingHorizontal: 5,
                paddingVertical: 2,
                maxWidth: "90%",
              }}
            >
              <FileText color="#FFFFFF" size={9} />
              <Text
                numberOfLines={1}
                style={{
                  color: "#FFFFFF",
                  fontSize: 9,
                  fontWeight: "700",
                }}
              >
                PDF{item.pdfSize ? ` · ${formatBytes(item.pdfSize)}` : ""}
              </Text>
            </View>
          </View>

          <View
            style={{
              height: CARD_TITLE_HEIGHT,
              padding: 8,
              justifyContent: "center",
              borderTopWidth: 1,
              borderTopColor: theme.saffron + "30",
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                color: theme.primary,
                fontSize: 12,
                fontWeight: "800",
                lineHeight: 15,
              }}
            >
              {item.title}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
