import type { Order, Region } from '../data';
import type { Health } from '../api';
import { DemoHeader, Leaf, ProductThumb, ProveCards } from './Common';
import { MetricsCard } from '../metrics';

interface Props {
  live: Health | null;
  busy: boolean;
  error: string | null;
  order: Order | null;
  region: Region | null;
  onRegion: (r: Region) => void;
  onBack: () => void;
  onRecap: () => void;
}

const REGION_LABEL: Record<Region, string> = { na: 'North America', eu: 'Europe' };

export default function EuropeDemo({ live, busy, error, order, region, onRegion, onBack, onRecap }: Props) {
  const zone = region === 'eu' ? 'EU zone' : region === 'na' ? 'NA zone' : null;
  // Live: label each side with the real zone + cloud region; place the order badge where explain() found it.
  const liveZone = (r: Region) => live?.topology.find((t) => (r === 'eu' ? t.region.startsWith('eu') : !t.region.startsWith('eu')));
  const placement = order?.live?.placement;
  const storedIn: Region | null = placement ? (placement.region.startsWith('eu') ? 'eu' : 'na') : region;

  return (
    <div className="demo">
      <DemoHeader rc={3} title="Europe data placement" />


      <div className="demo-grid demo-grid--europe">
        <section className="panel" aria-labelledby="map-h">
          <div className="panel__head">
            <h2 id="map-h">Regional view</h2>
            {live ? <span className="tag tag--live">Live zones</span> : <span className="tag">Schematic</span>}
          </div>

          <div className="regions" role="radiogroup" aria-label="Shopper region">
            {(['na', 'eu'] as Region[]).map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={region === r}
                className={`region region--${r} ${region === r ? 'is-on' : ''} ${region && region !== r ? 'is-dim' : ''}`}
                onClick={() => onRegion(r)}
              >
                <span className="region__name">{REGION_LABEL[r]}</span>
                <span className="region__sub">{r === 'na' ? 'Today' : 'Expansion'}</span>
                <span className="region__stack">
                  <span className="region__tier">Shopper</span>
                  <span className={`region__flow ${region === r ? 'is-on' : ''}`} aria-hidden />
                  <span className="region__tier">App tier</span>
                  <span className={`region__flow ${region === r ? 'is-on' : ''}`} aria-hidden />
                  <span className="region__tier region__tier--data">
                    {liveZone(r) ? `${liveZone(r)!.zone} · ${liveZone(r)!.region}` : r === 'na' ? 'NA zone' : 'EU zone'}
                  </span>
                </span>
                {order && storedIn === r && !busy && (
                  <span className="region__doc">
                    <ProductThumb product={order.product} size={28} /> Order {order.id}
                  </span>
                )}
              </button>
            ))}
            <div className="regions__gap" aria-hidden>
              <span>cross-region?</span>
            </div>
          </div>

          <div className="legend">
            <span>
              <span className="legend__line" aria-hidden /> Local access
            </span>
            <span>
              <span className="legend__line legend__line--dash" aria-hidden /> Cross-region — rules TBD
            </span>
            <strong>{live ? 'Placement read from the cluster' : 'Conceptual placement only'}</strong>
          </div>
        </section>

        <div className="side">
          <section className="panel" aria-labelledby="doc-h">
            <h2 id="doc-h" className="panel__title">
              Order record
            </h2>
            {!order && (
              <div className="callout callout--info">
                No order yet.{' '}
                <button className="link" onClick={onBack}>
                  Place one in Checkout
                </button>
              </div>
            )}
            <pre className="doc" aria-label="Example order document">
{`{
  "orderId": "${order?.id ?? 'DEMO-0000'}",
  "item": "${order?.product.name ?? '—'}",
  "location": ${order?.live ? `"${order.live.location}"` : region ? `"${region === 'eu' ? 'DE' : 'US'}"` : '/* select a region */'},
  "status": "${order ? 'placed' : 'draft'}"
}`}
            </pre>
            {error && <div className="callout callout--warn">Move failed: {error}</div>}
            <p className="small" aria-live="polite">
              {busy ? (
                <span className="muted">Updating location — Atlas moves the document to the matching zone…</span>
              ) : placement ? (
                <>
                  Stored on <strong className="hl">{placement.zone} · {placement.region}</strong>{' '}
                  <span className="muted">({placement.shard}, via explain)</span>
                </>
              ) : region ? (
                <>
                  <code>location</code> → <strong className="hl">{zone}</strong> <span className="muted">(conceptual)</span>
                </>
              ) : (
                <span className="muted">Select a region.</span>
              )}
            </p>
          </section>

          <section className="panel ref" aria-labelledby="gc-h">
            <div className="panel__head">
              <h2 id="gc-h" className="panel__title panel__title--leaf">
                <Leaf size={18} /> Atlas Global Clusters
              </h2>
              <span className="tag tag--hypothesis">To evaluate</span>
            </div>
            <p className="small">Location-aware zones keep chosen data and writes in-region. Not a pre-approved architecture.</p>
          </section>
        </div>
      </div>

      <div className="prove-grid">
        <ProveCards
          demonstrates={['Order tagged with a region', 'In-region reads & writes via zones', 'One journey, end to end']}
        />
        <MetricsCard rc={3} />
      </div>

      <div className="cta-row">
        <button className="btn btn--primary" onClick={onRecap}>
          Close &amp; recap →
        </button>
      </div>
    </div>
  );
}
