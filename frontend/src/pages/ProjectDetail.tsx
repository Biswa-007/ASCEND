import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsAPI } from '@/api/projects.api';
import { deploymentsAPI } from '@/api/deployments.api';
import { useDeployments } from '@/hooks/useDeployments';
import { usePoll } from '@/hooks/usePoll';
import { ProjectMetadata } from '@/components/ProjectMetadata';
import { ProjectForm } from '@/components/ProjectForm';
import { DeploymentList } from '@/components/DeploymentList';
import { Loading } from '@/components/common/Loading';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/common/ToastContext';
import {
  IconRocket,
  IconChevronLeft,
  IconTrash,
  IconEdit,
  IconX,
} from '@tabler/icons-react';
import type { Project, Deployment } from '@/types';

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const { deployments, fetchDeployments, stopDeployment } = useDeployments(projectId!);

  // Load project
  useEffect(() => {
    if (!projectId) return;
    projectsAPI.get(projectId)
      .then((r) => setProject(r.data))
      .catch(() => navigate('/404'))
      .finally(() => setProjectLoading(false));
  }, [projectId, navigate]);

  // Poll deployment statuses every 5s
  const pollFn = React.useCallback(async () => {
    if (!projectId) return null;
    const res = await deploymentsAPI.list(projectId);
    return res.data;
  }, [projectId]);

  usePoll(pollFn, 5000);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  const latestDeployment: Deployment | undefined = [...deployments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  const handleDeploy = async () => {
    if (!projectId) return;
    setDeploying(true);
    try {
      await deploymentsAPI.create(projectId);
      await fetchDeployments();
      toast('Deployment started! 🚀', 'success');
    } catch {
      toast('Failed to start deployment', 'error');
    } finally {
      setDeploying(false);
    }
  };

  const handleSave = async (name: string, repoUrl: string) => {
    if (!projectId) return;
    setSaving(true);
    try {
      const res = await projectsAPI.update(projectId, { name, repo_url: repoUrl });
      setProject(res.data);
      setEditMode(false);
      toast('Project updated', 'success');
    } catch {
      toast('Failed to update project', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    setDeleting(true);
    try {
      await projectsAPI.delete(projectId);
      toast('Project deleted', 'success');
      navigate('/projects');
    } catch {
      toast('Failed to delete project', 'error');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (projectLoading) return <Loading message="Loading project…" />;
  if (!project) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/projects" className="hover:text-gray-300 transition-colors flex items-center gap-1">
          <IconChevronLeft size={15} />
          Projects
        </Link>
        <span>/</span>
        <span className="text-gray-300 font-medium">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-100">{project.name}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            leftIcon={<IconRocket size={15} />}
            loading={deploying}
            onClick={handleDeploy}
            id="project-detail-deploy-btn"
          >
            Deploy
          </Button>
          <Button
            variant="ghost"
            leftIcon={<IconEdit size={15} />}
            onClick={() => setEditMode((v) => !v)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            leftIcon={<IconTrash size={15} />}
            onClick={() => setConfirmDelete(true)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: project info + settings */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Project Info */}
          <Card header={<span className="text-sm font-semibold text-gray-300">Project Info</span>}>
            <ProjectMetadata project={project} />
          </Card>

          {/* Settings: edit form */}
          <Card header={
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-gray-300">Settings</span>
              {editMode && (
                <button onClick={() => setEditMode(false)} className="text-gray-500 hover:text-gray-300">
                  <IconX size={15} />
                </button>
              )}
            </div>
          }>
            {editMode ? (
              <ProjectForm
                initialName={project.name}
                initialRepoUrl={project.repo_url}
                onSubmit={handleSave}
                onCancel={() => setEditMode(false)}
                submitLabel="Save Changes"
                loading={saving}
              />
            ) : (
              <div className="text-sm text-gray-500">
                Click <strong className="text-gray-400">Edit</strong> to rename this project or change the repository URL.
              </div>
            )}
          </Card>

          {/* Danger zone */}
          <Card className="border-red-900/30">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
              <p className="text-xs text-gray-500">
                Permanently delete this project and all its deployments.
              </p>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<IconTrash size={14} />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete Project
              </Button>
            </div>
          </Card>
        </div>

        {/* Right: deployments */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Latest deployment highlight */}
          {latestDeployment && (
            <Card header={<span className="text-sm font-semibold text-gray-300">Latest Deployment</span>}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400 font-mono">{latestDeployment.id.slice(0, 12)}…</div>
                <Link
                  to={`/projects/${project.id}/deployments/${latestDeployment.id}`}
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  View logs →
                </Link>
              </div>
            </Card>
          )}

          {/* History */}
          <Card header={<span className="text-sm font-semibold text-gray-300">Deployment History</span>}>
            <DeploymentList
              deployments={deployments.slice(0, 10)}
              projectId={project.id}
              onStop={stopDeployment}
            />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={`Delete "${project.name}"?`}
        message="All deployments and logs will be permanently removed."
        confirmLabel="Delete Project"
        loading={deleting}
      />
    </div>
  );
};

export default ProjectDetail;
