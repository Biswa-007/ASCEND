import React from 'react';
import { Link } from 'react-router-dom';
import type { Deployment } from '@/types';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/Button';
import { IconClock, IconServer, IconPlayerStop, IconChevronRight } from '@tabler/icons-react';

interface DeploymentCardProps {
  deployment: Deployment;
  projectId: string;
  onStop?: (id: string) => void;
  compact?: boolean;
}

const formatTime = (isoString: string | null) => {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const getElapsed = (d: Deployment): string => {
  if (!d.started_at) return '—';
  const end = d.finished_at ? new Date(d.finished_at) : new Date();
  const seconds = Math.floor((end.getTime() - new Date(d.started_at).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export const DeploymentCard: React.FC<DeploymentCardProps> = ({
  deployment: d,
  projectId,
  onStop,
  compact = false,
}) => (
  <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-800 bg-gray-900/60 hover:bg-gray-900/90 transition-colors group">
    <StatusBadge status={d.status} />

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 text-sm text-gray-300 truncate">
        <span className="font-mono text-xs text-gray-500">{d.id.slice(0, 8)}…</span>
        {d.image_tag && (
          <span className="text-xs text-gray-600 truncate">{d.image_tag}</span>
        )}
      </div>
      {!compact && (
        <div className="flex items-center gap-4 mt-1">
          {d.port && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <IconServer size={11} />
              <span>:{d.port}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <IconClock size={11} />
            <span>{formatTime(d.created_at)}</span>
          </div>
          <div className="text-xs text-gray-600">
            ⏱ {getElapsed(d)}
          </div>
        </div>
      )}
    </div>

    <div className="flex items-center gap-2 shrink-0">
      {onStop && ['running', 'building', 'pending'].includes(d.status) && (
        <Button
          size="sm"
          variant="danger"
          leftIcon={<IconPlayerStop size={13} />}
          onClick={() => onStop(d.id)}
        >
          Stop
        </Button>
      )}
      <Link to={`/projects/${projectId}/deployments/${d.id}`}>
        <Button size="sm" variant="ghost" rightIcon={<IconChevronRight size={14} />}>
          {compact ? '' : 'View Logs'}
        </Button>
      </Link>
    </div>
  </div>
);
