import { Image, Pressable, Text, View } from "react-native";
import { Pause, Play, SkipForward, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudio } from "../src/lib/AudioPlayerProvider";

/**
 * Sleek bottom-sliding mini-player.
 * Renders nothing when no track is active.
 *
 * Mount once near the root, above the tab bar.
 */
export function MiniPlayer({ bottomOffset }: { bottomOffset?: number }) {
  const { current, isPlaying, isBuffering, position, duration, toggle, next, stop } =
    useAudio();
  const insets = useSafeAreaInsets();
  // Matches the tab bar's height (64 + bottom inset) in (tabs)/_layout.tsx
  // so the player floats just above it, including on 3-button-nav Android devices.
  const resolvedBottomOffset = bottomOffset ?? 64 + insets.bottom;

  if (!current) return null;

  const progress =
    duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 px-3"
      style={{ bottom: resolvedBottomOffset + 8 }}
    >
      <View className="overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-lg">
        {/* progress bar */}
        <View className="h-0.5 w-full bg-saffron/15">
          <View
            className="h-full bg-primary"
            style={{ width: `${progress * 100}%` }}
          />
        </View>

        <View className="flex-row items-center px-3 py-2.5">
          {current.artworkUrl ? (
            <Image
              source={{ uri: current.artworkUrl }}
              className="h-11 w-11 rounded-lg"
              resizeMode="cover"
            />
          ) : (
            <View className="h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
              <Play color="#B8336A" size={18} fill="#B8336A" />
            </View>
          )}

          <View className="ml-3 flex-1">
            <Text
              className="text-sm font-semibold text-zinc-900"
              numberOfLines={1}
            >
              {current.title}
            </Text>
            <Text className="text-xs text-zinc-500" numberOfLines={1}>
              {isBuffering ? "Buffering…" : current.artist ?? "Bhajan"}
            </Text>
          </View>

          <Pressable
            onPress={toggle}
            hitSlop={8}
            className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-80"
          >
            {isPlaying ? (
              <Pause color="#fff" size={18} fill="#fff" />
            ) : (
              <Play color="#fff" size={18} fill="#fff" />
            )}
          </Pressable>

          <Pressable
            onPress={next}
            hitSlop={8}
            className="ml-1 h-9 w-9 items-center justify-center rounded-full active:opacity-60"
          >
            <SkipForward color="#B8336A" size={18} />
          </Pressable>

          <Pressable
            onPress={stop}
            hitSlop={8}
            className="ml-1 h-9 w-9 items-center justify-center rounded-full active:opacity-60"
          >
            <X color="#9CA3AF" size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
