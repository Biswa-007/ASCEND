import client from './client';
import type { AuthResponse, User } from '@/types';

export const authAPI = {
  register: (email: string, password: string) =>
    client.post<AuthResponse>('/auth/register', { email, password }),

  login: (email: string, password: string) =>
    client.post<AuthResponse>('/auth/login', { email, password }),

  me: () =>
    client.get<User>('/auth/me'),
};
