import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

/** Normalised error thrown by every API call (shape from docs/API.md "Error format"). */
export class ApiError extends Error {
  constructor({ status = 0, code = 'INTERNAL_ERROR', message = 'Something went wrong.', details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toApiError(error) {
  if (error instanceof ApiError) return error;
  const body = error?.response?.data?.error;
  if (body && typeof body === 'object') {
    return new ApiError({
      status: error.response.status,
      code: body.code,
      message: body.message,
      details: body.details,
    });
  }
  if (error?.code === 'ECONNABORTED') {
    return new ApiError({ status: 0, code: 'TIMEOUT', message: 'The server took too long to respond. Try again.' });
  }
  if (!error?.response) {
    return new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: "Can't reach the LinkShield server. Check your connection and try again.",
    });
  }
  return new ApiError({
    status: error.response.status,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong on our side. Try again in a moment.',
  });
}

// The access token lives only in memory. The refresh token is an httpOnly cookie the browser sends by itself.
let accessToken = null;
let onAuthFailure = null;

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setAuthFailureHandler = (fn) => {
  onAuthFailure = fn;
};

export const http = axios.create({ baseURL, withCredentials: true, timeout: 20000 });
// A second instance without interceptors, so the refresh call can never trigger another refresh.
const bare = axios.create({ baseURL, withCredentials: true, timeout: 20000 });

let refreshPromise = null;

/**
 * Exchanges the refresh cookie for a new access token. Single-flight: concurrent callers (React StrictMode,
 * parallel requests that all expired) share one request, because the server rotates the refresh token and
 * treats reuse of an old one as theft.
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = bare
      .post('/auth/refresh')
      .then((res) => {
        accessToken = res.data.accessToken;
        return res.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

const AUTH_ROUTE_RE = /^\/auth\/(login|register|refresh)/;

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    // Error bodies of blob requests (PDF download) arrive as Blobs; decode them so the message survives.
    if (response?.data instanceof Blob && response.data.type.includes('json')) {
      try {
        response.data = JSON.parse(await response.data.text());
      } catch {
        /* keep the blob */
      }
    }

    const code = response?.data?.error?.code;
    const isAuthRoute = AUTH_ROUTE_RE.test(config?.url || '');

    if (response?.status === 401 && code === 'TOKEN_EXPIRED' && config && !config._retried && !isAuthRoute) {
      config._retried = true;
      try {
        await refreshSession();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return await http(config);
      } catch (retryError) {
        if (retryError?.status === 401 || retryError?.response?.status === 401) {
          accessToken = null;
          onAuthFailure?.();
        }
        throw toApiError(retryError);
      }
    }

    if (response?.status === 401 && code === 'UNAUTHORIZED' && !isAuthRoute) {
      accessToken = null;
      onAuthFailure?.();
    }
    throw toApiError(error);
  },
);
