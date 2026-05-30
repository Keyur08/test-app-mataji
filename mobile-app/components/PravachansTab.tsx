// Pravachans tab — renders two kinds of entries:
//   1. Video pravachans  → tap thumbnail, opens YouTube app / new tab.
//   2. Audio pravachans  → tap row, plays through the global background
//                          AudioPlayerProvider with lock-screen controls
//                          (same path the bhajan list uses).
//
// The admin decides per-entry: an item is "audio" when `audioUrl` is set,
// else it's treated as "video" using `youtubeUrl`.

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Headphones, Pause, Play, PlayCircle, Video } from "lucide-react-native";

import { useCollection } from "../src/lib/useFirestore";
import { parseYouTubeId, youTubeThumb } from "../src/lib/youtube";
import { useAudio, type PlayableTrack } from "../src/lib/AudioPlayerProvider";
import type { Pravachan } from "../../shared/types";

/** Open a YouTube video — try the YouTube app first, fall back to browser. */
async function openYouTube(videoId: string) {
  const webUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.open(webUrl, "_blank", "noopener,noreferrer");
    }
    return;
  }

  const appUrl = `vnd.youtube://${videoId}`;
  try {
    const can = await Linking.canOpenURL(appUrl);
    if (can) {
      await Linking.openURL(appUrl);
      return;
    }
  } catch {
    /* fall through to web */
  }
  Linking.openURL(webUrl).catch(() => {});
}

/** True when this entry has audio content (admin uploaded an audio file). */
function isAudioPravachan(p: Pravachan): boolean {
  return !!p.audioUrl && p.audioUrl.length > 0;
}

/** Convert an audio pravachan to a PlayableTrack the audio provider accepts. */
function pravachanToTrack(p: Pravachan): PlayableTrack {
  return {
    id: p.id,
    title: p.title,
    audioUrl: p.audioUrl ?? "",
    artist: p.speaker || "Pravachan",
    artworkUrl: p.thumbnailUrl,
    durationSec: p.durationSec,
  };
}

export function PravachansTab() {
  const { data, loading, error, refresh } = useCollection<Pravachan>(
    "pravachans",
    { orderByField: "order", orderDir: "asc", limit: 100 }
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

  const { current, isPlaying, setQueueAndPlay, toggle } = useAudio();

  // Build the audio-only queue once. Tapping an audio row plays from the
  // pruned list so that auto-advance skips over any interleaved videos.
  const audioQueue = useMemo<PlayableTrack[]>(() => {
    if (!data) return [];
    return data.filter(isAudioPravachan).map(pravachanToTrack);
  }, [data]);

  const onPressAudio = useCallback(
    (trackId: string) => {
      const idx = audioQueue.findIndex((t) => t.id === trackId);
      if (idx < 0) return;
      if (current?.id === trackId) {
        toggle();
      } else {
        setQueueAndPlay(audioQueue, idx);
      }
    },
    [audioQueue, current?.id, toggle, setQueueAndPlay]
  );

  if (loading && !data) {
    return (
      <View className="mt-16 items-center">
        <ActivityIndicator color="#B8336A" />
        <Text className="mt-3 text-sm text-zinc-500">Loading pravachans…</Text>
      </View>
    );
  }
  if (error && !data) {
    return (
      <Text className="mt-6 text-sm text-red-500">
        Could not load: {error.message}
      </Text>
    );
  }
  if (!data || data.length === 0) {
    return (
      <View className="mt-16 items-center">
        <Video color="#9CA3AF" size={28} />
        <Text className="mt-3 text-sm italic text-zinc-500">
          No pravachans yet.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#B8336A"
          colors={["#B8336A", "#F4A261"]}
        />
      }
      renderItem={({ item }) =>
        isAudioPravachan(item) ? (
          <AudioPravachanCard
            pravachan={item}
            active={current?.id === item.id}
            playing={current?.id === item.id && isPlaying}
            onPress={() => onPressAudio(item.id)}
          />
        ) : (
          <VideoPravachanCard pravachan={item} />
        )
      }
    />
  );
}

/* ----------------------------------------------------------- */

function VideoPravachanCard({ pravachan }: { pravachan: Pravachan }) {
  const videoId = parseYouTubeId(pravachan.youtubeUrl ?? "");

  return (
    <Pressable
      onPress={() => videoId && openYouTube(videoId)}
      disabled={!videoId}
      className="mb-4 overflow-hidden rounded-2xl border border-primary/10 bg-white active:opacity-90"
    >
      {videoId ? (
        <View className="relative aspect-video w-full bg-black">
          <Image
            source={{ uri: youTubeThumb(videoId) }}
            className="h-full w-full"
            resizeMode="cover"
          />
          <View className="absolute inset-0 items-center justify-center bg-black/20">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-white/95">
              <PlayCircle color="#B8336A" size={42} fill="#B8336A" />
            </View>
          </View>
        </View>
      ) : (
        <View className="aspect-video w-full items-center justify-center bg-zinc-100">
          <Video color="#9CA3AF" size={32} />
        </View>
      )}

      <View className="p-3">
        <Text
          className="text-base font-semibold text-zinc-900"
          numberOfLines={2}
        >
          {pravachan.title}
        </Text>
        {pravachan.speaker ? (
          <Text
            className="mt-1 text-xs font-medium uppercase tracking-wider text-saffron"
            numberOfLines={1}
          >
            {pravachan.speaker}
          </Text>
        ) : null}
        {pravachan.description ? (
          <Text
            className="mt-1.5 text-xs leading-5 text-zinc-600"
            numberOfLines={2}
          >
            {pravachan.description}
          </Text>
        ) : null}
        {!videoId ? (
          <Text className="mt-2 text-[10px] uppercase tracking-wider text-red-500">
            Invalid YouTube URL
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function AudioPravachanCard({
  pravachan,
  active,
  playing,
  onPress,
}: {
  pravachan: Pravachan;
  active: boolean;
  playing: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-3 flex-row items-center rounded-2xl p-3 active:opacity-80 ${
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
      {/* Artwork or audio icon */}
      <View
        className={`mr-3 h-16 w-16 items-center justify-center overflow-hidden rounded-xl ${
          active ? "bg-primary" : "bg-primary/10"
        }`}
      >
        {pravachan.thumbnailUrl ? (
          <Image
            source={{ uri: pravachan.thumbnailUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <Headphones color={active ? "#fff" : "#B8336A"} size={26} />
        )}
      </View>

      <View className="flex-1">
        <Text
          className={`text-base font-semibold ${
            active ? "text-primary" : "text-zinc-900"
          }`}
          numberOfLines={2}
        >
          {pravachan.title}
        </Text>
        {pravachan.speaker ? (
          <Text
            className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-saffron"
            numberOfLines={1}
          >
            {pravachan.speaker}
          </Text>
        ) : null}
        {pravachan.description ? (
          <Text className="mt-1 text-xs text-zinc-500" numberOfLines={1}>
            {pravachan.description}
          </Text>
        ) : null}
      </View>

      {/* Play/Pause button */}
      <View
        className={`ml-2 h-11 w-11 items-center justify-center rounded-full ${
          active ? "bg-primary" : "bg-primary/10"
        }`}
      >
        {playing ? (
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
    </Pressable>
  );
}
