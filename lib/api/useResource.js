"use client";

/**
 * Hooks de dados sobre o cliente da API (lib/api/client).
 *
 * useResource(fetcher, deps) — busca no mount e quando deps mudam; cancela a
 *   requisição anterior via AbortController. { data, loading, error, refetch }.
 * useMutation(mutateFn) — ação sob demanda (POST/PATCH/DELETE). { mutate, loading, error }.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { ApiError } from "./client";

/**
 * @param {(opts:{signal:AbortSignal}) => Promise<any>} fetcher
 * @param {any[]} deps  refaz o fetch quando qualquer dep muda
 */
export function useResource(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback((signal) => {
    setLoading(true);
    setError(null);
    return Promise.resolve()
      .then(() => fetcherRef.current({ signal }))
      .then((result) => {
        if (signal && signal.aborted) return;
        setData(result);
      })
      .catch((err) => {
        // Aborto não é erro de UI
        if (err && (err.name === "AbortError" || (signal && signal.aborted))) return;
        setError(err instanceof ApiError ? err : new ApiError(err?.message));
      })
      .finally(() => {
        if (signal && signal.aborted) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    run(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    return run(controller.signal);
  }, [run]);

  return { data, loading, error, refetch };
}

/**
 * @param {(...args:any[]) => Promise<any>} mutateFn
 * @returns {{ mutate: Function, loading: boolean, error: ApiError|null }}
 *   mutate(...args) executa, atualiza loading/error e RETORNA o resultado
 *   (relança o erro para quem chamou tratar sucesso/fluxo).
 */
export function useMutation(mutateFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fnRef = useRef(mutateFn);
  fnRef.current = mutateFn;

  const mutate = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err?.message);
      setError(apiErr);
      throw apiErr;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}
