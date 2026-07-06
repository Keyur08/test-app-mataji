import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  AppState,
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
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { ScreenContainer } from "../../components/ScreenContainer";
import { useTheme } from "../../src/lib/useBranding";
import { db } from "../../src/lib/firebase";
import { useDoc } from "../../src/lib/useFirestore";
import { useUserProfile } from "../../src/lib/useUserProfile";

// ─── Storage keys ──────────────────────────────────────────────────────────
const STORAGE_KEY_COUNT = "jaap:count"; // legacy single-counter key
const STORAGE_KEY_TARGET = "jaap:target"; // legacy single-target key
const STORAGE_KEY_MALAS = "jaap:malas"; // legacy single-counter key
const STORAGE_KEY_MANTRA = "jaap:mantra";
const STORAGE_KEY_MANTRAS_CACHE = "jaap:mantras_cache";
const STORAGE_KEY_COUNTS_BY_MANTRA = "jaap:counts_by_mantra";
const STORAGE_KEY_MALAS_BY_MANTRA = "jaap:malas_by_mantra";
const STORAGE_KEY_TARGETS_BY_MANTRA = "jaap:targets_by_mantra";

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
type CounterMap = Record<string, number>;

export default function JaapScreen() {
  const theme = useTheme();
  const { profile, status: profileStatus } = useUserProfile();

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
  const [countsByMantra, setCountsByMantra] = useState<CounterMap>({});
  const [malasByMantra, setMalasByMantra] = useState<CounterMap>({});
  const [targetsByMantra, setTargetsByMantra] = useState<CounterMap>({});
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
        const [c, t, m, mid, cMapRaw, mMapRaw, tMapRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_COUNT),
          AsyncStorage.getItem(STORAGE_KEY_TARGET),
          AsyncStorage.getItem(STORAGE_KEY_MALAS),
          AsyncStorage.getItem(STORAGE_KEY_MANTRA),
          AsyncStorage.getItem(STORAGE_KEY_COUNTS_BY_MANTRA),
          AsyncStorage.getItem(STORAGE_KEY_MALAS_BY_MANTRA),
          AsyncStorage.getItem(STORAGE_KEY_TARGETS_BY_MANTRA),
        ]);
        if (cancelled) return;
        if (mid) setMantraId(mid);

        const fallbackMantraId = mid || DEFAULT_MANTRAS[0].id;
        const nextCountsByMantra: CounterMap = {};
        const nextMalasByMantra: CounterMap = {};
        const nextTargetsByMantra: CounterMap = {};
        if (cMapRaw) {
          try {
            const parsed = JSON.parse(cMapRaw) as CounterMap;
            Object.entries(parsed || {}).forEach(([k, v]) => {
              const n = Number(v);
              if (k && Number.isFinite(n) && n >= 0) {
                nextCountsByMantra[k] = Math.floor(n);
              }
            });
          } catch {
            // ignore corrupt cache
          }
        }
        if (mMapRaw) {
          try {
            const parsed = JSON.parse(mMapRaw) as CounterMap;
            Object.entries(parsed || {}).forEach(([k, v]) => {
              const n = Number(v);
              if (k && Number.isFinite(n) && n >= 0) {
                nextMalasByMantra[k] = Math.floor(n);
              }
            });
          } catch {
            // ignore corrupt cache
          }
        }
        if (tMapRaw) {
          try {
            const parsed = JSON.parse(tMapRaw) as CounterMap;
            Object.entries(parsed || {}).forEach(([k, v]) => {
              const n = Number(v);
              if (k && Number.isFinite(n) && n >= 2 && n <= 100000) {
                nextTargetsByMantra[k] = Math.floor(n);
              }
            });
          } catch {
            // ignore corrupt cache
          }
        }

        // One-time migration from the old single-counter keys.
        if (Object.keys(nextCountsByMantra).length === 0 && c) {
          nextCountsByMantra[fallbackMantraId] = Math.max(0, parseInt(c, 10) || 0);
        }
        if (Object.keys(nextMalasByMantra).length === 0 && m) {
          nextMalasByMantra[fallbackMantraId] = Math.max(0, parseInt(m, 10) || 0);
        }
        if (Object.keys(nextTargetsByMantra).length === 0 && t) {
          const parsed = parseInt(t, 10);
          if (parsed >= 2 && parsed <= 100000) {
            nextTargetsByMantra[fallbackMantraId] = parsed;
          }
        }
        setCountsByMantra(nextCountsByMantra);
        setMalasByMantra(nextMalasByMantra);
        setTargetsByMantra(nextTargetsByMantra);
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
    AsyncStorage.setItem(
        STORAGE_KEY_COUNTS_BY_MANTRA,
        JSON.stringify(countsByMantra),
    ).catch(() => {});
  }, [countsByMantra, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
        STORAGE_KEY_MALAS_BY_MANTRA,
        JSON.stringify(malasByMantra),
    ).catch(() => {});
  }, [malasByMantra, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
        STORAGE_KEY_TARGETS_BY_MANTRA,
        JSON.stringify(targetsByMantra),
    ).catch(() => {});
  }, [targetsByMantra, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_MANTRA, mantraId).catch(() => {});
  }, [mantraId, loaded]);

  // ── Derived ───────────────────────────────────────────────────────────
  const target = Math.max(2, Math.floor(targetsByMantra[mantraId] ?? DEFAULT_TARGET));
  const count = countsByMantra[mantraId] ?? 0;
  const malas = malasByMantra[mantraId] ?? 0;
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

  // Use `audioWanted` (user intent) — NOT `audioStatus.playing` — as the
  // source of truth for the toggle. On native, `useAudioPlayerStatus` can
  // lag a frame or two behind a `play()`/`pause()` call, which on the web
  // build is essentially synchronous. Driving the toggle (and the button
  // UI) off intent makes the native experience match the web one: instant
  // icon/label flip, no double-tap getting the wrong branch.
  const toggleAudio = useCallback(() => {
    if (!selectedMantra.audioUrl) return;
    setAudioWanted((wanted) => {
      try {
        if (wanted) {
          audioPlayer.pause();
        } else {
          // Re-seek to start so a fresh tap always begins the mantra
          // cleanly (otherwise on native it may resume from a stale
          // position after a long pause).
          try {
            audioPlayer.seekTo(0);
          } catch {
            // ignore
          }
          audioPlayer.play();
        }
      } catch {
        // ignore — player not ready
      }
      return !wanted;
    });
  }, [audioPlayer, selectedMantra.audioUrl]);

  // If the user switches to a mantra without audio, clear the "wanted" flag
  // so the icon doesn't stay in "playing" state.
  useEffect(() => {
    if (!selectedMantra.audioUrl) setAudioWanted(false);
  }, [selectedMantra.audioUrl]);

  const pendingJaapRef = useRef<{
    selectedMantraLabel: string;
    target: number;
    totalCount: number;
    totalMalas: number;
    byMantra: Record<string, { count: number; malas: number; target: number; label?: string }>;
  } | null>(null);
  const lastSyncedJaapHashRef = useRef<string>("");

  const buildJaapActivityPayload = useCallback(() => {
    const ids = Array.from(
        new Set([
          ...Object.keys(countsByMantra),
          ...Object.keys(malasByMantra),
          ...Object.keys(targetsByMantra),
          mantraId,
        ]),
    );
    const byMantra: Record<
        string,
        { count: number; malas: number; target: number; label?: string }
    > = {};
    for (const id of ids) {
      const mantraCount = Math.max(0, Number(countsByMantra[id]) || 0);
      const mantraMalas = Math.max(0, Number(malasByMantra[id]) || 0);
      const mantraTarget = Math.max(
          2,
          Math.floor(Number(targetsByMantra[id]) || DEFAULT_TARGET),
      );
      if (
          mantraCount <= 0 &&
          mantraMalas <= 0 &&
          mantraTarget === DEFAULT_TARGET &&
          id !== mantraId
      ) {
        continue;
      }
      const mantraMeta = mantras.find((m) => m.id === id);
      byMantra[id] = {
        count: mantraCount,
        malas: mantraMalas,
        target: mantraTarget,
        ...(mantraMeta?.label ? { label: mantraMeta.label } : {}),
      };
    }
    const totalCount = Object.values(countsByMantra).reduce(
        (sum, n) => sum + Math.max(0, Number(n) || 0),
        0,
    );
    const totalMalas = Object.values(malasByMantra).reduce(
        (sum, n) => sum + Math.max(0, Number(n) || 0),
        0,
    );
    return {
      selectedMantraLabel: selectedMantra.label,
      target,
      totalCount,
      totalMalas,
      byMantra,
    };
  }, [mantraId, target, mantras, countsByMantra, malasByMantra, targetsByMantra]);

  useEffect(() => {
    if (!loaded) return;
    pendingJaapRef.current = buildJaapActivityPayload();
  }, [loaded, buildJaapActivityPayload]);

  const flushJaapActivity = useCallback(
      (force = false) => {
        if (profileStatus !== "ready" || !profile?.mobile) return;
        const payload = pendingJaapRef.current;
        if (!payload) return;
        const hash = JSON.stringify(payload);
        if (!force && hash === lastSyncedJaapHashRef.current) return;
        lastSyncedJaapHashRef.current = hash;
        setDoc(
            doc(db, "users", profile.mobile),
            {
              jaapActivity: { ...payload, updatedAt: serverTimestamp() },
              updatedAt: serverTimestamp(),
            },
            { merge: true },
        ).catch((err: any) => {
          // eslint-disable-next-line no-console
          console.warn(
              "[jaap] failed to sync jaapActivity:",
              err?.code || err?.message || err,
          );
        });
      },
      [profileStatus, profile?.mobile],
  );

  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(() => flushJaapActivity(false), 15000);
    return () => clearInterval(id);
  }, [loaded, flushJaapActivity]);

  useEffect(() => {
    if (!loaded) return;
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") flushJaapActivity(true);
    });
    return () => sub.remove();
  }, [loaded, flushJaapActivity]);

  useEffect(
      () => () => {
        flushJaapActivity(true);
      },
      [flushJaapActivity],
  );

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
    setCountsByMantra((prev) => {
      const c = prev[mantraId] ?? 0;
      const next = c + 1;
      if (next >= target) {
        // Mala complete — celebrate, reset bead counter, bump mala count.
        Vibration.vibrate(
            Platform.OS === "ios" ? [0, 60, 50, 60, 50, 90] : [0, 120, 80, 160],
        );
        animateMalaComplete();
        setMalasByMantra((prevMalas) => ({
          ...prevMalas,
          [mantraId]: (prevMalas[mantraId] ?? 0) + 1,
        }));
        return { ...prev, [mantraId]: 0 };
      }
      Vibration.vibrate(12);
      return { ...prev, [mantraId]: next };
    });
  }, [mantraId, target, animatePop, animateMalaComplete]);

  // Keep the ref pointing at the latest handleIncrement so the audio-loop
  // effect can fire it without depending on its identity.
  useEffect(() => {
    handleIncrementRef.current = handleIncrement;
  }, [handleIncrement]);

  const handleUndo = useCallback(() => {
    setCountsByMantra((prev) => {
      const c = prev[mantraId] ?? 0;
      if (c > 0) return { ...prev, [mantraId]: c - 1 };
      const mantraMalas = malasByMantra[mantraId] ?? 0;
      if (mantraMalas > 0) {
        setMalasByMantra((prevMalas) => ({
          ...prevMalas,
          [mantraId]: Math.max(0, (prevMalas[mantraId] ?? 0) - 1),
        }));
        return { ...prev, [mantraId]: Math.max(0, target - 1) };
      }
      return prev;
    });
  }, [mantraId, malasByMantra, target]);

  const handleReset = useCallback(() => {
    const doReset = () => {
      setCountsByMantra((prev) => ({ ...prev, [mantraId]: 0 }));
      setMalasByMantra((prev) => ({ ...prev, [mantraId]: 0 }));
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
  }, [mantraId]);

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
    setTargetsByMantra((prev) => ({ ...prev, [mantraId]: parsed }));
    setCountsByMantra((prev) => {
      const c = prev[mantraId] ?? 0;
      if (c < parsed) return prev;
      return { ...prev, [mantraId]: 0 };
    });
    setShowTargetModal(false);
  }, [targetInput, mantraId]);

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
                  justifyContent: "center",
                }}
            >
              <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 2 }}
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

          {/* ── Audio control bar (only when current mantra has audio) ── */}
          {/* Single, guaranteed-readable color scheme for ALL states:
            cream/white pill + dark primary text + primary-tinted icon chip.
            Only the icon (play / pause / spinner) and the label text change
            — never the foreground color — so the label is always visible. */}
          {selectedMantra.audioUrl ? (() => {
            // Drive the icon/label off user intent (`audioWanted`) so it
            // flips instantly on tap — matching the web build. Only show
            // the spinner if the user wants playback AND the native
            // player hasn't actually started yet.
            const wantsPlay = audioWanted;
            const isLoading = wantsPlay && !audioStatus.playing;
            const label = isLoading
                ? "Loading…"
                : wantsPlay
                    ? "Pause Mantra"
                    : "Play Mantra";
            return (
                <Pressable
                    onPress={toggleAudio}
                    accessibilityRole="button"
                    accessibilityLabel={
                      wantsPlay
                          ? audioStatus.playing
                              ? "Pause mantra audio"
                              : "Loading mantra audio"
                          : "Play mantra audio"
                    }
                    style={({ pressed }) => ({
                      // Android needs more breathing room between the mantra
                      // text card above and this pill — on iOS/web 10 looks
                      // fine, but on Android the pill visually hugs the card.
                      marginTop: Platform.OS === "android" ? 22 : 10,
                      alignSelf: "stretch",
                      opacity: pressed ? 0.9 : 1,
                    })}
                >
                  {/* Inner row — Android reliably honors flexDirection on a
                  plain View, but can be flaky when applied directly to
                  Pressable. Keeping all layout here guarantees a single
                  horizontal pill across iOS / Android / Web. */}
                  <View
                      style={{
                        width: "100%",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 18,
                        borderRadius: 999,
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1.5,
                        borderColor: wantsPlay
                            ? theme.primary
                            : theme.saffron + "AA",
                        shadowColor: theme.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: wantsPlay ? 0.22 : 0.1,
                        shadowRadius: 6,
                        elevation: wantsPlay ? 3 : 2,
                      }}
                  >
                    {/* Circular icon chip */}
                    <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          marginRight: 12, // use marginRight instead of `gap` — `gap` support on RN Android is patchy in older RN
                          backgroundColor: wantsPlay
                              ? theme.primary
                              : theme.saffron + "33",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                    >
                      {isLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : wantsPlay ? (
                          <Pause
                              color="#FFFFFF"
                              size={18}
                              strokeWidth={2.5}
                              fill="#FFFFFF"
                          />
                      ) : (
                          <Play
                              color={theme.primary}
                              size={18}
                              strokeWidth={2.5}
                              fill={theme.primary}
                              style={{ marginLeft: 2 }}
                          />
                      )}
                    </View>
                    {/* Label — flexShrink so a long label can't wrap onto a new
                    row beneath the icon on Android. */}
                    <Text
                        numberOfLines={1}
                        style={{
                          flexShrink: 1,
                          color: theme.primary,
                          fontSize: 15,
                          fontWeight: "800",
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                        }}
                    >
                      {label}
                    </Text>
                  </View>
                  <View><Text  numberOfLines={2} style={{marginLeft:12}}> Counts on mantra completion || मंत्र पूरा होने पर काउंट होगा। </Text></View>
                </Pressable>

            );
          })() : null}


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
          <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 12,
                alignItems: "stretch",
                justifyContent: "center",
                alignSelf: "center",
                width: "100%",
                maxWidth: 360,
              }}
          >
            <SideActionButton
                icon={<Undo2 color={theme.primary} size={20} />}
                label="Undo"
                onPress={handleUndo}
                theme={theme}
            />
            <TargetActionButton
                target={target}
                onPress={openTargetModal}
                theme={theme}
            />
            <SideActionButton
                icon={<RotateCcw color={theme.primary} size={20} />}
                label="Reset"
                onPress={handleReset}
                theme={theme}
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
                {[9, 27, 54, 108, 1008].map((preset) => (
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

// ─── Themed action buttons ─────────────────────────────────────────────────
// Two tile styles that flank a hero "Target" pill. They lean on the saffron
// + primary palette so they feel like they belong with the prayer ring above.

type ThemeShape = {
  primary: string;
  saffron: string;
  cream: string;
  accent: string;
};

function SideActionButton({
                            icon,
                            label,
                            onPress,
                            theme,
                          }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  theme: ThemeShape;
}) {
  return (
      <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => ({
            width: 72,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 12,
            borderRadius: 18,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: theme.saffron + "55",
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: pressed ? 0.06 : 0.12,
            shadowRadius: 8,
            elevation: pressed ? 1 : 3,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
      >
        <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.saffron + "1F",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 6,
            }}
        >
          {icon}
        </View>
        <Text
            style={{
              color: theme.primary,
              fontWeight: "700",
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
        >
          {label}
        </Text>
      </Pressable>
  );
}

function TargetActionButton({
                              target,
                              onPress,
                              theme,
                            }: {
  target: number;
  onPress: () => void;
  theme: ThemeShape;
}) {
  return (
      <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Change target, currently ${target}`}
          style={({ pressed }) => ({
            flex: 1,
            borderRadius: 18,
            overflow: "hidden",
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: pressed ? 0.15 : 0.28,
            shadowRadius: 10,
            elevation: pressed ? 2 : 5,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
      >
        <View
            style={{
              borderRadius: 18,
              paddingVertical: 12,
              paddingHorizontal: 14,
              backgroundColor: theme.primary,
              borderWidth: 1,
              borderColor: theme.saffron + "88",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
        >
          <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.35)",
                alignItems: "center",
                justifyContent: "center",
              }}
          >
            <Target color="#FFFFFF" size={20} />
          </View>
          <View style={{ alignItems: "flex-start" }}>
            <Text
                style={{
                  color: "#FFFFFF",
                  opacity: 0.85,
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
            >
              Target
            </Text>
            <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 20,
                  fontWeight: "800",
                  marginTop: 1,
                  letterSpacing: -0.3,
                }}
            >
              {target}
              <Text style={{ fontSize: 12, fontWeight: "600", opacity: 0.8 }}>
                {"  beads"}
              </Text>
            </Text>
          </View>
        </View>
      </Pressable>
  );
}