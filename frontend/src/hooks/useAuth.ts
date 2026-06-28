import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '@/api/auth.api';
import type { User } from '@/types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    // Validate token by fetching /auth/me
    authAPI.me()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user_email');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authAPI.login(email, password);
    localStorage.setItem('token', res.data.access_token);
    localStorage.setItem('user_email', email);
    setUser({ email });
    return res.data;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await authAPI.register(email, password);
    localStorage.setItem('token', res.data.access_token);
    localStorage.setItem('user_email', email);
    setUser({ email });
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_email');
    setUser(null);
    window.location.href = '/login';
  }, []);

  return {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };
};
