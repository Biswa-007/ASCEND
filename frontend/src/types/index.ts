// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  user_id: string;
  name: string;
  repo_url: string;
  created_at: string;
}

export interface CreateProjectPayload {
  name: string;
  repo_url: string;
}

export interface UpdateProjectPayload {
  name?: string;
  repo_url?: string;
}

// ─── Deployments ─────────────────────────────────────────────────────────────

export type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'running'
  | 'failed'
  | 'stopped';

export interface Deployment {
  id: string;
  project_id: string;
  status: DeploymentStatus;
  container_id: string | null;
  image_tag: string | null;
  port: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface DeploymentWithStatus extends Deployment {
  uptime?: string;
  url?: string;
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export interface LogLine {
  id: string;
  deployment_id: string;
  sequence: number;
  line: string;
  emitted_at: string;
}

// ─── Generic ─────────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
