import React from 'react';
import type { Deployment } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { IconServer, IconClock } from '@tabler/icons-react';

interface LogHeaderProps {
  deployment: Deployment;
}

const getElapsed = (d: Deployment): string => {
  if (!d.started_at) return '—';
  const end = d.finished_at ? new Date(d.finished_at) : new Date();
  const seconds = Math.floor((end.getTime() - new Date(d.started_at).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export const LogHeader: React.FC<LogHeaderProps> = ({ deployment: d }) => (
  <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/60">
    <StatusBadge status={d.status} size="md" />

    {d.port && (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
        <IconServer size={12} />
        <span>Port {d.port}</span>
      </div>
    )}

    {d.started_at && (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
        <IconClock size={12} />
        <span>
          {d.finished_at ? 'Completed in' : 'Elapsed:'} {getElapsed(d)}
        </span>
      </div>
    )}

    {d.image_tag && (
      <span className="text-xs text-gray-600 font-mono">
        {d.image_tag}
      </span>
    )}
  </div>
);
