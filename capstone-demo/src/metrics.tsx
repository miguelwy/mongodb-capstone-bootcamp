import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { api, type Health, type MetricCheck } from './api';

// Success metrics Trendify set for each RC (roleplay). Validated live against the cluster.
export const METRICS: { id: string; rc: 1 | 2 | 3; label: string; target: string }[] = [
  { id: 'rc1-fresh', rc: 1, label: 'Recs reflect the last click', target: '≤ 2 s' },
  { id: 'rc1-oos', rc: 1, label: 'Out-of-stock items recommended', target: '0' },
  { id: 'rc1-search', rc: 1, label: 'Semantic search response', target: '≤ 1 s' },
  { id: 'rc2-burst', rc: 2, label: '20 concurrent checkouts complete', target: '< 3 s' },
  { id: 'rc2-oversell', rc: 2, label: 'Orders vs. available stock', target: 'No oversell' },
  { id: 'rc2-spread', rc: 2, label: 'Peak load spread across shards', target: '≥ 2 shards' },
  { id: 'rc3-placement', rc: 3, label: 'Orders stored in their country’s zone', target: '100%' },
  { id: 'rc3-isolation', rc: 3, label: 'Regional query touches', target: '1 shard' },
  { id: 'rc3-rehome', rc: 3, label: 'Region change reflected', target: '≤ 2 s' },
];

interface Ctx {
  live: Health | null;
  results: Record<string, MetricCheck>;
  busy: Record<string, boolean>;
  run: (rc: 1 | 2 | 3 | 'all') => Promise<void>;
}

const MetricsContext = createContext<Ctx | null>(null);

export function MetricsProvider({ live, children }: { live: Health | null; children: ReactNode }) {
  const [results, setResults] = useState<Record<string, MetricCheck>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const run = useCallback(async (rc: 1 | 2 | 3 | 'all') => {
    const key = String(rc);
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const r = await api.metrics(rc);
      setResults((prev) => ({ ...prev, ...Object.fromEntries(r.checks.map((c) => [c.id, c])) }));
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  }, []);
  return <MetricsContext.Provider value={{ live, results, busy, run }}>{children}</MetricsContext.Provider>;
}

export function useMetrics() {
  const ctx = useContext(MetricsContext);
  if (!ctx) throw new Error('useMetrics outside MetricsProvider');
  return ctx;
}

export function formatValue(c: MetricCheck) {
  if (c.unit === 'ms') return c.value >= 1000 ? `${(c.value / 1000).toFixed(2)} s` : `${c.value} ms`;
  if (c.unit === '%') return `${c.value}%`;
  return `${c.value} ${c.unit}`;
}

export function MetricStatus({ id }: { id: string }) {
  const { results } = useMetrics();
  const c = results[id];
  if (!c) return <span className="metric__val metric__val--none">—</span>;
  return (
    <span className={`metric__val ${c.pass ? 'is-pass' : 'is-fail'}`} title={c.detail}>
      {c.pass ? '✓' : '✕'} {formatValue(c)}
    </span>
  );
}

export function MetricsCard({ rc }: { rc: 1 | 2 | 3 }) {
  const { live, busy, run } = useMetrics();
  const running = busy[String(rc)] || busy.all;
  return (
    <section className="card card--metrics" aria-labelledby={`metrics-${rc}`}>
      <div className="metrics__head">
        <h3 id={`metrics-${rc}`}>Trendify targets</h3>
        <button
          className="btn btn--primary btn--sm"
          disabled={!live || running}
          title={live ? 'Run the checks against the live cluster' : 'Needs the live cluster'}
          onClick={() => run(rc)}
        >
          {running ? 'Validating…' : 'Validate'}
        </button>
      </div>
      <ul className="metrics">
        {METRICS.filter((m) => m.rc === rc).map((m) => (
          <li key={m.id} className="metric">
            <span className="metric__label">{m.label}</span>
            <span className="metric__target">{m.target}</span>
            <MetricStatus id={m.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
