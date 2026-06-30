// Configurable splash screen.
// ---------------------------
// Full-bleed devotional image with an auto-playing audio invocation and a
// single "Begin" CTA. Both assets are sourced from `useSplashManager`, which
// caches them in `Paths.document/splash/` for offline-first rendering.
//
// On "Begin":
//   - If the user has a complete profile (`useUserProfile` → "ready") we
//     `router.replace` to the admin-configured `targetRoute` (default "/").
//   - Otherwise we send them through the registration flow at `/login`.
// Audio is unloaded (`player.remove()`) on unmount so it does not bleed
// into the next screen's playback.

import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAudioPlayer } from "expo-audio";

import { useSplashManager } from "../src/lib/useSplashManager";
import { useUserProfile } from "../src/lib/useUserProfile";

export default function SplashScreen() {
  const router = useRouter();
  const { ready, enabled, localImageUri, localAudioUri, targetRoute } =
      useSplashManager();
  const { status } = useUserProfile();

  // Skip the splash ONLY when the admin has explicitly disabled it.
  // We still wait for `ready` so we don't flash past a configured splash.
  useEffect(() => {
    if (!ready) return;
    if (!enabled) {
      forward();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled, status]);

  // Auto-play the splash audio. `useAudioPlayer(source)` accepts a `{ uri }`
  // object or null; passing the local file URI directly is fine in SDK 55.
  const audioSource = useMemo(
      () => (localAudioUri ? { uri: localAudioUri } : null),
      [localAudioUri],
  );
  const player = useAudioPlayer(audioSource, { updateInterval: 1000 });

  useEffect(() => {
    if (!audioSource) return;
    try {
      player.loop = false;
      player.play();
    } catch {
      /* ignore — splash should never crash the app */
    }
    return () => {
      try {
        player.pause();
        player.remove();
      } catch {
        /* ignore */
      }
    };
    // We intentionally re-run when the source changes (e.g. cache refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSource]);

  function forward() {
    // Anonymous-but-no-profile devotees go through registration; everyone
    // else lands on the admin-configured destination (typically "/").
    if (status === "ready") {
      router.replace((targetRoute || "/") as never);
    } else {
      router.replace("/login" as never);
    }
  }

  // Loading state — keep the saffron/cream theme so it doesn't flash white.
  // Only block on `ready`; when enabled but assets are missing, still render
  // the splash UI (CTA still works, user can proceed).
  if (!enabled) {
    return (
        <View className="flex-1 items-center justify-center bg-cream">
          <ActivityIndicator size="large" color="#B8336A" />
        </View>
    );
  }

  const imageSource = localImageUri ? { uri: localImageUri } : undefined;

  return (
      <View className="flex-1 bg-black">
        <StatusBar hidden />
        <ImageBackground
            source={imageSource}
            resizeMode="cover"
            className="flex-1"
        >
          {/* Dark gradient-ish scrim at the bottom so the CTA stays legible
            against any photograph the admin uploads. */}
          <SafeAreaView className="flex-1 justify-end" edges={["bottom"]}>
            <View className="px-6 pb-10">
              <View className="rounded-3xl bg-black/35 px-5 py-6">
                <Text className="text-center text-2xl font-semibold text-cream">
                  ज्ञेयश्री माताजी
                </Text>
                <Text className="mt-1 text-center text-sm text-cream/80">
                  Welcome — tap below to begin your darshan.
                </Text>
                <Pressable
                    onPress={forward}
                    accessibilityRole="button"
                    accessibilityLabel="Begin"
                    className="mt-5 self-center rounded-full bg-saffron px-10 py-3 active:opacity-80"
                    style={{
                      shadowColor: "#B8336A",
                      shadowOpacity: 0.35,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 6,
                    }}
                >
                  <Text className="text-base font-bold uppercase tracking-widest text-primary">
                    Begin
                  </Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </ImageBackground>
      </View>
  );
}
