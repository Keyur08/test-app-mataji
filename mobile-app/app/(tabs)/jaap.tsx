import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Pause, Play, RotateCcw, Target, Undo2 } from "lucide-react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { ScreenContainer } from "../../components/ScreenContainer";
import { useTheme } from "../../src/lib/useBranding";
import { useDoc } from "../../src/lib/useFirestore";

// ─── Storage keys ──────────────────────────────────────────────────────────
const STORAGE_KEY_COUNT = "jaap:count";
const STORAGE_KEY_TARGET = "jaap:target";
const STORAGE_KEY_MALAS = "jaap:malas";
const STORAGE_KEY_MANTRA = "jaap:mantra";
const STORAGE_KEY_MANTRAS_CACHE = "jaap:mantras_cache";

const DEFAULT_TARGET = 108; // Standard Jain mala — 108 beads.

// ─── Mantra type + bundled fallback list ───────────────────────────────────
// The admin can override this list via Firestore (`app_config/jaap_mantras`).
// These defaults are used when the doc is missing/empty and as offline
// fallback on first launch.
type Mantra = {
  id: string;
  label: string;
  text: string;
  audioUrl?: string;
};
const DEFAULT_MANTRAS: Mantra[] = [
  {
    id: "namokar",
    label: "णमोकार",
    text:
      "णमो अरिहंताणं\n" +
      "णमो सिद्धाणं\n" +
      "णमो आयरियाणं\n" +
      "णमो उवज्झायाणं\n" +
      "णमो लोए सव्व साहूणं",
  },
  { id: "om", label: "ॐ", text: "ॐ" },
  { id: "arham", label: "अर्हम्", text: "अर्हम्" },
  { id: "siddha", label: "सिद्ध", text: "णमो सिद्धाणं" },
];

type MantrasDoc = { mantras?: Mantra[] };

