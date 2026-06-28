import React from 'react';
import type { Project } from '@/types';
import {
  IconBrandGithub,
  IconCalendar,
  IconId,
  IconExternalLink,
} from '@tabler/icons-react';

interface ProjectMetadataProps {
  project: Project;
}

const MetaRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({
  icon, label, children,
}) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-gray-500 shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <div className="text-sm text-gray-200">{children}</div>
    </div>
  </div>
);

export const ProjectMetadata: React.FC<ProjectMetadataProps> = ({ project }) => {
  const createdDate = new Date(project.created_at).toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="flex flex-col gap-4">
      <MetaRow icon={<IconId size={16} />} label="Project ID">
        <span className="font-mono text-xs text-gray-400">{project.id}</span>
      </MetaRow>
      <MetaRow icon={<IconBrandGithub size={16} />} label="Repository">
        <a
          href={project.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 transition-colors"
        >
          {project.repo_url}
          <IconExternalLink size={13} />
        </a>
      </MetaRow>
      <MetaRow icon={<IconCalendar size={16} />} label="Created">
        <span>{createdDate}</span>
      </MetaRow>
    </div>
  );
};
