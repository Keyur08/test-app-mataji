import { useCallback, useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit as fbLimit,
  getDoc,
  getDocs,
  type Query,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

/**
 * Subscribe to a single Firestore document.
 *   const { data, loading, refresh } = useDoc<DailyBanner>("app_state", "today");
 */
export function useDoc<T>(
  collectionPath: string,
  docId: string | undefined
): State<T> {
  const [state, setState] = useState<Omit<State<T>, "refresh">>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!docId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const ref = doc(db, collectionPath, docId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setState({
          data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null,
          loading: false,
          error: null,
        });
      },
      (error) => setState({ data: null, loading: false, error })
    );
    return unsub;
  }, [collectionPath, docId]);

  const refresh = useCallback(async () => {
    if (!docId) return;
    try {
      const snap = await getDoc(doc(db, collectionPath, docId));
      setState({
        data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error as Error }));
    }
  }, [collectionPath, docId]);

  return { ...state, refresh };
}

type CollectionOpts = {
  orderByField?: string;
  orderDir?: "asc" | "desc";
  limit?: number;
};

/**
 * Subscribe to a Firestore collection (optionally ordered + limited).
 */
export function useCollection<T>(
  collectionPath: string,
  opts: CollectionOpts = {}
): State<T[]> {
  const { orderByField, orderDir = "desc", limit } = opts;
  const [state, setState] = useState<Omit<State<T[]>, "refresh">>({
    data: null,
    loading: true,
    error: null,
  });

  const buildQuery = useCallback((): Query<DocumentData> => {
    let q: Query<DocumentData> = collection(db, collectionPath);
    if (orderByField) q = query(q, orderBy(orderByField, orderDir));
    if (limit) q = query(q, fbLimit(limit));
    return q;
  }, [collectionPath, orderByField, orderDir, limit]);

  useEffect(() => {
    const unsub = onSnapshot(
      buildQuery(),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
        setState({ data: items, loading: false, error: null });
      },
      (error) => setState({ data: null, loading: false, error })
    );
    return unsub;
  }, [buildQuery]);

  const refresh = useCallback(async () => {
    try {
      const snap = await getDocs(buildQuery());
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
      setState({ data: items, loading: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error as Error }));
    }
  }, [buildQuery]);

  return { ...state, refresh };
}

