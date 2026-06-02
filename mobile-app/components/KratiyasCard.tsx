// Home-tab card for "Guru Maa ki Kratiya" — admin-uploaded PDF library.
// Shows a teaser (first few covers) and links to the full list screen at
// `/kratiyas`. Renders nothing until at least one kratiya is published.

import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { BookOpen, ChevronRight, FileText } from "lucide-react-native";
import { Link } from "expo-router";

import { useCollection } from "../src/lib/useFirestore";
import { useTheme } from "../src/lib/useBranding";
import type { Kratiya } from "../../shared/types";

export function KratiyasCard() {
  const theme = useTheme();
  const { data, loading } = useCollection<Kratiya>("kratiyas", {
    orderByField: "order",
    orderDir: "asc",
    limit: 8,
  });

  if (loading) return null;
  if (!data || data.length === 0) return null;

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
      <View className="px-5 pt-5">
        <View className="flex-row items-center">
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.saffron + "33" }}
          >
            <BookOpen color={theme.saffron} size={16} />
          </View>
          <Text
            className="ml-3 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: theme.saffron }}
          >
            पवित्र साहित्य · Sacred Library
          </Text>
        </View>

        <Text
          className="mt-2 text-xl font-bold"
          style={{ color: theme.primary }}
        >
          कृतियाँ
        </Text>
        <Text className="mt-1 text-[13px] text-zinc-600">
          {data.length} {data.length === 1 ? "kratiya" : "kratiyas"} available
          to read and download.
        </Text>
      </View>

      {/* Horizontal cover rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 4,
        }}
      >
        {data.slice(0, 6).map((k) => (
          <Link
            key={k.id}
            href={{ pathname: "/kratiyas/[id]", params: { id: k.id! } } as any}
            asChild
          >
            <Pressable className="active:opacity-80">
              <View
                style={{
                  width: 96,
                  height: 132,
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: theme.cream,
                  borderWidth: 1,
                  borderColor: theme.saffron + "55",
                }}
              >
                {k.coverUrl ? (
                  <Image
                    source={{ uri: k.coverUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <FileText color={theme.saffron} size={28} />
                  </View>
                )}
              </View>
              <Text
                numberOfLines={2}
                className="mt-2 text-[11px] font-semibold"
                style={{ color: theme.primary, maxWidth: 96 }}
              >
                {k.title}
              </Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>

      {/* CTA */}
      <Link href={"/kratiyas" as any} asChild>
        <Pressable
          className="m-5 mt-3 flex-row items-center justify-center self-center rounded-full px-5 py-3 active:opacity-90"
          style={{
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.22,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <BookOpen color={theme.textOnPrimary} size={14} />
          <Text
            className="ml-2 text-[13px] font-bold"
            style={{ color: theme.textOnPrimary }}
          >
            सभी कृतियाँ देखें · View All
          </Text>
          <ChevronRight color={theme.textOnPrimary} size={14} />
        </Pressable>
      </Link>
    </View>
  );
}
