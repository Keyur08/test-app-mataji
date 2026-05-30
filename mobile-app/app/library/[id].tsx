import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Minus, Plus, WifiOff } from "lucide-react-native";

import { useCachedDoc } from "../../src/lib/useCachedFirestore";
import { useReaderFontSize } from "../../src/lib/useReaderFontSize";
import { FormattedText } from "../../components/FormattedText";
import type { LibraryText } from "../../../shared/types";

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading, fromCache, error, refresh } = useCachedDoc<LibraryText>(
    "texts_library",
    id,
    `texts_library:doc:${id}`
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

  const { size, increase, decrease, canIncrease, canDecrease } =
    useReaderFontSize();

  return (
    <>
      <Stack.Screen
        options={{
          title: data?.title ?? "Reading",
          headerRight: () => (
            <View className="flex-row items-center">
              <Pressable
                disabled={!canDecrease}
                onPress={decrease}
                hitSlop={8}
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  canDecrease ? "bg-primary/10" : "bg-zinc-100"
                }`}
              >
                <Minus color={canDecrease ? "#B8336A" : "#D1D5DB"} size={16} />
              </Pressable>
              <Text className="mx-2 w-7 text-center text-xs font-semibold text-primary">
                {size}
              </Text>
              <Pressable
                disabled={!canIncrease}
                onPress={increase}
                hitSlop={8}
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  canIncrease ? "bg-primary/10" : "bg-zinc-100"
                }`}
              >
                <Plus color={canIncrease ? "#B8336A" : "#D1D5DB"} size={16} />
              </Pressable>
            </View>
          ),
        }}
      />

      {loading && !data ? (
        <View className="flex-1 items-center justify-center bg-cream">
          <ActivityIndicator color="#B8336A" />
          <Text className="mt-3 text-sm text-zinc-500">Loading text…</Text>
        </View>
      ) : !data ? (
        <View className="flex-1 items-center justify-center bg-cream px-6">
          <Text className="text-center text-base text-zinc-600">
            {error
              ? `Could not load: ${error.message}`
              : "This text is no longer available."}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-cream"
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#B8336A"
              colors={["#B8336A", "#F4A261"]}
            />
          }
        >
          {/* Decorative religious scripture card */}
          <View
            className="overflow-hidden rounded-[28px] bg-white"
            style={{
              borderWidth: 1.5,
              borderColor: "#F4A261",
              shadowColor: "#B8336A",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            {/* Inner double-line border */}
            <View
              className="m-2 rounded-[22px]"
              style={{
                borderWidth: 1,
                borderColor: "rgba(184,51,106,0.25)",
                borderStyle: "dashed",
                padding: 18,
              }}
            >
              {/* Top ornamental band — Om mantra with flanking lines */}
              <View className="mb-5 flex-row items-center justify-center">
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: "rgba(244,162,97,0.5)",
                  }}
                />
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: "rgba(244,162,97,0.5)",
                    marginLeft: 4,
                  }}
                />
                <View
                  className="mx-3 h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: "#FFF8F0",
                    borderWidth: 1.5,
                    borderColor: "#F4A261",
                    shadowColor: "#F4A261",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      color: "#B8336A",
                      fontWeight: "700",
                      lineHeight: 26,
                    }}
                  >
                    ॐ
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: "rgba(244,162,97,0.5)",
                    marginRight: 4,
                  }}
                />
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: "rgba(244,162,97,0.5)",
                  }}
                />
              </View>

              {/* Header */}
              <Text className="text-center text-3xl font-bold text-primary">
                {data.title}
              </Text>
              <View className="mt-2 flex-row items-center justify-center">
                <Text
                  style={{ color: "#F4A261", fontSize: 12, marginRight: 6 }}
                >
                  ❋
                </Text>
                <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-saffron">
                  {data.category}
                </Text>
                <Text
                  style={{ color: "#F4A261", fontSize: 12, marginLeft: 6 }}
                >
                  ❋
                </Text>
              </View>

              {fromCache ? (
                <View className="mt-2 flex-row justify-center">
                  <View className="flex-row items-center rounded-full bg-saffron/15 px-2 py-0.5">
                    <WifiOff color="#F4A261" size={10} />
                    <Text className="ml-1 text-[10px] font-semibold text-saffron">
                      Offline copy
                    </Text>
                  </View>
                </View>
              ) : null}

              {data.subtitle ? (
                <Text className="mt-3 text-center text-sm italic text-zinc-600">
                  {data.subtitle}
                </Text>
              ) : null}

              {/* Ornamental divider */}
              <View className="mt-5 flex-row items-center">
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: "rgba(184,51,106,0.15)",
                  }}
                />
                <Text
                  style={{
                    marginHorizontal: 10,
                    color: "#B8336A",
                    fontSize: 14,
                  }}
                >
                  ◈
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: "rgba(184,51,106,0.15)",
                  }}
                />
              </View>

              {/* Body — typography optimized for devotional reading */}
              <FormattedText
                className="mt-5 text-zinc-900"
                style={{
                  fontSize: size,
                  lineHeight: Math.round(size * 1.7),
                  letterSpacing: 0.2,
                }}
                body={data.body}
              />

              {/* Bottom ornamental band */}
              <View className="mt-8 flex-row items-center">
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: "rgba(244,162,97,0.4)",
                  }}
                />
                <Text
                  style={{
                    marginHorizontal: 12,
                    color: "#B8336A",
                    fontSize: 13,
                    letterSpacing: 2,
                    fontStyle: "italic",
                  }}
                >
                  ॥ इति ॥
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: "rgba(244,162,97,0.4)",
                  }}
                />
              </View>
            </View>

            {/* Decorative corner accents (outside inner border) */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: -18,
                top: -18,
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: "rgba(244,162,97,0.12)",
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: -22,
                bottom: -22,
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "rgba(184,51,106,0.08)",
              }}
            />
          </View>
        </ScrollView>
      )}
    </>
  );
}
