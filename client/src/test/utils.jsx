import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

export const regularUser = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', role: 'user' };
export const adminUser = { id: 'u2', name: 'Grace Hopper', email: 'grace@example.com', role: 'admin' };

/**
 * Renders `ui` (or a full <Routes> tree) inside router, toast and auth providers.
 * auth: partial AuthContext value; defaults to a signed-in regular user.
 */
export function renderWithProviders(ui, { route = '/', auth = {} } = {}) {
  const value = {
    user: regularUser,
    initializing: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    ...auth,
  };
  return {
    auth: value,
    ...render(
      <AuthContext.Provider value={value}>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </ToastProvider>
      </AuthContext.Provider>,
    ),
  };
}

/** Convenience: render a single page at a path and add stub routes to observe navigation. */
export function renderPage(element, { path = '/page', stubs = {}, ...options } = {}) {
  return renderWithProviders(
    <Routes>
      <Route path={path} element={element} />
      {Object.entries(stubs).map(([p, text]) => (
        <Route key={p} path={p} element={<div>{text}</div>} />
      ))}
    </Routes>,
    { route: path, ...options },
  );
}
