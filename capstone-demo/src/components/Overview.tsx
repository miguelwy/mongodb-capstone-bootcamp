import { useState } from 'react';
import { RCS } from '../data';
import type { Health } from '../api';
import { Leaf, RcBadge } from './Common';
import mongodbLogo from '../assets/mongodb-logo.svg';

const CHAINS = [
  { rc: 1 as const, before: 'Split search & recs, slow refresh', consequence: 'Lower engagement & AOV', why: 'Personalization is the differentiator' },
  { rc: 2 as const, before: 'Checkout latency in flash sales', consequence: 'Cart abandonment', why: 'Next Black Friday' },
  { rc: 3 as const, before: 'Fragmented inventory, multi-region & GDPR strain', consequence: 'Missed sales, compliance burden', why: 'Europe expansion' },
];

const RUN = [
  { t: '0–10', label: 'Context & RCs' },
  { t: '10–18', label: 'Search', rc: 1 },
  { t: '18–26', label: 'Checkout', rc: 2 },
  { t: '26–33', label: 'Europe', rc: 3 },
  { t: '33–40', label: 'Recap & next steps' },
];

const PAGES = ['Context', 'Proposed RCs', 'Demo environment'] as const;

// What was prepared in Atlas for each RC. Kept short: the presenter explains the rest.
const ENV = [
  { rc: 1 as const, title: 'Search & recommendations', items: ['products · 8 synthetic items', 'Voyage embeddings', 'Atlas Search + Vector Search indexes'] },
  { rc: 2 as const, title: 'Flash-sale checkout', items: ['orders sharded on { location, customerId }', '3-node replica set per shard', 'Order + inventory in one transaction'] },
  { rc: 3 as const, title: 'Europe data placement', items: ['Global Cluster · 2 zones', 'Location mappings · US/CA → NA, DE/FR → EU', 'Placement read back via explain()'] },
];

export default function Overview({ live, onStart }: { live: Health | null; onStart: () => void }) {
  const [page, setPage] = useState(0);

  return (
    <div className="overview">
      <div className="pager" role="tablist" aria-label="Overview pages">
        {PAGES.map((p, i) => (
          <button
            key={p}
            role="tab"
            aria-selected={page === i}
            className={`pager__btn ${page === i ? 'is-on' : ''}`}
            onClick={() => setPage(i)}
          >
            <span className="pager__num">{i + 1}</span>
            {p}
          </button>
        ))}
      </div>

      {page === 0 ? (
        <div key="ctx" className="fade-in">
          <section className="hero hero--compact">
            <div className="hero__inner">
              <img className="hero__logo" src={mongodbLogo} alt="MongoDB" />
              <h1>
                Trendify 3.0 <span className="hero__bar">|</span> Technical Feasibility Workshop
              </h1>
              <p className="hero__sub">Three capabilities to validate before the next Black Friday.</p>
              <div className="hero__strips">
                <ul className="facts" aria-label="Company and initiative">
                  <li>DTC fashion</li>
                  <li>AWS</li>
                  <li>North America → Europe</li>
                  <li>Millions of daily transactions</li>
                </ul>
                <div className="stack" aria-label="Current technology (scenario)">
                  <span className="stack__label">Today</span>
                  <span className="stack__item">Monolith → microservices</span>
                  <span className="stack__item">PostgreSQL/RDS + Redis</span>
                  <span className="stack__item">Elasticsearch</span>
                  <span className="stack__item">TensorFlow</span>
                  <span className="stack__item">ERP inventory</span>
                </div>
              </div>
            </div>
          </section>

          <section className="section section--tight">
            <div className="chains">
              <div className="chains__cols" aria-hidden>
                <span>Before</span>
                <span>Consequence</span>
                <span>Why now</span>
              </div>
              {CHAINS.map((c) => (
                <div className="chain" key={c.rc}>
                  <div className="chain__cell chain__before">
                    <RcBadge n={c.rc} active={false} />
                    <span>{c.before}</span>
                  </div>
                  <span className="chain__arrow" aria-hidden>→</span>
                  <div className="chain__cell chain__cons">{c.consequence}</div>
                  <span className="chain__arrow" aria-hidden>→</span>
                  <div className="chain__cell chain__why">{c.why}</div>
                </div>
              ))}
            </div>
            <div className="page-foot">
              <p className="cross">
                <span className="tag">Cross-cutting</span> Release velocity: demand outpaces delivery
              </p>
              <button className="btn btn--primary" onClick={() => setPage(1)}>
                Proposed RCs →
              </button>
            </div>
          </section>
        </div>
      ) : page === 1 ? (
        <div key="rcs" className="fade-in">
          <section className="section section--first">
            <div className="section__head">
              <h2>Proposed Required Capabilities</h2>
              <span className="tag tag--hypothesis">Hypotheses · metrics TBD</span>
            </div>
            <div className="rc-grid">
              {RCS.map((r) => (
                <article className="rc-card" key={r.n}>
                  <div className="rc-card__top">
                    <span className="rc-card__num">{r.n}</span>
                    <h3>{r.short}</h3>
                  </div>
                  <p className="rc-card__stmt">{r.statement}</p>
                  <div className="rc-card__cap">
                    <h4>
                      <Leaf size={13} /> Evaluate
                    </h4>
                    <p>{r.capability}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="section section--foot">
            <ol className="runshow" aria-label="Run of show, 40 minutes">
              {RUN.map((r) => (
                <li key={r.t} className="runshow__item" style={{ flexGrow: parseInt(r.t.split('–')[1]) - parseInt(r.t) }}>
                  <span className="runshow__t">{r.t}′</span>
                  <span className="runshow__l">
                    {r.rc && <RcBadge n={r.rc as 1 | 2 | 3} active={false} />} {r.label}
                  </span>
                </li>
              ))}
            </ol>
            <button className="btn btn--primary" onClick={() => setPage(2)}>
              Demo environment →
            </button>
          </section>
        </div>
      ) : (
        <div key="env" className="fade-in">
          <section className="section section--first">
            <div className="section__head">
              <h2>Demo environment</h2>
              {live ? (
                <span className="tag tag--live">Live Atlas cluster</span>
              ) : (
                <span className="tag tag--hypothesis">Cluster offline · browser simulation</span>
              )}
            </div>
            <div className="rc-grid">
              {ENV.map((e) => (
                <article className="rc-card env-card" key={e.rc}>
                  <div className="rc-card__top">
                    <span className="rc-card__num">{e.rc}</span>
                    <h3>{e.title}</h3>
                  </div>
                  <ul className="env-list">
                    {e.items.map((it) => (
                      <li key={it}>
                        <Leaf size={13} /> {it}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="env-strip" aria-label="Cluster">
            <div className="env-strip__zones">
              {(live?.topology ?? [
                { shard: 'shard-0', zone: 'Zone 1', region: 'us-east-1' },
                { shard: 'shard-1', zone: 'Zone 2', region: 'eu-west-1' },
              ]).map((t, i) => (
                <div className="env-zone" key={t.shard}>
                  <span className="env-zone__label">{i === 0 ? 'North America' : 'Europe'}</span>
                  <strong>
                    {t.zone} · {t.region}
                  </strong>
                  <span className="muted small">Shard {i} · replica set</span>
                </div>
              ))}
            </div>
            <p className="env-strip__note">
              {live?.version ? `MongoDB ${live.version} · ` : ''}synthetic data · sized to demonstrate the patterns, not
              Trendify's workload
            </p>
          </section>

          <div className="cta-row">
            <button className="btn btn--primary" onClick={onStart}>
              Start → Discover
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
