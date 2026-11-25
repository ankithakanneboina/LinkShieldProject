import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '../api/client';

/**
 * Runs `fetcher` on mount and whenever `deps` change. Keeps the previous data while reloading so tables
 * and charts do not flash empty, and ignores responses from superseded requests.
 */
export function useApi(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (id === requestId.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (id === requestId.current) setState((s) => ({ data: s.data, error: toApiError(e), loading: false }));
    }
  }, []);

  useEffect(() => {
    if (enabled) run();
    return () => {
      requestId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  return { ...state, reload: run };
}
