import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import type { Bhajan } from "../../../shared/types";

/**
 * Minimal shape required by the player. Any track from any collection
 * (bhajans, audio pravachans, …) can be queued as long as it provides
 * an id + audio URL.
 */
export type PlayableTrack = {
  id: string;
  title: string;
  audioUrl: string;
  /** Free-form line below the title — e.g. "Bhajan", speaker name, etc. */
  artist?: string;
  artworkUrl?: string;
  durationSec?: number;
};

/** Convert any Bhajan-shaped object into a PlayableTrack. */
export function bhajanToTrack(b: Bhajan): PlayableTrack {
  return {
    id: b.id,
    title: b.title,
    audioUrl: b.audioUrl,
    artist: b.artist,
    artworkUrl: b.artworkUrl,
    durationSec: b.durationSec,
  };
}

/**
 * Global audio player with queue + transport controls.
 *
 * - Wraps a single `expo-audio` AudioPlayer (created via `useAudioPlayer`)
 *   so the same instance powers the full-screen list, the mini-player, and
 *   the iOS/Android lock-screen controls.
 * - `setAudioModeAsync({ shouldPlayInBackground: true, ... })` is called once
 *   on mount so playback continues while the device is locked.
 * - `setActiveForLockScreen(true, metadata)` is called on every track change
 *   so the OS shows artwork + play/pause/skip on the lock screen and Control
 *   Center / notification.
 */

type PlayerContextValue = {
  queue: PlayableTrack[];
  current: PlayableTrack | null;
  isPlaying: boolean;
  isBuffering: boolean;
  position: number; // seconds
  duration: number; // seconds
  setQueueAndPlay: (queue: PlayableTrack[], startIndex: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (seconds: number) => void;
  stop: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<PlayableTrack[]>([]);
  const [index, setIndex] = useState<number>(-1);

  // expo-audio player; we feed it the current track via `player.replace(...)`.
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  // 1. One-time audio session config (background + silent-mode playback).
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix", // required for lock-screen controls
      shouldRouteThroughEarpiece: false,
    }).catch(() => {
      /* no-op on web / unsupported platforms */
    });
  }, []);

  const current = index >= 0 ? queue[index] ?? null : null;

  // 2. Whenever the current track changes, swap the source and update OS
  //    lock-screen metadata.
  const lastTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!current) {
      lastTrackIdRef.current = null;
      return;
    }
    if (lastTrackIdRef.current === current.id) return;
    lastTrackIdRef.current = current.id;

    try {
      player.replace({ uri: current.audioUrl });
      player.setActiveForLockScreen(true, {
        title: current.title,
        artist: current.artist ?? "Bhajan",
        artworkUrl: current.artworkUrl,
      });
      player.play();
    } catch {
      /* ignore — player not ready yet */
    }
  }, [current, player]);

  // 3. Auto-advance to the next track on completion.
  useEffect(() => {
    if (status.didJustFinish) {
      setIndex((i) => (i + 1 < queue.length ? i + 1 : -1));
    }
  }, [status.didJustFinish, queue.length]);

  const setQueueAndPlay = useCallback(
    (newQueue: PlayableTrack[], startIndex: number) => {
      setQueue(newQueue);
      setIndex(Math.max(0, Math.min(startIndex, newQueue.length - 1)));
    },
    []
  );

  const toggle = useCallback(() => {
    if (!current) return;
    if (status.playing) player.pause();
    else player.play();
  }, [current, status.playing, player]);

  const next = useCallback(() => {
    if (index < queue.length - 1) setIndex(index + 1);
  }, [index, queue.length]);

  const previous = useCallback(() => {
    // If we've played more than 3s, restart current track; else go back.
    if (status.currentTime > 3) {
      player.seekTo(0);
      return;
    }
    if (index > 0) setIndex(index - 1);
  }, [index, status.currentTime, player]);

  const seekTo = useCallback(
    (seconds: number) => {
      player.seekTo(seconds);
    },
    [player]
  );

  const stop = useCallback(() => {
    player.pause();
    setQueue([]);
    setIndex(-1);
  }, [player]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      current,
      isPlaying: status.playing,
      isBuffering: status.isBuffering,
      position: status.currentTime ?? 0,
      duration: status.duration ?? 0,
      setQueueAndPlay,
      toggle,
      next,
      previous,
      seekTo,
      stop,
    }),
    [
      queue,
      current,
      status.playing,
      status.isBuffering,
      status.currentTime,
      status.duration,
      setQueueAndPlay,
      toggle,
      next,
      previous,
      seekTo,
      stop,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function useAudio(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("useAudio must be used inside <AudioPlayerProvider>");
  }
  return ctx;
}
