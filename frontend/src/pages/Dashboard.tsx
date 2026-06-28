import React, { useState, useCallback } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { usePoll } from '@/hooks/usePoll';
import { deploymentsAPI } from '@/api/deployments.api';
import { ProjectCard } from '@/components/ProjectCard';
import { DeployModal } from '@/components/DeployModal';
import { Loading } from '@/components/common/Loading';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/ToastContext';
import { Button } from '@/components/ui/Button';
import { useAuthContext } from '@/context/AuthContext';
import { IconPlus, IconRocket } from '@tabler/icons-react';
import type { Deployment } from '@/types';

const Dashboard: React.FC = () => {
  const { user } = useAuthContext();
  const { projects, loading, createProject, deleteProject } = useProjects();
  const { toast } = useToast();

  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [latestDeployments, setLatestDeployments] = useState<Record<string, Deployment>>({});

  // Poll latest deployment for each project every 5s
  const pollFn = useCallback(async () => {
    if (projects.length === 0) return null;
    const results = await Promise.allSettled(
      projects.map((p) =>
        deploymentsAPI.list(p.id).then((r) => ({ projectId: p.id, deployment: r.data[0] ?? null }))
      )
    );
    const map: Record<string, Deployment> = {};
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value.deployment) {
        map[r.value.projectId] = r.value.deployment;
      }
    });
    setLatestDeployments(map);
    return map;
  }, [projects]);

  usePoll(pollFn, 5000, projects.length > 0);

  const handleCreateAndDeploy = async (name: string, repoUrl: string) => {
    setDeploying(true);
    try {
      const project = await createProject({ name, repo_url: repoUrl });
      // Trigger initial deployment
      await deploymentsAPI.create(project.id);
      toast('Project created and deployment started! 🚀', 'success');
      setDeployModalOpen(false);
    } catch {
      toast('Failed to create project. Try again.', 'error');
    } finally {
      setDeploying(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteProject(confirmDelete);
      toast('Project deleted', 'success');
    } catch {
      toast('Failed to delete project', 'error');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  // Quick deploy for existing project
  const handleQuickDeploy = async (projectId: string) => {
    try {
      await deploymentsAPI.create(projectId);
      toast('Deployment started! 🚀', 'success');
    } catch {
      toast('Failed to start deployment', 'error');
    }
  };

  if (loading) return <Loading message="Loading projects…" />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}! 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length === 0
              ? 'Create your first project to get started'
              : `${projects.length} project${projects.length === 1 ? '' : 's'} in your workspace`}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<IconPlus size={16} />}
          onClick={() => setDeployModalOpen(true)}
          id="create-project-btn"
        >
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <EmptyState
          icon={<IconRocket size={32} />}
          title="No projects yet"
          description="Create your first project by connecting a GitHub repository. Ascend will build and deploy it automatically."
          action={
            <Button
              variant="primary"
              leftIcon={<IconPlus size={16} />}
              onClick={() => setDeployModalOpen(true)}
            >
              Create Project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              latestDeployment={latestDeployments[project.id]}
              onDeploy={() => handleQuickDeploy(project.id)}
              onDelete={() => setConfirmDelete(project.id)}
            />
          ))}
        </div>
      )}

      {/* Create + Deploy Modal */}
      <DeployModal
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        onDeploy={handleCreateAndDeploy}
        mode="create"
        loading={deploying}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteProject}
        title="Delete project?"
        message="This will permanently delete the project and all its deployments. This action cannot be undone."
        confirmLabel="Delete Project"
        loading={deleting}
      />
    </div>
  );
};

export default Dashboard;
