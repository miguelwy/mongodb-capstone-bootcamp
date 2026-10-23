import { useEffect, useMemo, useState } from 'react';
import { api, type Health, type LiveHit } from '../api';
import { CATALOG, DEFAULT_QUERY, scoreProducts, type Product } from '../data';
import { DemoHeader, ProductThumb, ProveCards } from './Common';

const CATEGORIES = ['All', 'Shoes', 'Apparel', 'Bags', 'Accessories'] as const;

interface Props {
  live: Health | null;
  journeyProduct: Product | null;
  onAdd: (p: Product) => void;
  onNext: () => void;
}

export default function SearchDemo({ live, journeyProduct, onAdd, onNext }: Props) {
  const [draft, setDraft] = useState(DEFAULT_QUERY);
  const [query, setQuery] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(journeyProduct?.id ?? null);
  const [pathStep, setPathStep] = useState(-1);
  const [mode, setMode] = useState<'vector' | 'text'>(live?.vector === false ? 'text' : 'vector');
  const [liveRes, setLiveRes] = useState<{ engine: string; hits: LiveHit[] } | null>(null);
  const [liveStock, setLiveStock] = useState<Record<string, LiveHit['stock']>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live mode: every query / filter change runs a real Atlas Search or Vector Search query.
  useEffect(() => {
    if (!live || query === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .search(query || 'products', { category: category === 'All' ? undefined : category, inStock: inStockOnly, mode })
      .then((r) => {
        if (cancelled) return;
        setLiveRes({ engine: r.engine, hits: r.results });
        setLiveStock((m) => ({ ...m, ...Object.fromEntries(r.results.map((h) => [h.id, h.stock])) }));
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [live, query, category, inStockOnly, mode]);

  const withStock = (p: Product): Product => (liveStock[p.id] ? { ...p, stock: liveStock[p.id] } : p);

  const results = useMemo(() => {
    if (live && query !== null && liveRes) {
      return liveRes.hits.flatMap((h) => {
        const p = CATALOG.find((c) => c.id === h.id);
        return p ? [{ product: { ...p, stock: h.stock }, score: h.score }] : [];
      });
    }
    const scored = query === null ? CATALOG.map((p) => ({ product: p, score: 0 })) : scoreProducts(query);
    return scored.filter(
      ({ product, score }) =>
        (query === null || score > 0) &&
        (category === 'All' || product.category === category) &&
        (!inStockOnly || product.stock !== 'Out of stock'),
    );
  }, [live, liveRes, query, category, inStockOnly]);

  const found = CATALOG.find((p) => p.id === selectedId);
  const selected = found ? withStock(found) : null;
  const inJourney = !!selected && journeyProduct?.id === selected.id;

  const run = () => {
    setQuery(draft.trim());
    setPathStep(0);
    // Step through the conceptual path quickly to show order of operations.
    [1, 2, 3].forEach((s) => window.setTimeout(() => setPathStep(s), s * 220));
  };

  const PATH = ['Product & inventory signals', 'Operational data', 'Search / vector retrieval', 'Results'];

  return (
    <div className="demo">
      <DemoHeader rc={1} title="Search & recommendations" />

      <div className="demo-grid">
        <section className="panel" aria-labelledby="store-h">
          <div className="panel__head">
            <h2 id="store-h">Storefront · discover</h2>
            {live ? (
              <span className="tag tag--live">Live · {liveRes?.engine ?? (mode === 'vector' ? 'Atlas Vector Search' : 'Atlas Search')}</span>
            ) : (
              <span className="tag tag--synthetic">Synthetic catalog · illustrative matching</span>
            )}
          </div>
          <form
            className="searchbar"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <label htmlFor="q" className="sr-only">
              Natural-language product search
            </label>
            <input id="q" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Describe what you need…" />
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Searching…' : live && mode === 'text' ? 'Run keyword query' : 'Run semantic query'}
            </button>
          </form>
          {live && (
            <div className="seg seg--inline" role="radiogroup" aria-label="Search engine">
              {live.vector && (
                <button role="radio" aria-checked={mode === 'vector'} className={`seg__btn ${mode === 'vector' ? 'is-on' : ''}`} onClick={() => setMode('vector')}>
                  Semantic · Vector Search
                </button>
              )}
              <button role="radio" aria-checked={mode === 'text'} className={`seg__btn ${mode === 'text' ? 'is-on' : ''}`} onClick={() => setMode('text')}>
                Keyword · Atlas Search
              </button>
            </div>
          )}
          {error && <div className="callout callout--warn">Live query failed: {error}</div>}
          <div className="filters" role="group" aria-label="Filters">
            <div className="seg" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={category === c}
                  className={`seg__btn ${category === c ? 'is-on' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="switch">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              <span className="switch__track" aria-hidden />
              In stock only
            </label>
          </div>

          <div className="results-head" aria-live="polite">
            {query === null ? (
              <span className="muted">Full catalog</span>
            ) : (
              <span>
                {results.length} result{results.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <ul className="results">
            {results.map(({ product, score }) => (
              <li key={product.id}>
                <button
                  className={`result ${selectedId === product.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedId(product.id)}
                  aria-pressed={selectedId === product.id}
                >
                  <ProductThumb product={product} size={72} />
                  <span className="result__body">
                    <span className="result__name">{product.name}</span>
                    <span className="result__meta">
                      {product.category} · {product.color} · ${product.price}
                    </span>
                    <span className={`stock stock--${product.stock.split(' ')[0].toLowerCase()}`}>{product.stock}</span>
                  </span>
                  {query !== null && (
                    <span className="match" title="Illustrative match strength, not a relevance score">
                      <span className="match__bar" style={{ width: `${Math.round(score * 100)}%` }} />
                    </span>
                  )}
                  {journeyProduct?.id === product.id && <span className="pill pill--green">In journey</span>}
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="empty">No synthetic products match. Try clearing a filter.</li>}
          </ul>
        </section>

        <div className="side">
          <section className="panel detail" aria-labelledby="detail-h">
            <h2 id="detail-h" className="panel__title">
              Product detail
            </h2>
            {selected ? (
              <>
                <div className="detail__hero">
                  <ProductThumb product={selected} size={120} />
                  <div>
                    <h3>{selected.name}</h3>
                    <p className="muted">
                      {selected.category} · {selected.color}
                    </p>
                    <p className="price">${selected.price}</p>
                  </div>
                </div>
                <p>{selected.description}</p>
                <span className={`stock stock--${selected.stock.split(' ')[0].toLowerCase()}`}>{selected.stock}</span>
                <div className="detail__actions">
                  <button
                    className="btn btn--primary"
                    disabled={selected.stock === 'Out of stock' || inJourney}
                    onClick={() => onAdd(selected)}
                  >
                    {inJourney ? '✓ Added to shopper journey' : 'Add to shopper journey'}
                  </button>
                  {inJourney && (
                    <button className="btn btn--outline" onClick={onNext}>
                      Continue to checkout →
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="muted">Select a result to open it.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="path-h">
            <div className="panel__head">
              <h2 id="path-h" className="panel__title">
                Conceptual data path
              </h2>
              <span className="tag">Conceptual</span>
            </div>
            <ol className="path">
              {PATH.map((p, i) => (
                <li key={p} className={`path__node ${pathStep >= i ? 'is-lit' : ''}`}>
                  <span className="path__dot" aria-hidden />
                  {p}
                </li>
              ))}
            </ol>
            <p className="muted small">Not proof of indexing freshness.</p>
          </section>
        </div>
      </div>

      <ProveCards
        demonstrates={['Natural-language query + filters', 'Inventory-aware results', 'One retrieval path over operational data']}
      />
    </div>
  );
}
