import { createElement, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useVideoPlayer, VideoView, type VideoView as VideoViewType } from "expo-video";
import { useEvent } from "expo";
import {
  Download,
  Film,
  PictureInPicture2,
  PlayCircle,
  X,
} from "lucide-react-native";

import { useCollection } from "../src/lib/useFirestore";
import type { Reel } from "../../shared/types";

const WEB_MAX_WIDTH = 480;
const SCREEN_PADDING = 40; // ScreenContainer px-5 on each side

export function ReelsTab() {
  const { data, loading, error, refresh } = useCollection<Reel>("reels", {
    orderByField: "order",
    orderDir: "asc",
    limit: 100,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<Reel | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const GAP = 12;
  // Use window width clamped to the web phone-column max so reels don't
  // stretch huge in a desktop browser. Hooks must run on every render, so
  // we compute these BEFORE any early returns below.
  const { width: rawWidth } = useWindowDimensions();
  const screenW =
    Platform.OS === "web" ? Math.min(rawWidth, WEB_MAX_WIDTH) : rawWidth;
  const cellW = Math.floor((screenW - SCREEN_PADDING - GAP) / 2);
  const cellH = Math.round(cellW * (16 / 9));

  if (loading && !data) {
    return (
      <View className="mt-16 items-center">
        <ActivityIndicator color="#B8336A" />
        <Text className="mt-3 text-sm text-zinc-500">Loading reels…</Text>
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
        <Film color="#9CA3AF" size={28} />
        <Text className="mt-3 text-sm italic text-zinc-500">
          No reels yet.
        </Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#B8336A"
            colors={["#B8336A", "#F4A261"]}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setActive(item)}
            style={{ width: cellW }}
            className="overflow-hidden rounded-2xl border border-primary/10 bg-white active:opacity-90"
          >
            <View
              style={{ width: cellW, height: cellH }}
              className="relative bg-black"
            >
              {item.thumbnailUrl ? (
                <Image
                  source={{ uri: item.thumbnailUrl }}
                  style={{ width: cellW, height: cellH }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{ width: cellW, height: cellH }}
                  className="items-center justify-center"
                >
                  <Film color="#fff" size={28} />
                </View>
              )}

              {/* Bottom gradient-ish overlay for title legibility */}
              <View className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-2">
                {item.title ? (
                  <Text
                    className="text-xs font-semibold text-white"
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                ) : null}
                {item.caption ? (
                  <Text
                    className="mt-0.5 text-[10px] text-white/85"
                    numberOfLines={1}
                  >
                    {item.caption}
                  </Text>
                ) : null}
              </View>

              {/* Centered play affordance */}
              <View className="absolute inset-0 items-center justify-center">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-white/25">
                  <PlayCircle color="#fff" size={36} />
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />

      <ReelPlayer reel={active} onClose={() => setActive(null)} />
    </>
  );
}

function ReelPlayer({
  reel,
  onClose,
}: {
  reel: Reel | null;
  onClose: () => void;
}) {
  const { height } = Dimensions.get("window");
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const nativeVideoRef = useRef<VideoViewType | null>(null);

  // expo-video player (native only). Hook must run on every render — pass
  // empty source when no reel and the player just stays idle.
  const player = useVideoPlayer(
    reel && Platform.OS !== "web" ? reel.videoUrl : null,
    (p) => {
      p.loop = true;
      p.muted = false;
      p.play();
    },
  );

  // Subscribe to native player status so we can show a buffering spinner
  // over the video while it's loading / re-buffering.
  const { status: nativeStatus } = useEvent(player, "statusChange", {
    status: player.status,
  });
  const showNativeLoader =
    Platform.OS !== "web" &&
    !!reel &&
    (nativeStatus === "loading" || nativeStatus === "idle");

  /** Trigger a download of the reel video. */
  const onDownload = useCallback(() => {
    if (!reel?.videoUrl) return;
    if (Platform.OS === "web") {
      // Anchor-tag click — works for same-origin and CORS-permitted blobs;
      // falls back to opening the file in a new tab.
      if (typeof document !== "undefined") {
        const a = document.createElement("a");
        a.href = reel.videoUrl;
        a.download = `${(reel.title || "reel").replace(/[^\w\-]+/g, "_")}.mp4`;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } else {
      // Native: open the URL — the OS download/share sheet handles it.
      Linking.openURL(reel.videoUrl).catch(() => {});
    }
  }, [reel]);

  /** Toggle Picture-in-Picture. */
  const onPiP = useCallback(() => {
    if (Platform.OS === "web") {
      const v = webVideoRef.current;
      if (!v) return;
      try {
        const anyDoc = document as unknown as {
          pictureInPictureElement?: Element | null;
          exitPictureInPicture?: () => Promise<void>;
        };
        const anyV = v as unknown as {
          requestPictureInPicture?: () => Promise<unknown>;
          webkitSetPresentationMode?: (mode: string) => void;
        };
        if (anyDoc.pictureInPictureElement && anyDoc.exitPictureInPicture) {
          anyDoc.exitPictureInPicture().catch(() => {});
        } else if (anyV.requestPictureInPicture) {
          anyV.requestPictureInPicture().catch(() => {});
        } else if (anyV.webkitSetPresentationMode) {
          anyV.webkitSetPresentationMode("picture-in-picture");
        }
      } catch {
        /* ignore */
      }
    } else {
      // Native — expo-video supports PiP on iOS & Android.
      try {
        nativeVideoRef.current?.startPictureInPicture();
      } catch {
        /* ignore */
      }
    }
  }, []);

  return (
    <Modal
      visible={!!reel}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black">
        {reel ? (
          Platform.OS === "web" ? (
            // Real React-controlled <video> on react-native-web. Using
            // `createElement` lets us mount the actual DOM element with
            // a ref so we can drive Picture-in-Picture from JS.
            createElement("video", {
              ref: (el: HTMLVideoElement | null) => {
                webVideoRef.current = el;
              },
              src: reel.videoUrl,
              poster: reel.thumbnailUrl,
              controls: true,
              autoPlay: true,
              loop: true,
              muted: true,
              playsInline: true,
              "webkit-playsinline": "true",
              preload: "auto",
              style: {
                width: "100%",
                height: "100%",
                background: "#000",
                objectFit: "contain",
                display: "block",
              },
            })
          ) : (
            // Native — expo-video gives us a real AVPlayer / ExoPlayer with
            // native controls, fullscreen and Picture-in-Picture support.
            <VideoView
              ref={nativeVideoRef}
              player={player}
              style={{ flex: 1, backgroundColor: "#000" }}
              contentFit="contain"
              nativeControls
              allowsPictureInPicture
              startsPictureInPictureAutomatically={false}
            />
          )
        ) : null}

        {/* Buffering loader (native only) — sits over the VideoView while
            the player is still loading or has no source ready. */}
        {showNativeLoader ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center"
          >
            <View className="h-16 w-16 items-center justify-center rounded-full bg-black/45">
              <ActivityIndicator color="#F4A261" size="large" />
            </View>
          </View>
        ) : null}

        {/* Top-right control cluster: PiP, Download, Close */}
        <View
          className="absolute right-3 top-12 flex-row items-center"
          style={{ gap: 10 }}
        >
          <Pressable
            onPress={onPiP}
            hitSlop={12}
            accessibilityLabel="Picture in Picture"
            className="h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-70"
          >
            <PictureInPicture2 color="#fff" size={20} />
          </Pressable>
          <Pressable
            onPress={onDownload}
            hitSlop={12}
            accessibilityLabel="Download reel"
            className="h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-70"
          >
            <Download color="#fff" size={20} />
          </Pressable>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-70"
          >
            <X color="#fff" size={22} />
          </Pressable>
        </View>

        {(reel?.title || reel?.caption) && (
          <View
            className="absolute left-0 right-0 px-5"
            style={{ bottom: Math.max(24, height * 0.06) }}
            pointerEvents="none"
          >
            {reel?.title ? (
              <Text
                className="text-base font-bold text-white"
                style={{
                  textShadowColor: "rgba(0,0,0,0.6)",
                  textShadowRadius: 4,
                }}
                numberOfLines={2}
              >
                {reel.title}
              </Text>
            ) : null}
            {reel?.caption ? (
              <Text
                className="mt-1 text-xs text-white/90"
                style={{
                  textShadowColor: "rgba(0,0,0,0.6)",
                  textShadowRadius: 3,
                }}
                numberOfLines={3}
              >
                {reel.caption}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}
