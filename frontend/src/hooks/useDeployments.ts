import { useState, useEffect, useCallback } from 'react';
import { deploymentsAPI } from '@/api/deployments.api';
import type { Deployment } from '@/types';

export const useDeployments = (projectId: string) => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeployments = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await deploymentsAPI.list(projectId);
      setDeployments(res.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load deployments';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  const createDeployment = useCallback(async () => {
    const res = await deploymentsAPI.create(projectId);
    setDeployments((prev) => [res.data, ...prev]);
    return res.data;
  }, [projectId]);

  const stopDeployment = useCallback(async (deploymentId: string) => {
    await deploymentsAPI.stop(deploymentId);
    setDeployments((prev) =>
      prev.map((d) => (d.id === deploymentId ? { ...d, status: 'stopped' as const } : d))
    );
  }, []);

  const deleteDeployment = useCallback(async (deploymentId: string) => {
    await deploymentsAPI.delete(deploymentId);
    setDeployments((prev) => prev.filter((d) => d.id !== deploymentId));
  }, []);

  const refreshDeployment = useCallback(async (deploymentId: string) => {
    const res = await deploymentsAPI.get(deploymentId);
    setDeployments((prev) =>
      prev.map((d) => (d.id === deploymentId ? res.data : d))
    );
    return res.data;
  }, []);

  return {
    deployments,
    loading,
    error,
    fetchDeployments,
    createDeployment,
    stopDeployment,
    deleteDeployment,
    refreshDeployment,
  };
};
