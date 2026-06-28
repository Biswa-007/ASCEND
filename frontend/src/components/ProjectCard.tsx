import React from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '@/types';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  IconBrandGithub,
  IconTrash,
  IconRocket,
  IconExternalLink,
  IconCalendar,
} from '@tabler/icons-react';
import type { Deployment } from '@/types';

interface ProjectCardProps {
  project: Project;
  latestDeployment?: Deployment | null;
  onDeploy: () => void;
  onDelete: () => void;
  deploying?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  latestDeployment,
  onDeploy,
  onDelete,
  deploying = false,
}) => {
  const createdDate = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card
      className="flex flex-col justify-between group shine-border"
      header={
        <div className="flex items-start justify-between gap-2 w-full">
          <Link
            to={`/projects/${project.id}`}
            className="text-base font-semibold text-gray-100 hover:text-brand-400 transition-colors line-clamp-1 group-hover:text-brand-300"
          >
            {project.name}
          </Link>
          {latestDeployment ? (
            <StatusBadge status={latestDeployment.status} />
          ) : (
            <span className="text-xs text-gray-600 font-medium shrink-0">No deployments</span>
          )}
        </div>
      }
    >
      {/* Repo URL */}
      <a
        href={project.repo_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-3 truncate"
      >
        <IconBrandGithub size={13} className="shrink-0" />
        <span className="truncate">{project.repo_url.replace('https://github.com/', '')}</span>
        <IconExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>

      {/* Port info */}
      {latestDeployment?.port && latestDeployment.status === 'running' && (
        <div className="flex items-center gap-1.5 text-xs text-green-500 mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Running on port {latestDeployment.port}</span>
        </div>
      )}

      {/* Created date */}
      <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-4">
        <IconCalendar size={12} />
        <span>{createdDate}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-800/60 mt-auto">
        <Button
          size="sm"
          variant="primary"
          leftIcon={<IconRocket size={13} />}
          onClick={onDeploy}
          loading={deploying}
          className="flex-1"
        >
          Deploy
        </Button>
        <Link to={`/projects/${project.id}`}>
          <Button size="sm" variant="secondary">
            View
          </Button>
        </Link>
        <Button
          size="sm"
          variant="danger"
          leftIcon={<IconTrash size={13} />}
          onClick={onDelete}
        />
      </div>
    </Card>
  );
};
