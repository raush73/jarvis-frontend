"use client";

import { useEffect, useState } from "react";

/**
 * Jarvis Careers - debounce a rapidly-changing value (e.g. a search input)
 * so downstream filtering/fetching does not run on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
