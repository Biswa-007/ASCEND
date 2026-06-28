import client from './client';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '@/types';

export const projectsAPI = {
  list: () =>
    client.get<Project[]>('/projects'),

  get: (id: string) =>
    client.get<Project>(`/projects/${id}`),

  create: (payload: CreateProjectPayload) =>
    client.post<Project>('/projects', payload),

  update: (id: string, payload: UpdateProjectPayload) =>
    client.patch<Project>(`/projects/${id}`, payload),

  delete: (id: string) =>
    client.delete(`/projects/${id}`),
};
