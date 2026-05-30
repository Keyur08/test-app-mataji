import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pref:readerFontSize";

const MIN = 14;
const MAX = 32;
const STEP = 2;
const DEFAULT = 20;

/**
 * Persisted reader font size (with +/- bounded controls).
 * Designed for elderly users — defaults to 20pt, max 32pt.
 */
export function useReaderFontSize() {
  const [size, setSize] = useState(DEFAULT);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      const n = v ? parseInt(v, 10) : NaN;
      if (Number.isFinite(n)) setSize(Math.min(MAX, Math.max(MIN, n)));
    });
  }, []);

  const persist = useCallback((n: number) => {
    setSize(n);
    AsyncStorage.setItem(KEY, String(n)).catch(() => {});
  }, []);

  const increase = useCallback(
    () => persist(Math.min(MAX, size + STEP)),
    [size, persist]
  );
  const decrease = useCallback(
    () => persist(Math.max(MIN, size - STEP)),
    [size, persist]
  );

  return {
    size,
    increase,
    decrease,
    canIncrease: size < MAX,
    canDecrease: size > MIN,
  };
}
