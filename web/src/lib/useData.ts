import { useCallback, useEffect, useState } from 'react';
import { backend } from './backend';
import type { Data } from './types';
import { toast } from '../components/ui';

export type Run = (fn: () => Promise<void>, optimistic?: (d: Data) => Data) => Promise<void>;

export function useData(active: boolean) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await backend.load());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    reload();
    let t: number | undefined;
    const soon = () => { clearTimeout(t); t = window.setTimeout(reload, 300); };
    const unsub = backend.subscribe(soon, (s) => setData((d) => (d ? { ...d, settings: s } : d)));
    const onVis = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVis);
    const iv = window.setInterval(reload, 60_000);
    return () => {
      unsub();
      clearTimeout(t);
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, reload]);

  const run: Run = useCallback(
    async (fn, optimistic) => {
      if (optimistic) setData((d) => d && optimistic(d));
      try {
        await fn();
      } catch (e) {
        toast((e as Error).message, 'error');
      }
      await reload();
    },
    [reload],
  );

  return { data, error, run, reload };
}

/** Re-render every `ms` so "5 min ago" labels stay fresh. */
export function useTick(ms = 15_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}
