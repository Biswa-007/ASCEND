import { useState, useEffect, useCallback } from 'react';
import { projectsAPI } from '@/api/projects.api';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '@/types';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await projectsAPI.list();
      setProjects(res.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (payload: CreateProjectPayload) => {
    const res = await projectsAPI.create(payload);
    setProjects((prev) => [res.data, ...prev]);
    return res.data;
  }, []);

  const updateProject = useCallback(async (id: string, payload: UpdateProjectPayload) => {
    const res = await projectsAPI.update(id, payload);
    setProjects((prev) => prev.map((p) => (p.id === id ? res.data : p)));
    return res.data;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await projectsAPI.delete(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  };
};
