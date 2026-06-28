import client from './client';
import type { Deployment } from '@/types';

export const deploymentsAPI = {
  list: (projectId: string) =>
    client.get<Deployment[]>(`/projects/${projectId}/deployments`),

  get: (deploymentId: string) =>
    client.get<Deployment>(`/deployments/${deploymentId}`),

  create: (projectId: string) =>
    client.post<Deployment>(`/projects/${projectId}/deployments`),

  stop: (deploymentId: string) =>
    client.post(`/deployments/${deploymentId}/stop`),

  delete: (deploymentId: string) =>
    client.delete(`/deployments/${deploymentId}`),
};
