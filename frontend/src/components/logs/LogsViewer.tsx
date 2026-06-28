import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Deployment, LogLine as LogLineType } from '@/types';
import { LogLine } from './LogLine';
import { LogSearch } from './LogSearch';
import { LogHeader } from './LogHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useLogs } from '@/hooks/useLogs';
import {
  IconDownload,
  IconArrowDown,
  IconPlayerPause,
  IconPlayerPlay,
} from '@tabler/icons-react';

interface LogsViewerProps {
  deployment: Deployment;
}

export const LogsViewer: React.FC<LogsViewerProps> = ({ deployment }) => {
  const isActive = ['pending', 'building', 'running'].includes(deployment.status);
  const { logs, loading } = useLogs(deployment.id, true);

  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter logs by search
  const filteredLogs = search
    ? logs.filter((l) => l.line.toLowerCase().includes(search.toLowerCase()))
    : logs;

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  // Detect manual scroll up → pause auto-scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  };

  // Download logs
  const downloadLogs = () => {
    const text = logs.map((l) => `[${l.sequence}] ${l.emitted_at} ${l.line}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${deployment.id.slice(0, 8)}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-gray-800 overflow-hidden bg-[#0d1117]">
      {/* Header */}
      <LogHeader deployment={deployment} />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900/40">
        <LogSearch
          value={search}
          onChange={setSearch}
          resultCount={search ? filteredLogs.length : undefined}
        />
        <div className="flex items-center gap-2 shrink-0">
          {isActive && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={autoScroll ? <IconPlayerPause size={13} /> : <IconPlayerPlay size={13} />}
              onClick={() => setAutoScroll((v) => !v)}
            >
              {autoScroll ? 'Pause' : 'Resume'}
            </Button>
          )}
          {!autoScroll && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<IconArrowDown size={13} />}
              onClick={scrollToBottom}
            >
              Jump to bottom
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<IconDownload size={13} />}
            onClick={downloadLogs}
            disabled={logs.length === 0}
          >
            Download
          </Button>
        </div>
      </div>

      {/* Log lines */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto log-viewer py-2"
        style={{ minHeight: 0 }}
      >
        {loading && logs.length === 0 && (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
            <Spinner size="sm" />
            <span className="text-sm">Waiting for logs…</span>
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
            No logs available yet.
          </div>
        )}

        {filteredLogs.map((log: LogLineType) => (
          <LogLine key={log.id} log={log} searchTerm={search} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 bg-gray-900/40 text-xs text-gray-600">
        <span>{logs.length} lines</span>
        {isActive && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        )}
      </div>
    </div>
  );
};
