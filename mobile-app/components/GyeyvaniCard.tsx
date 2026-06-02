import { Text, View } from "react-native";
import { Quote } from "lucide-react-native";
import type { Gyeyvani } from "../../shared/types";
import { ZoomableImage } from "./ZoomableImage";

type Props = { gyeyvani: Gyeyvani | null; loading: boolean };

/** "Thought of the Day" card. */
export function GyeyvaniCard({ gyeyvani, loading }: Props) {
  return (
    <View
      className="overflow-hidden rounded-3xl border border-saffron/30 bg-white p-6"
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* Large faded quote mark in background */}
      <View className="absolute -right-3 -top-2 opacity-10">
        <Quote color="#F4A261" size={120} />
      </View>

      <View className="flex-row items-center">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-saffron/20">
          <Quote color="#F4A261" size={16} />
        </View>
        <Text className="ml-3 text-[11px] font-bold uppercase tracking-widest text-saffron">
          ज्ञेयवाणी · Thought of the Day
        </Text>
      </View>

      {loading ? (
        <Text className="mt-5 text-base italic text-zinc-400">Loading…</Text>
      ) : gyeyvani ? (
        <>
          {gyeyvani.imageUrl ? (
            <View
              className="mt-5 overflow-hidden rounded-2xl bg-cream"
              style={{
                borderWidth: 1,
                borderColor: "rgba(244,162,97,0.4)",
              }}
            >
              <ZoomableImage
                uri={gyeyvani.imageUrl}
                caption={gyeyvani.quote}
                style={{ width: "100%", aspectRatio: 16 / 9 }}
                resizeMode="cover"
              />
            </View>
          ) : null}

          <Text
            className={`${gyeyvani.imageUrl ? "mt-4" : "mt-5"} text-xl font-semibold leading-8 text-zinc-900`}
            style={{ fontStyle: "italic" }}
          >
            “{gyeyvani.quote}”
          </Text>
          {gyeyvani.translation ? (
            <Text className="mt-3 text-sm leading-6 text-zinc-600">
              {gyeyvani.translation}
            </Text>
          ) : null}
          {gyeyvani.author ? (
            <View className="mt-4 flex-row items-center justify-end">
              <View className="h-px w-6 bg-primary/60" />
              <Text className="ml-2 text-xs font-bold uppercase tracking-widest text-primary">
                {gyeyvani.author}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text className="mt-5 text-sm italic text-zinc-400">
          No thought available for today.
        </Text>
      )}
    </View>
  );
}
