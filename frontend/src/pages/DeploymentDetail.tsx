import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { deploymentsAPI } from '@/api/deployments.api';
import { LogsViewer } from '@/components/logs/LogsViewer';
import { StatusBadge } from '@/components/StatusBadge';
import { Loading } from '@/components/common/Loading';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/common/ToastContext';
import { usePoll } from '@/hooks/usePoll';
import {
  IconChevronLeft,
  IconPlayerStop,
  IconTrash,
  IconServer,
  IconClock,
  IconId,
  IconTag,
} from '@tabler/icons-react';
import type { Deployment } from '@/types';

const DeploymentDetail: React.FC = () => {
  const { projectId, deploymentId } = useParams<{ projectId: string; deploymentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!deploymentId) return;
    deploymentsAPI.get(deploymentId)
      .then((r) => setDeployment(r.data))
      .catch(() => navigate('/404'))
      .finally(() => setLoading(false));
  }, [deploymentId, navigate]);

  // Poll deployment status every 3s while active
  const isActive = deployment && ['pending', 'building', 'running'].includes(deployment.status);
  const pollFn = React.useCallback(async () => {
    if (!deploymentId) return null;
    const res = await deploymentsAPI.get(deploymentId);
    return res.data;
  }, [deploymentId]);

  const { data: polledDeployment } = usePoll(pollFn, 3000, !!isActive);
  useEffect(() => {
    if (polledDeployment) setDeployment(polledDeployment);
  }, [polledDeployment]);

  const handleStop = async () => {
    if (!deploymentId) return;
    setStopping(true);
    try {
      await deploymentsAPI.stop(deploymentId);
      setDeployment((d) => d ? { ...d, status: 'stopped' } : d);
      toast('Deployment stopped', 'success');
    } catch {
      toast('Failed to stop deployment', 'error');
    } finally {
      setStopping(false);
      setConfirmStop(false);
    }
  };

  const handleDelete = async () => {
    if (!deploymentId) return;
    setDeleting(true);
    try {
      await deploymentsAPI.delete(deploymentId);
      toast('Deployment deleted', 'success');
      navigate(`/projects/${projectId}`);
    } catch {
      toast('Failed to delete deployment', 'error');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : '—';

  if (loading) return <Loading message="Loading deployment…" />;
  if (!deployment) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/projects" className="hover:text-gray-300 transition-colors flex items-center gap-1">
          <IconChevronLeft size={15} />
          Projects
        </Link>
        <span>/</span>
        <Link to={`/projects/${projectId}`} className="hover:text-gray-300 transition-colors">
          Project
        </Link>
        <span>/</span>
        <span className="text-gray-300 font-mono text-xs">{deployment.id.slice(0, 12)}…</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-100">Deployment</h1>
          <StatusBadge status={deployment.status} size="md" />
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <Button
              variant="danger"
              leftIcon={<IconPlayerStop size={15} />}
              onClick={() => setConfirmStop(true)}
            >
              Stop
            </Button>
          )}
          <Button
            variant="ghost"
            leftIcon={<IconTrash size={15} />}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Metadata sidebar */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          {/* Info card */}
          <Card header={<span className="text-sm font-semibold text-gray-300">Details</span>}>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-start gap-2.5">
                <IconId size={14} className="text-gray-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">ID</p>
                  <p className="font-mono text-xs text-gray-300 break-all">{deployment.id}</p>
                </div>
              </div>

              {deployment.container_id && (
                <div className="flex items-start gap-2.5">
                  <IconServer size={14} className="text-gray-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600">Container</p>
                    <p className="font-mono text-xs text-gray-300 break-all">
                      {deployment.container_id.slice(0, 12)}
                    </p>
                  </div>
                </div>
              )}

              {deployment.port && (
                <div className="flex items-start gap-2.5">
                  <IconServer size={14} className="text-gray-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600">Port</p>
                    <p className="text-gray-300">{deployment.port}</p>
                  </div>
                </div>
              )}

              {deployment.image_tag && (
                <div className="flex items-start gap-2.5">
                  <IconTag size={14} className="text-gray-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600">Image</p>
                    <p className="font-mono text-xs text-gray-300 break-all">{deployment.image_tag}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <IconClock size={14} className="text-gray-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">Created</p>
                  <p className="text-xs text-gray-300">{formatDate(deployment.created_at)}</p>
                </div>
              </div>

              {deployment.started_at && (
                <div className="flex items-start gap-2.5">
                  <IconClock size={14} className="text-gray-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600">Started</p>
                    <p className="text-xs text-gray-300">{formatDate(deployment.started_at)}</p>
                  </div>
                </div>
              )}

              {deployment.finished_at && (
                <div className="flex items-start gap-2.5">
                  <IconClock size={14} className="text-gray-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600">Finished</p>
                    <p className="text-xs text-gray-300">{formatDate(deployment.finished_at)}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card header={<span className="text-sm font-semibold text-gray-300">Timeline</span>}>
            <div className="flex flex-col gap-2">
              {(['pending', 'building', 'running'] as const).map((step) => {
                const reached =
                  step === 'pending' ||
                  (step === 'building' && ['building', 'running', 'failed', 'stopped'].includes(deployment.status)) ||
                  (step === 'running' && deployment.status === 'running');
                const failed = step === 'running' && deployment.status === 'failed';
                return (
                  <div key={step} className="flex items-center gap-2.5">
                    <div
                      className={[
                        'h-2 w-2 rounded-full shrink-0',
                        failed ? 'bg-red-500' : reached ? 'bg-green-500' : 'bg-gray-700',
                      ].join(' ')}
                    />
                    <span
                      className={[
                        'text-xs capitalize',
                        reached ? 'text-gray-300' : 'text-gray-600',
                      ].join(' ')}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
              {deployment.status === 'failed' && (
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                  <span className="text-xs text-red-400">Failed</span>
                </div>
              )}
              {deployment.status === 'stopped' && (
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-slate-500 shrink-0" />
                  <span className="text-xs text-slate-400">Stopped</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Logs viewer */}
        <div className="xl:col-span-3" style={{ height: 'calc(100vh - 280px)', minHeight: 480 }}>
          <LogsViewer deployment={deployment} />
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmStop}
        onClose={() => setConfirmStop(false)}
        onConfirm={handleStop}
        title="Stop deployment?"
        message="The running container will be stopped. You can deploy again anytime."
        confirmLabel="Stop"
        loading={stopping}
      />
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete deployment?"
        message="Logs and all data for this deployment will be permanently removed."
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
};

export default DeploymentDetail;
