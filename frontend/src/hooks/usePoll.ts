import { useState, useEffect, useRef } from 'react';

export const usePoll = <T,>(
  fn: () => Promise<T>,
  interval: number = 3000,
  enabled: boolean = true
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);

  // Keep fnRef up to date without re-triggering the effect
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    const poll = async () => {
      setLoading(true);
      try {
        const result = await fnRef.current();
        if (active) setData(result);
      } catch (err: unknown) {
        if (active) {
          const message = err instanceof Error ? err.message : 'Polling error';
          setError(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    poll();
    const timer = setInterval(poll, interval);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [interval, enabled]);

  return { data, loading, error };
};
