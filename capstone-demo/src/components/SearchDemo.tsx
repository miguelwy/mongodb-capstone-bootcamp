import { useEffect, useMemo, useState } from 'react';
import { api, type Health, type LiveHit, type Recs } from '../api';
import { CATALOG, DEFAULT_QUERY, scoreProducts, type Product } from '../data';
import { DemoHeader, ProductThumb, ProveCards } from './Common';
import { MetricsCard } from '../metrics';

const CATEGORIES = ['All', 'Shoes', 'Apparel', 'Bags', 'Accessories'] as const;

interface Props {
  live: Health | null;
  sessionId: string;
  viewed: string[];
  onView: (id: string) => void;
  journeyProduct: Product | null;
  onAdd: (p: Product) => void;
  onNext: () => void;
}

// Offline stand-in for the live recommender: tag overlap with the last viewed items.
function localRecs(viewed: string[]): Product[] {
  const sellable = CATALOG.filter((p) => p.stock !== 'Out of stock' && !viewed.includes(p.id));
  if (viewed.length === 0) return sellable.slice(0, 3);
  const weights = new Map<string, number>();
  viewed.slice(-5).forEach((id, i) => {
    CATALOG.find((p) => p.id === id)?.tags.forEach((t) => weights.set(t, (weights.get(t) ?? 0) + 2 ** i));
  });
  const score = (p: Product) => p.tags.reduce((s, t) => s + (weights.get(t) ?? 0), 0);
  return [...sellable].sort((a, b) => score(b) - score(a)).slice(0, 3);
}

export default function SearchDemo({ live, sessionId, viewed, onView, journeyProduct, onAdd, onNext }: Props) {
  const [draft, setDraft] = useState(DEFAULT_QUERY);
  const [query, setQuery] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(journeyProduct?.id ?? null);
  const [mode, setMode] = useState<'vector' | 'text'>(live?.vector === false ? 'text' : 'vector');
  const [liveRes, setLiveRes] = useState<{ engine: string; hits: LiveHit[] } | null>(null);
  const [liveStock, setLiveStock] = useState<Record<string, LiveHit['stock']>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recs | null>(null);

  // Live: recommendations come from the session profile in Atlas. Re-fetched on mount so stock
  // changes made elsewhere (e.g. a flash sale) are reflected when the shopper comes back.
  useEffect(() => {
    if (!live) return;
    api.recs(sessionId).then(setRecs, () => setRecs(null));
  }, [live, sessionId]);

  const open = (id: string) => {
    setSelectedId(id);
    onView(id);
    if (live) api.view(sessionId, id).then(setRecs, () => {});
  };

  const recItems: Product[] = live
    ? (recs?.results ?? []).flatMap((h) => {
        const p = CATALOG.find((c) => c.id === h.id);
        return p ? [{ ...p, stock: h.stock }] : [];
      })
    : localRecs(viewed);
  const basedOn = (live ? recs?.basedOn ?? [] : viewed.slice(-5).reverse())
    .map((id) => CATALOG.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];

  // Live mode: nothing is filtered in the browser. Without a query the catalog comes from a
  // MongoDB find() with the filters; with a query, from Atlas Search or Vector Search.
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const filters = { category: category === 'All' ? undefined : category, inStock: inStockOnly };
    (query === null ? api.catalog(filters) : api.search(query || 'products', { ...filters, mode }))
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
    if (live) {
      return (liveRes?.hits ?? []).flatMap((h) => {
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

  const run = () => setQuery(draft.trim());

  return (
    <div className="demo">
      <DemoHeader rc={1} title="Real-time recommendations" />

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
                  onClick={() => open(product.id)}
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
                  <ProductThumb product={selected} size={88} />
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

          <section className="panel recs" aria-labelledby="recs-h" aria-live="polite">
            <div className="panel__head">
              <h2 id="recs-h" className="panel__title">
                Recommended for you
              </h2>
              {live ? (
                <span className="tag tag--live">Live · Vector Search</span>
              ) : (
                <span className="tag tag--synthetic">Illustrative</span>
              )}
            </div>
            <p className="small recs__basis">
              {basedOn.length ? (
                <>
                  Based on <strong>{basedOn.slice(0, 2).join(' · ')}</strong>
                  {basedOn.length > 2 ? ` +${basedOn.length - 2}` : ''}
                </>
              ) : (
                <span className="muted">Open a product to personalize</span>
              )}
            </p>
            <ul className="recs__list" key={recItems.map((p) => p.id).join()}>
              {recItems.map((p) => (
                <li key={p.id}>
                  <button className="rec" onClick={() => open(p.id)}>
                    <ProductThumb product={p} size={56} />
                    <span className="rec__body">
                      <span className="rec__name">{p.name}</span>
                      <span className={`stock stock--${p.stock.split(' ')[0].toLowerCase()}`}>{p.stock}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="prove-grid">
        <ProveCards
          demonstrates={['Recommendations update on every view', 'Out-of-stock never recommended', 'Search + recs on the same operational data']}
        />
        <MetricsCard rc={1} />
      </div>
    </div>
  );
}
