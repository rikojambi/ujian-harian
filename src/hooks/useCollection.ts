import { useCallback, useEffect, useState } from 'react';
import { db, type QueryOptions } from '@/services/db';

export function useCollection<T>(
  collection: string,
  options: QueryOptions = {},
  deps: unknown[] = []
): { data: T[]; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signature = JSON.stringify(options);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await db.list<T>(collection, JSON.parse(signature) as QueryOptions);
      setData(result);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, signature, ...deps]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
