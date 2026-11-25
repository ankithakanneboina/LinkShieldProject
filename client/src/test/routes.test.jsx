import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AdminRoute, GuestRoute, ProtectedRoute } from '../components/routes/ProtectedRoute';
import { adminUser, regularUser, renderWithProviders } from './utils';

const tree = (
  <Routes>
    <Route path="/login" element={<div>Login page</div>} />
    <Route path="/dashboard" element={<div>Dashboard page</div>} />
    <Route element={<GuestRoute />}>
      <Route path="/register" element={<div>Register page</div>} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route path="/history" element={<div>History page</div>} />
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<div>Admin page</div>} />
      </Route>
    </Route>
  </Routes>
);

describe('route guards', () => {
  it('sends signed-out visitors from protected pages to login', () => {
    renderWithProviders(tree, { route: '/history', auth: { user: null } });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('lets signed-in users reach protected pages', () => {
    renderWithProviders(tree, { route: '/history', auth: { user: regularUser } });
    expect(screen.getByText('History page')).toBeInTheDocument();
  });

  it('does not decide while the session is still being restored (no flash of the login page)', () => {
    renderWithProviders(tree, { route: '/history', auth: { user: null, initializing: true } });
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(screen.queryByText('History page')).not.toBeInTheDocument();
  });

  it('keeps normal users out of the admin area', () => {
    renderWithProviders(tree, { route: '/admin', auth: { user: regularUser } });
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument();
  });

  it('lets admins into the admin area', () => {
    renderWithProviders(tree, { route: '/admin', auth: { user: adminUser } });
    expect(screen.getByText('Admin page')).toBeInTheDocument();
  });

  it('sends signed-out visitors from /admin to login', () => {
    renderWithProviders(tree, { route: '/admin', auth: { user: null } });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('sends signed-in users away from login/register pages', () => {
    renderWithProviders(tree, { route: '/register', auth: { user: regularUser } });
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });
});
