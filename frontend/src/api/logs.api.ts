import client from './client';
import type { LogLine } from '@/types';

export const logsAPI = {
  getLogsSince: (deploymentId: string, since: number = 0) =>
    client.get<LogLine[]>(`/deployments/${deploymentId}/logs`, {
      params: { since },
    }),
};
