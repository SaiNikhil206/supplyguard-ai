import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import type { Role } from '@/api/types';
import { useAuth } from './AuthProvider';

export interface ProtectedRouteProps {
  roles?: Role[];
  children?: ReactNode;
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { status, hasRole } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-muted">
        <Spinner label="Loading session" />
      </div>
    );
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && !hasRole(...roles)) {
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg text-center text-text">
        <h1 className="text-xl font-semibold">You do not have access</h1>
        <p className="text-sm text-muted">Your role does not permit viewing this page.</p>
      </div>
    );
  }
  return <>{children ?? <Outlet />}</>;
}
