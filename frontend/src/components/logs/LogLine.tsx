import React from 'react';
import type { LogLine as LogLineType } from '@/types';

interface LogLineProps {
  log: LogLineType;
  searchTerm?: string;
}

const getLineColor = (line: string): string => {
  const l = line.toLowerCase();
  if (/\b(error|err|failed|failure|fatal|exception|traceback)\b/.test(l))
    return 'text-red-400';
  if (/\b(warn|warning|deprecated)\b/.test(l))
    return 'text-amber-400';
  if (/\b(success|done|complete|ready|started|running|built)\b/.test(l))
    return 'text-green-400';
  if (/^\s*(step|---|\+|from|run|copy|env|expose|cmd)\b/i.test(l))
    return 'text-blue-400';
  return 'text-gray-300';
};

const highlight = (text: string, term: string): React.ReactNode => {
  if (!term) return text;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-amber-500/30 text-amber-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

export const LogLine: React.FC<LogLineProps> = ({ log, searchTerm }) => {
  const time = new Date(log.emitted_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const color = getLineColor(log.line);

  return (
    <div className="flex items-start gap-3 px-4 py-0.5 hover:bg-white/[0.03] group">
      {/* Sequence number */}
      <span className="text-gray-700 text-xs w-8 text-right shrink-0 select-none pt-px">
        {log.sequence}
      </span>
      {/* Timestamp */}
      <span className="text-gray-600 text-xs shrink-0 pt-px font-mono opacity-0 group-hover:opacity-100 transition-opacity">
        {time}
      </span>
      {/* Log content */}
      <span className={['font-mono text-xs leading-5 break-all whitespace-pre-wrap flex-1', color].join(' ')}>
        {highlight(log.line, searchTerm || '')}
      </span>
    </div>
  );
};
