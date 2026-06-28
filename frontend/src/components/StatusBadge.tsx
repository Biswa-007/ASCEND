import React from 'react';
import type { DeploymentStatus } from '@/types';

interface StatusBadgeProps {
  status: DeploymentStatus;
  size?: 'sm' | 'md';
}

const config: Record<
  DeploymentStatus,
  { label: string; classes: string; dotClass: string; pulse: boolean }
> = {
  pending: {
    label: 'Pending',
    classes: 'bg-gray-800 text-gray-400 border-gray-700',
    dotClass: 'bg-gray-400',
    pulse: false,
  },
  building: {
    label: 'Building',
    classes: 'bg-amber-950/60 text-amber-400 border-amber-900/60',
    dotClass: 'bg-amber-400',
    pulse: true,
  },
  running: {
    label: 'Running',
    classes: 'bg-green-950/60 text-green-400 border-green-900/60',
    dotClass: 'bg-green-400',
    pulse: false,
  },
  failed: {
    label: 'Failed',
    classes: 'bg-red-950/60 text-red-400 border-red-900/60',
    dotClass: 'bg-red-400',
    pulse: false,
  },
  stopped: {
    label: 'Stopped',
    classes: 'bg-slate-800 text-slate-400 border-slate-700',
    dotClass: 'bg-slate-400',
    pulse: false,
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1.5',
  md: 'px-2.5 py-1 text-sm gap-2',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const c = config[status];
  return (
    <span
      className={[
        'inline-flex items-center font-medium rounded-full border',
        c.classes,
        sizeClasses[size],
      ].join(' ')}
    >
      <span className="relative flex shrink-0 h-1.5 w-1.5">
        {c.pulse && (
          <span
            className={[
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              c.dotClass,
            ].join(' ')}
          />
        )}
        <span className={['relative inline-flex rounded-full h-1.5 w-1.5', c.dotClass].join(' ')} />
      </span>
      {c.label}
    </span>
  );
};
