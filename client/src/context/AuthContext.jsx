import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api';
import { refreshSession, setAccessToken, setAuthFailureHandler } from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Silent refresh on load: if the httpOnly refresh cookie is still valid we get a fresh access token and user.
  useEffect(() => {
    let active = true;
    setAuthFailureHandler(() => setUser(null));
    refreshSession()
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => setAccessToken(null))
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    const data = await authApi.register({ name, email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* logout is idempotent; clear local state regardless */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, register, logout, setUser }),
    [user, initializing, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
