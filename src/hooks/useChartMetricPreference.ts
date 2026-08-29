'use client';

import { useCallback, useEffect, useState } from 'react';

/** Which series to plot where volume and estimated 1RM share the same chart slot. */
export type ChartMetric = 'volume' | 'oneRm';

const STORAGE_KEY = 'wift_exercise_chart_metric';

function readStoredMetric(): ChartMetric {
  if (typeof window === 'undefined') return 'volume';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'oneRm' || raw === 'volume') return raw;
  } catch {
    // ignore read errors (private mode, etc.)
  }
  return 'volume';
}

/**
 * Persists the user's volume vs 1RM chart choice so it survives reloads.
 * useEffect restores from localStorage after mount to avoid SSR hydration mismatches.
 */
export function useChartMetricPreference() {
  const [metric, setMetricState] = useState<ChartMetric>('volume');

  useEffect(() => {
    setMetricState(readStoredMetric());
  }, []);

  const setMetric = useCallback((next: ChartMetric) => {
    setMetricState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore write errors
    }
  }, []);

  return { metric, setMetric };
}
