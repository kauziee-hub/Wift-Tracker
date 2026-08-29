'use client';

import type { ChartMetric } from '@/hooks/useChartMetricPreference';

interface ChartMetricToggleProps {
  metric: ChartMetric;
  onChange: (next: ChartMetric) => void;
  className?: string;
}

/**
 * Global-style control: switch between volume and estimated 1RM for shared chart slots.
 * Styling is compact so it fits next to section titles on mobile and desktop.
 */
export default function ChartMetricToggle({
  metric,
  onChange,
  className = ''
}: ChartMetricToggleProps) {
  return (
    <div
      className={`inline-flex rounded-lg border border-white/15 bg-white/5 p-0.5 ${className}`}
      role="group"
      aria-label="Chart metric"
    >
      <button
        type="button"
        onClick={() => onChange('volume')}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          metric === 'volume'
            ? 'bg-white/20 text-white shadow-sm'
            : 'text-white/60 hover:text-white'
        }`}
      >
        Volume
      </button>
      <button
        type="button"
        onClick={() => onChange('oneRm')}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          metric === 'oneRm'
            ? 'bg-white/20 text-white shadow-sm'
            : 'text-white/60 hover:text-white'
        }`}
      >
        1RM
      </button>
    </div>
  );
}
