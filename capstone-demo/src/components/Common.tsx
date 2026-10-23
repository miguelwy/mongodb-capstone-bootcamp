import ProductArt from './ProductArt';
import mongodbLeaf from '../assets/mongodb-logomark.svg';
import { NOTES, RCS, type Notes, type Product, type TabId } from '../data';

export function RcBadge({ n, active = true }: { n: 1 | 2 | 3; active?: boolean }) {
  return <span className={`rc-badge ${active ? 'is-active' : ''}`}>RC {n}</span>;
}

// MongoDB logomark, used as the marker for "MongoDB capability" and "live Atlas" labels.
export function Leaf({ size = 14 }: { size?: number }) {
  return <img className="leaf" src={mongodbLeaf} alt="" aria-hidden height={size} width={(size * 133) / 284} />;
}

export function DemoHeader({ rc, title }: { rc: 1 | 2 | 3; title: string }) {
  const r = RCS[rc - 1];
  return (
    <header className="demo-header">
      <div className="demo-header__meta">
        <RcBadge n={rc} />
        <span className="tag tag--hypothesis">Proposed RC</span>
      </div>
      <h1>{title}</h1>
      <p className="demo-header__rc">{r.statement}</p>
    </header>
  );
}

export function ProveCards({ demonstrates }: { demonstrates: string[] }) {
  return (
    <section className="card card--demo prove-single" aria-labelledby="demo-h">
      <h3 id="demo-h">
        <span className="dot dot--green" aria-hidden /> What this demonstrates
      </h3>
      <ul className="chips">
        {demonstrates.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </section>
  );
}

export function ProductThumb({ product, size = 56 }: { product: Product; size?: number }) {
  return <ProductArt product={product} size={size} />;
}

export function NotesPanel({ stage, onClose }: { stage: TabId | 'recap'; onClose: () => void }) {
  const n: Notes = NOTES[stage];
  return (
    <aside className="notes" aria-label="Presenter notes">
      <div className="notes__head">
        <strong>Presenter notes</strong>
        <span className="notes__time">{n.time}</span>
        <button className="btn btn--ghost btn--sm notes__close" onClick={onClose} aria-label="Hide presenter notes">
          Hide
        </button>
      </div>
      <dl className="notes__body">
        <div>
          <dt>Say</dt>
          <dd>“{n.open}”</dd>
        </div>
        <div>
          <dt>Screen action</dt>
          <dd>{n.action}</dd>
        </div>
        <div>
          <dt>Discovery prompts</dt>
          <dd>
            <ul>
              {n.prompts.map((p) => (
                <li key={p}>“{p}”</li>
              ))}
            </ul>
            <span className="muted small">Ask, leave a short beat, continue.</span>
          </dd>
        </div>
        {n.close && (
          <div>
            <dt>Close</dt>
            <dd>“{n.close}”</dd>
          </div>
        )}
        <div>
          <dt>Transition</dt>
          <dd>{n.transition}</dd>
        </div>
        <div className="notes__proof">
          <dt>Shows / does not prove</dt>
          <dd>
            <span className="ok">✓ {n.proves}</span>
            <span className="no">✕ {n.doesNotProve}</span>
          </dd>
        </div>
      </dl>
    </aside>
  );
}
