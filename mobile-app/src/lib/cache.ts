import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tiny JSON wrapper around AsyncStorage with a versioned key prefix and an
 * optional `maxAgeMs` so callers can decide whether to use the cache.
 */
const PREFIX = "cache:v1:";

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PREFIX + key,
      JSON.stringify({ value, savedAt: Date.now() })
    );
  } catch {
    /* ignore quota / serialization errors */
  }
}

/**
 * Read cache and return the inner value if it's fresh enough (or always if
 * `maxAgeMs` is omitted). Always returns the raw saved timestamp for callers
 * that want to show "last updated" labels.
 */
export async function readCachedValue<T>(
  key: string,
  maxAgeMs?: number
): Promise<{ value: T; savedAt: number } | null> {
  const raw = await readCache<{ value: T; savedAt: number }>(key);
  if (!raw) return null;
  if (maxAgeMs && Date.now() - raw.savedAt > maxAgeMs) return null;
  return raw;
}
