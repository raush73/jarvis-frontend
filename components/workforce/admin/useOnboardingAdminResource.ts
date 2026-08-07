"use client";

/**
 * Phase 2 - the administrative read hook.
 *
 * One place where an administrative surface becomes a loading state, a refusal, or data. The
 * value of having exactly one is that every surface then refuses identically, reloads
 * identically, and - the part that matters - never renders stale data next to a fresh refusal:
 * a failed reload replaces the data with the refusal rather than leaving both on screen.
 *
 * It holds no cache. Administrative reads are audited server-side, and a cache would mean an
 * operator looking at a worker's material without a record of having looked.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type OnboardingAdminResource<T> = {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};

export function useOnboardingAdminResource<T>(
  load: () => Promise<T>,
  dependencies: readonly unknown[],
  options: { enabled?: boolean } = {},
): OnboardingAdminResource<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  // The loader closes over per-render values; keeping it in a ref lets the effect depend on
  // the caller's declared dependencies rather than on a function identity that changes every
  // render, without going stale.
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setLoading(true);
    loader
      .current()
      .then((value) => {
        if (!live) return;
        setData(value);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (!live) return;
        setData(null);
        setError(failure);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...dependencies]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, reload };
}