export default function JaapScreen() {
  const theme = useTheme();

  // ── Mantras (Firestore + AsyncStorage cache + bundled fallback) ────────
  const { data: mantrasDoc } = useDoc<MantrasDoc>(
    "app_config",
    "jaap_mantras",
  );
  const [cachedMantras, setCachedMantras] = useState<Mantra[] | null>(null);

  // Load cached list once, so we have something to show before Firestore
  // resolves (and when offline).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_MANTRAS_CACHE)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as Mantra[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCachedMantras(parsed);
          }
        } catch {
          // ignore corrupt cache
        }
      })
      .catch(() => {});
  }, []);

  // Persist Firestore list to cache whenever it changes.
  useEffect(() => {
    const list = mantrasDoc?.mantras;
    if (Array.isArray(list) && list.length > 0) {
      AsyncStorage.setItem(
        STORAGE_KEY_MANTRAS_CACHE,
        JSON.stringify(list),
      ).catch(() => {});
    }
  }, [mantrasDoc?.mantras]);

  // Final mantra list — prefer Firestore, then cache, then bundled defaults.
  const mantras: Mantra[] =
    (mantrasDoc?.mantras && mantrasDoc.mantras.length > 0
      ? mantrasDoc.mantras
      : cachedMantras && cachedMantras.length > 0
        ? cachedMantras
        : DEFAULT_MANTRAS).filter(
      (m): m is Mantra =>
        !!m && typeof m.id === "string" && !!m.label && !!m.text,
    );

  // Persisted state ---------------------------------------------------------
  const [count, setCount] = useState(0); // beads in current mala (0..target-1)
  const [malas, setMalas] = useState(0); // completed malas
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [mantraId, setMantraId] = useState<string>(DEFAULT_MANTRAS[0].id);
  const [loaded, setLoaded] = useState(false);

  // UI state ----------------------------------------------------------------
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState(String(DEFAULT_TARGET));

  // Animation refs ----------------------------------------------------------
  const popScale = useRef(new Animated.Value(1)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;

  // ── Load persisted values on mount ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, t, m, mid] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_COUNT),
          AsyncStorage.getItem(STORAGE_KEY_TARGET),
          AsyncStorage.getItem(STORAGE_KEY_MALAS),
          AsyncStorage.getItem(STORAGE_KEY_MANTRA),
        ]);
        if (cancelled) return;
        if (t) {
          const parsed = parseInt(t, 10);
          if (parsed >= 2 && parsed <= 100000) setTarget(parsed);
        }
        if (c) setCount(Math.max(0, parseInt(c, 10) || 0));
        if (m) setMalas(Math.max(0, parseInt(m, 10) || 0));
        if (mid) setMantraId(mid);
      } catch {
        // ignore — start fresh
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Persist on change ─────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_COUNT, String(count)).catch(() => {});
  }, [count, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_MALAS, String(malas)).catch(() => {});
  }, [malas, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_TARGET, String(target)).catch(() => {});
  }, [target, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_MANTRA, mantraId).catch(() => {});
  }, [mantraId, loaded]);

  // ── Derived ───────────────────────────────────────────────────────────
  const progressPct = target > 0 ? count / target : 0;
  const selectedMantra =
    mantras.find((m) => m.id === mantraId) ?? mantras[0] ?? DEFAULT_MANTRAS[0];

  // If the persisted mantra id is no longer in the list (admin removed it),
  // silently snap to the first available one.
  useEffect(() => {
    if (!loaded) return;
    if (mantras.length === 0) return;
    if (!mantras.some((m) => m.id === mantraId)) {
      setMantraId(mantras[0].id);
    }
  }, [mantras, mantraId, loaded]);

  // ── Mantra audio playback (loops continuously) ────────────────────────
  // expo-audio: dedicated player for the jaap screen. We don't touch the
  // global bhajan player, so audio playback here is isolated.
  const audioPlayer = useAudioPlayer(null, { updateInterval: 500 });
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const [audioWanted, setAudioWanted] = useState(false); // user wants playback on/off
  const lastAudioUrlRef = useRef<string | null>(null);
  // Mutable ref to the latest handleIncrement — used by the audio-loop
  // effect (defined below) so it can call it without creating a dependency
  // cycle.
  const handleIncrementRef = useRef<(() => void) | null>(null);

  // Load the selected mantra's audio source whenever it changes.
  useEffect(() => {
    const url = selectedMantra.audioUrl ?? null;
    if (url === lastAudioUrlRef.current) return;
    lastAudioUrlRef.current = url;
    try {
      if (url) {
        audioPlayer.replace({ uri: url });
        if (audioWanted) audioPlayer.play();
      } else {
        audioPlayer.pause();
      }
    } catch {
      // player not ready yet
    }
  }, [selectedMantra.audioUrl, audioPlayer, audioWanted]);

  // Loop on completion — subscribe directly to the player's status updates
  // (more reliable than tracking `didJustFinish` via React state, which can
  // miss the brief true→false transition). On every completed cycle, restart
  // playback and bump the bead counter by one.
  const audioWantedRef = useRef(false);
  useEffect(() => {
    audioWantedRef.current = audioWanted;
  }, [audioWanted]);

  useEffect(() => {
    // `AudioPlayer` is a SharedObject<AudioEvents> with a
    // `playbackStatusUpdate(status)` event. We edge-trigger off `didJustFinish`
    // so a single cycle counts exactly once even if the event fires multiple
    // times with the flag still set.
    let lastFinished = false;
    const sub = audioPlayer.addListener(
      "playbackStatusUpdate",
      (status: { didJustFinish?: boolean }) => {
        const finished = !!status?.didJustFinish;
        if (finished && !lastFinished) {
          if (audioWantedRef.current) {
            // Defer to a microtask so we don't trigger setState inside
            // another component's render pass (the parallel
            // `useAudioPlayerStatus` subscriber re-renders synchronously
            // on the same emission). Without this, React warns:
            // "Cannot update a component while rendering a different one".
            setTimeout(() => {
              try {
                audioPlayer.seekTo(0);
                audioPlayer.play();
              } catch {
                // ignore
              }
              // One completed recitation = one bead.
              handleIncrementRef.current?.();
            }, 0);
          }
        }
        lastFinished = finished;
      },
    );
    return () => {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    };
  }, [audioPlayer]);

  // Stop audio when leaving the screen / mantra has no audio.
  useEffect(() => {
    return () => {
      try {
        audioPlayer.pause();
      } catch {
        // ignore
      }
    };
  }, [audioPlayer]);

  const toggleAudio = useCallback(() => {
    if (!selectedMantra.audioUrl) return;
    if (audioStatus.playing) {
      audioPlayer.pause();
      setAudioWanted(false);
    } else {
      try {
        audioPlayer.play();
        setAudioWanted(true);
      } catch {
        // ignore
      }
    }
  }, [audioPlayer, audioStatus.playing, selectedMantra.audioUrl]);

  // If the user switches to a mantra without audio, clear the "wanted" flag
  // so the icon doesn't stay in "playing" state.
  useEffect(() => {
    if (!selectedMantra.audioUrl) setAudioWanted(false);
  }, [selectedMantra.audioUrl]);

  // ── Animations ────────────────────────────────────────────────────────
  const animatePop = useCallback(() => {
    popScale.stopAnimation();
    popScale.setValue(1);
    Animated.sequence([
      Animated.timing(popScale, {
        toValue: 1.08,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(popScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [popScale]);

  const animateMalaComplete = useCallback(() => {
    ringRotate.setValue(0);
    Animated.timing(ringRotate, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ringRotate]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleIncrement = useCallback(() => {
    animatePop();
    setCount((c) => {
      const next = c + 1;
      if (next >= target) {
        // Mala complete — celebrate, reset bead counter, bump mala count.
        Vibration.vibrate(
          Platform.OS === "ios" ? [0, 60, 50, 60, 50, 90] : [0, 120, 80, 160],
        );
        animateMalaComplete();
        setMalas((m) => m + 1);
        return 0;
      }
      Vibration.vibrate(12);
      return next;
    });
  }, [target, animatePop, animateMalaComplete]);

  // Keep the ref pointing at the latest handleIncrement so the audio-loop
  // effect can fire it without depending on its identity.
  useEffect(() => {
    handleIncrementRef.current = handleIncrement;
  }, [handleIncrement]);

  const handleUndo = useCallback(() => {
    setCount((c) => {
      if (c > 0) return c - 1;
      if (malas > 0) {
        setMalas((m) => m - 1);
        return target - 1;
      }
      return 0;
    });
  }, [malas, target]);

  const handleReset = useCallback(() => {
    const doReset = () => {
      setCount(0);
      setMalas(0);
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm("Reset jaap counter and completed malas to 0?")
      ) {
        doReset();
      }
      return;
    }
    Alert.alert(
      "Reset jaap?",
      "This will reset both the current count and the completed-mala counter to 0.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: doReset },
      ],
      { cancelable: true },
    );
  }, []);

  const openTargetModal = useCallback(() => {
    setTargetInput(String(target));
    setShowTargetModal(true);
  }, [target]);

  const applyTarget = useCallback(() => {
    const parsed = parseInt(targetInput, 10);
    if (!parsed || parsed < 2) {
      const msg = "Please enter a number of 2 or more.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Invalid target", msg);
      return;
    }
    if (parsed > 100000) {
      const msg = "Please enter a smaller number.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Too large", msg);
      return;
    }
    setTarget(parsed);
    setCount((c) => (c >= parsed ? 0 : c));
    setShowTargetModal(false);
  }, [targetInput]);

  // ── Ring geometry ─────────────────────────────────────────────────────
  const RING_SIZE = 280;
  const STROKE = 12;
  const RADIUS = (RING_SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(1, progressPct));

  const ringRotateInterp = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <ScreenContainer>
      <View style={{ flex: 1, paddingVertical: 8 }}>
        {/* ── Mantra picker ─────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          style={{ flexGrow: 0 }}
        >
          {mantras.map((m) => {
            const active = m.id === mantraId;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMantraId(m.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? theme.primary : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: active ? theme.primary : theme.saffron + "55",
                }}
              >
                <Text
                  style={{
                    color: active ? "#FFFFFF" : theme.primary,
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Mantra text card + Malas pill ─────────────────────── */}
        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "stretch",
            gap: 10,
          }}
        >
          {/* Mantra text — full text, wraps as needed, scrolls if huge */}
          <View
            style={{
              flex: 1,
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.saffron + "55",
              paddingVertical: 10,
              paddingHorizontal: 14,
              maxHeight: 110,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 2 }}
              style={{ flex: 1 }}
            >
              <Text
                style={{
                  color: theme.primary,
                  fontSize: 16,
                  lineHeight: 22,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {selectedMantra.text}
              </Text>
            </ScrollView>

            {/* Play / pause — only if this mantra has audio */}
            {selectedMantra.audioUrl ? (
              <Pressable
                onPress={toggleAudio}
                accessibilityRole="button"
                accessibilityLabel={
                  audioStatus.playing ? "Pause mantra audio" : "Play mantra audio"
                }
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: audioStatus.playing
                    ? theme.primary
                    : theme.saffron + "33",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                {audioStatus.playing ? (
                  <Pause color="#FFFFFF" size={18} />
                ) : (
                  <Play color={theme.primary} size={18} />
                )}
              </Pressable>
            ) : null}
          </View>

          {/* Completed-mala pill */}
          <View
            style={{
              backgroundColor: theme.saffron + "1A",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.saffron + "55",
              paddingHorizontal: 14,
              paddingVertical: 10,
              alignItems: "center",
              justifyContent: "center",
              minWidth: 70,
            }}
          >
            <Text
              style={{
                color: theme.accent,
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              Malas
            </Text>
            <Text
              style={{
                color: theme.primary,
                fontSize: 22,
                fontWeight: "800",
                marginTop: 2,
              }}
            >
              {malas}
            </Text>
          </View>
        </View>

        {/* ── Big tappable ring ──────────────────────────────────── */}
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Animated.View
            style={{
              width: RING_SIZE,
              height: RING_SIZE,
              transform: [{ scale: popScale }],
            }}
          >
            {/* Rotating SVG ring */}
            <Animated.View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                transform: [{ rotate: ringRotateInterp }],
              }}
              pointerEvents="none"
            >
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Defs>
                  <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={theme.saffron} stopOpacity={1} />
                    <Stop offset="1" stopColor={theme.primary} stopOpacity={1} />
                  </LinearGradient>
                </Defs>
                {/* Track */}
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  stroke={theme.saffron + "22"}
                  strokeWidth={STROKE}
                  fill="none"
                />
                {/* Progress arc — starts at top (12 o'clock) */}
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  stroke="url(#ringGrad)"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </Svg>
            </Animated.View>

            {/* Center tappable disc */}
            <Pressable
              onPress={handleIncrement}
              onLongPress={handleUndo}
              delayLongPress={400}
              android_ripple={{
                color: theme.saffron + "33",
                borderless: true,
                radius: RING_SIZE / 2 - STROKE,
              }}
              accessibilityRole="button"
              accessibilityLabel="Tap to count jaap, long-press to undo"
              style={{
                position: "absolute",
                top: STROKE + 8,
                left: STROKE + 8,
                right: STROKE + 8,
                bottom: STROKE + 8,
                borderRadius: (RING_SIZE - (STROKE + 8) * 2) / 2,
                backgroundColor: theme.cream,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 12,
                elevation: 4,
                borderWidth: 1,
                borderColor: theme.saffron + "33",
                paddingHorizontal: 12,
              }}
            >
              <Text
                style={{
                  color: theme.primary,
                  fontSize: 80,
                  fontWeight: "800",
                  lineHeight: 86,
                  letterSpacing: -1.5,
                }}
              >
                {count}
              </Text>
              <Text
                style={{
                  color: theme.accent,
                  fontSize: 14,
                  fontWeight: "600",
                  marginTop: 2,
                }}
              >
                of {target}
              </Text>
              <Text
                style={{
                  marginTop: 12,
                  color: theme.accent + "AA",
                  fontSize: 10,
                  fontWeight: "600",
                  letterSpacing: 1,
                }}
              >
                TAP • LONG-PRESS TO UNDO
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* ── Action buttons ───────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <ActionButton
            icon={<Undo2 color={theme.primary} size={18} />}
            label="Undo"
            onPress={handleUndo}
            color={theme.primary}
            bg="#FFFFFF"
            border={theme.primary + "55"}
          />
          <ActionButton
            icon={<Target color="#FFFFFF" size={18} />}
            label={`Target ${target}`}
            onPress={openTargetModal}
            color="#FFFFFF"
            bg={theme.primary}
            border={theme.primary}
          />
          <ActionButton
            icon={<RotateCcw color={theme.primary} size={18} />}
            label="Reset"
            onPress={handleReset}
            color={theme.primary}
            bg="#FFFFFF"
            border={theme.primary + "55"}
          />
        </View>
      </View>

      {/* ── Custom target modal ───────────────────────────────── */}
      <Modal
        visible={showTargetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTargetModal(false)}
      >
        <Pressable
          onPress={() => setShowTargetModal(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: theme.cream,
              borderRadius: 18,
              padding: 22,
              borderWidth: 1,
              borderColor: theme.saffron + "66",
            }}
          >
            <Text
              style={{
                color: theme.primary,
                fontSize: 18,
                fontWeight: "800",
                marginBottom: 4,
              }}
            >
              Set mala target
            </Text>
            <Text
              style={{
                color: theme.accent,
                fontSize: 12,
                fontWeight: "500",
                marginBottom: 14,
              }}
            >
              Standard Jain mala is 108 beads.
            </Text>

            {/* Quick presets */}
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              {[27, 54, 108, 1008].map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => setTargetInput(String(preset))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: theme.primary + "44",
                    backgroundColor:
                      targetInput === String(preset)
                        ? theme.primary + "22"
                        : "#FFFFFF",
                  }}
                >
                  <Text
                    style={{
                      color: theme.primary,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {preset}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={targetInput}
              onChangeText={setTargetInput}
              keyboardType="number-pad"
              placeholder="108"
              placeholderTextColor="#9CA3AF"
              style={{
                borderWidth: 1,
                borderColor: theme.primary + "55",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 18,
                fontWeight: "700",
                color: theme.primary,
                backgroundColor: "#FFFFFF",
              }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 18,
              }}
            >
              <Pressable
                onPress={() => setShowTargetModal(false)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: theme.accent, fontWeight: "700" }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={applyTarget}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: theme.primary,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Reusable action pill ──────────────────────────────────────────────────
function ActionButton({
  icon,
  label,
  onPress,
  color,
  bg,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon}
      <Text style={{ color, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

