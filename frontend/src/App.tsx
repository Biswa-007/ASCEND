import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import { ToastProvider } from '@/components/common/ToastContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Navbar } from '@/components/Navbar';
import { Loading } from '@/components/common/Loading';

// Lazy-loaded pages
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const DeploymentDetail = lazy(() => import('@/pages/DeploymentDetail'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// ─── Private Route Guard ──────────────────────────────────────────────────────
const PrivateRoute: React.FC = () => {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) return <Loading message="Authenticating…" fullScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

// ─── Public Route: redirect if already authenticated ─────────────────────────
const PublicRoute: React.FC = () => {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) return <Loading message="Authenticating…" fullScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
};

// ─── App ─────────────────────────────────────────────────────────────────────
const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <ErrorBoundary>
          <Suspense fallback={<Loading fullScreen />}>
            <Routes>
              {/* Public routes */}
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>

              {/* Private routes */}
              <Route element={<PrivateRoute />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:projectId" element={<ProjectDetail />} />
                <Route
                  path="/projects/:projectId/deployments/:deploymentId"
                  element={<DeploymentDetail />}
                />
              </Route>

              {/* 404 */}
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
