import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { deploymentsAPI } from '@/api/deployments.api';
import { Loading } from '@/components/common/Loading';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DeployModal } from '@/components/DeployModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/common/ToastContext';
import {
  IconPlus,
  IconFolder,
  IconSearch,
  IconRocket,
  IconTrash,
  IconSettings,
  IconBrandGithub,
} from '@tabler/icons-react';
import type { Project } from '@/types';

const Projects: React.FC = () => {
  const { projects, loading, createProject, deleteProject } = useProjects();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.repo_url.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (name: string, repoUrl: string) => {
    setCreating(true);
    try {
      await createProject({ name, repo_url: repoUrl });
      toast('Project created!', 'success');
      setCreateModalOpen(false);
    } catch {
      toast('Failed to create project', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeploy = async (projectId: string) => {
    setDeployingId(projectId);
    try {
      await deploymentsAPI.create(projectId);
      toast('Deployment started! 🚀', 'success');
    } catch {
      toast('Failed to start deployment', 'error');
    } finally {
      setDeployingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteProject(confirmDelete.id);
      toast('Project deleted', 'success');
    } catch {
      toast('Failed to delete project', 'error');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  if (loading) return <Loading message="Loading projects…" />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} total</p>
        </div>
        <Button
          variant="primary"
          leftIcon={<IconPlus size={16} />}
          onClick={() => setCreateModalOpen(true)}
          id="projects-create-btn"
        >
          New Project
        </Button>
      </div>

      {/* Search */}
      {projects.length > 0 && (
        <div className="mb-4 max-w-sm">
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftAddon={<IconSearch size={15} />}
            id="projects-search"
          />
        </div>
      )}

      {/* List */}
      {projects.length === 0 ? (
        <EmptyState
          icon={<IconFolder size={32} />}
          title="No projects yet"
          description="Connect a GitHub repository to get started."
          action={
            <Button variant="primary" leftIcon={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
              Create Project
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch size={28} />}
          title={`No results for "${search}"`}
          description="Try a different search term."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-800 bg-gray-900/70 hover:bg-gray-900 transition-colors group"
            >
              {/* Icon */}
              <div className="p-2.5 rounded-lg bg-gray-800 text-gray-400 shrink-0">
                <IconFolder size={18} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link
                  to={`/projects/${project.id}`}
                  className="text-sm font-semibold text-gray-100 hover:text-brand-400 transition-colors"
                >
                  {project.name}
                </Link>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 truncate">
                  <IconBrandGithub size={11} />
                  <span className="truncate">{project.repo_url.replace('https://github.com/', '')}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<IconRocket size={13} />}
                  loading={deployingId === project.id}
                  onClick={() => handleDeploy(project.id)}
                >
                  Deploy
                </Button>
                <Link to={`/projects/${project.id}`}>
                  <Button size="sm" variant="secondary" leftIcon={<IconSettings size={13} />}>
                    Manage
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="danger"
                  leftIcon={<IconTrash size={13} />}
                  onClick={() => setConfirmDelete(project)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <DeployModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onDeploy={handleCreate}
        mode="create"
        loading={creating}
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title={`Delete "${confirmDelete?.name}"?`}
        message="All deployments and logs for this project will be permanently removed."
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
};

export default Projects;
