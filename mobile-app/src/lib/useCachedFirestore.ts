import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  type Query,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import { readCachedValue, writeCache } from "./cache";

type CachedState<T> = {
  data: T | null;
  loading: boolean;
  fromCache: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function useCachedDoc<T>(
  collectionPath: string,
  docId: string | undefined,
  cacheKey: string
): CachedState<T> {
  const [state, setState] = useState<Omit<CachedState<T>, "refresh">>({
    data: null,
    loading: true,
    fromCache: false,
    error: null,
  });

  const fetchFresh = useCallback(async () => {
    if (!docId) {
      setState({ data: null, loading: false, fromCache: false, error: null });
      return;
    }
    try {
      const snap = await getDoc(doc(db, collectionPath, docId));
      if (!snap.exists()) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const fresh = { id: snap.id, ...snap.data() } as T;
      await writeCache(cacheKey, fresh);
      setState({ data: fresh, loading: false, fromCache: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error as Error }));
    }
  }, [collectionPath, docId, cacheKey]);

  useEffect(() => {
    let cancelled = false;
    if (!docId) {
      setState({ data: null, loading: false, fromCache: false, error: null });
      return;
    }
    (async () => {
      const cached = await readCachedValue<T>(cacheKey);
      if (!cancelled && cached) {
        setState({
          data: cached.value,
          loading: true,
          fromCache: true,
          error: null,
        });
      }
      if (!cancelled) await fetchFresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [docId, cacheKey, fetchFresh]);

  return { ...state, refresh: fetchFresh };
}

type CollectionOpts = {
  orderByField?: string;
  orderDir?: "asc" | "desc";
};

export function useCachedCollection<T>(
  collectionPath: string,
  cacheKey: string,
  opts: CollectionOpts = {}
): CachedState<T[]> {
  const { orderByField, orderDir = "asc" } = opts;
  const [state, setState] = useState<Omit<CachedState<T[]>, "refresh">>({
    data: null,
    loading: true,
    fromCache: false,
    error: null,
  });

  const fetchFresh = useCallback(async () => {
    try {
      let q: Query<DocumentData> = collection(db, collectionPath);
      if (orderByField) q = query(q, orderBy(orderByField, orderDir));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
      await writeCache(cacheKey, items);
      setState({ data: items, loading: false, fromCache: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error as Error }));
    }
  }, [collectionPath, cacheKey, orderByField, orderDir]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readCachedValue<T[]>(cacheKey);
      if (!cancelled && cached) {
        setState({
          data: cached.value,
          loading: true,
          fromCache: true,
          error: null,
        });
      }
      if (!cancelled) await fetchFresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, fetchFresh]);

  return { ...state, refresh: fetchFresh };
}
