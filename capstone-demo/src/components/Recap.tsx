import { RCS } from '../data';
import type { Journey } from '../App';
import { RcBadge } from './Common';
import { METRICS, MetricStatus, useMetrics } from '../metrics';

export default function Recap({ onReset, journey }: { onReset: () => void; journey: Journey }) {
  const { live, busy, run, results } = useMetrics();
  const passed = METRICS.filter((m) => results[m.id]?.pass).length;
  const measured = METRICS.filter((m) => results[m.id]).length;

  return (
    <div className="demo recap fade-in">
      <header className="demo-header">
        <div className="demo-header__meta">
          <span className="tag tag--hypothesis">Proposed · metrics TBD</span>
        </div>
        <h1>Recap &amp; next steps</h1>
        <p className="lede">
          {journey.product ? <strong>{journey.product.name}</strong> : 'Synthetic product'}
          {journey.order ? <> → {journey.order.id}</> : null}
          {journey.region ? <> → {journey.region === 'eu' ? 'Europe' : 'North America'}</> : null}
        </p>
      </header>

      <section className="connect" aria-label="Architecture connection (conceptual)">
        <span className="connect__label">How it connects · conceptual</span>
        <ol className="connect__flow">
          <li>
            <RcBadge n={1} /> Shopper events → session profile → vector recs
          </li>
          <li>
            <RcBadge n={2} /> Orders → sharded, replicated
          </li>
          <li>
            <RcBadge n={3} /> Regional data → zones
          </li>
        </ol>
        <span className="muted small">A hypothesis to test — not a decided architecture.</span>
      </section>

      <div className="recap-table" role="table" aria-label="RC recap">
        <div className="recap-row recap-row--head" role="row">
          <span role="columnheader">Proposed RC</span>
          <span role="columnheader">Consequence</span>
          <span role="columnheader" className="recap-row__targets-head">
            Targets
            {measured > 0 && (
              <span className="muted">
                {passed}/{METRICS.length} met
              </span>
            )}
            <button className="btn btn--primary btn--sm" disabled={!live || busy.all} onClick={() => run('all')}>
              {busy.all ? 'Validating…' : 'Validate all'}
            </button>
          </span>
        </div>
        {RCS.map((r) => (
          <div className="recap-row" role="row" key={r.n}>
            <span role="cell" className="recap-row__rc">
              <RcBadge n={r.n} /> {r.short}
            </span>
            <span role="cell">{r.consequence}</span>
            <span role="cell">
              <ul className="recap-metrics">
                {METRICS.filter((m) => m.rc === r.n).map((m) => (
                  <li key={m.id}>
                    <span>
                      {m.label} <span className="muted">{m.target}</span>
                    </span>
                    <MetricStatus id={m.id} />
                  </li>
                ))}
              </ul>
            </span>
          </div>
        ))}
      </div>

      <div className="cta-row">
        <button className="btn btn--outline" onClick={onReset}>
          Reset journey
        </button>
      </div>
    </div>
  );
}
