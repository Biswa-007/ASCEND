import { useState, useEffect, useRef, useCallback } from 'react';
import { logsAPI } from '@/api/logs.api';
import type { LogLine } from '@/types';

export const useLogs = (deploymentId: string, enabled: boolean = true) => {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSeqRef = useRef<number>(0);

  const fetchLogs = useCallback(async () => {
    if (!deploymentId || !enabled) return;
    try {
      const res = await logsAPI.getLogsSince(deploymentId, lastSeqRef.current);
      if (res.data.length > 0) {
        setLogs((prev) => {
          const newLogs = [...prev, ...res.data];
          // Update lastSeq to the highest sequence number received
          const maxSeq = Math.max(...res.data.map((l) => l.sequence));
          lastSeqRef.current = maxSeq;
          return newLogs;
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch logs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [deploymentId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Reset on new deployment
    setLogs([]);
    lastSeqRef.current = 0;
    setLoading(true);

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [deploymentId, enabled, fetchLogs]);

  return { logs, loading, error };
};
