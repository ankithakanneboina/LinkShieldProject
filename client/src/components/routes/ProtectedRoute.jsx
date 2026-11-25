import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FullPageSpinner } from '../ui/Spinner';

/** Signed-in users only. Waits for the silent refresh before deciding, so a reload never flashes the login page. */
export function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Admins only. The API enforces the same rule; this keeps non-admins out of the UI. */
export function AdminRoute() {
  const { user, initializing } = useAuth();
  if (initializing) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Login and register pages: send signed-in users to the dashboard. */
export function GuestRoute() {
  const { user, initializing } = useAuth();
  if (initializing) return <FullPageSpinner />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
