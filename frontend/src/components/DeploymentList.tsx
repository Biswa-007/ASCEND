import React from 'react';
import type { Deployment } from '@/types';
import { DeploymentCard } from './DeploymentCard';
import { EmptyState } from '@/components/common/EmptyState';
import { IconTimeline } from '@tabler/icons-react';

interface DeploymentListProps {
  deployments: Deployment[];
  projectId: string;
  onStop?: (id: string) => void;
  maxItems?: number;
}

export const DeploymentList: React.FC<DeploymentListProps> = ({
  deployments,
  projectId,
  onStop,
  maxItems,
}) => {
  const sorted = [...deployments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const items = maxItems ? sorted.slice(0, maxItems) : sorted;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<IconTimeline size={28} />}
        title="No deployments yet"
        description="Click Deploy to start your first deployment."
        className="py-10"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((d) => (
        <DeploymentCard key={d.id} deployment={d} projectId={projectId} onStop={onStop} />
      ))}
    </div>
  );
};
