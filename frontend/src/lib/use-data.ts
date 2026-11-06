"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

interface State<T> {
  path: string | null; // path the current data/error belongs to
  data: T | null;
  error: ApiError | Error | null;
}

/**
 * Fetches `path` from the API (client-side) and re-fetches when it changes.
 * While a new path loads, the previous data stays visible (`loading` is true).
 */
export function useData<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ path: null, data: null, error: null });

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api.get<T>(path).then(
      (data) => !cancelled && setState({ path, data, error: null }),
      (error: Error) => !cancelled && setState((s) => ({ path, data: s.data, error })),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);

  const setData = useCallback((next: T | null | ((d: T | null) => T | null)) => {
    setState((s) => ({ ...s, data: typeof next === "function" ? (next as (d: T | null) => T | null)(s.data) : next }));
  }, []);

  /** Re-fetches the current path; resolves when done. */
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const data = await api.get<T>(path);
      setState({ path, data, error: null });
    } catch (error) {
      setState((s) => ({ ...s, path, error: error as Error }));
    }
  }, [path]);

  return {
    data: state.data,
    setData,
    error: state.path === path ? state.error : null,
    loading: path !== null && state.path !== path,
    reload,
  };
}
