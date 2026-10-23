import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { TABS, type Order, type Product, type Region, type TabId } from './data';
import { NotesPanel } from './components/Common';
import { api, type Health } from './api';
import mongodbLogo from './assets/mongodb-logo.svg';
import { MetricsProvider } from './metrics';
import Overview from './components/Overview';
import SearchDemo from './components/SearchDemo';
import CheckoutDemo from './components/CheckoutDemo';
import EuropeDemo from './components/EuropeDemo';
import Recap from './components/Recap';

export interface Journey {
  product: Product | null;
  order: Order | null;
  region: Region | null;
}

const EMPTY: Journey = { product: null, order: null, region: null };
const newSessionId = () => `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const STEPS: { tab: TabId; label: string; rc: 1 | 2 | 3 }[] = [
  { tab: 'search', label: 'Discover', rc: 1 },
  { tab: 'checkout', label: 'Checkout', rc: 2 },
  { tab: 'europe', label: 'Europe', rc: 3 },
];

export default function App() {
  const [tab, setTab] = useState<TabId>('overview');
  const [journey, setJourney] = useState<Journey>(EMPTY);
  const [notesOpen, setNotesOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [live, setLive] = useState<Health | null>(null);
  const [regionBusy, setRegionBusy] = useState(false);
  // One shopper session per journey: drives the real-time recommendations.
  const [sessionId, setSessionId] = useState(newSessionId);
  const [viewed, setViewed] = useState<string[]>([]);
  const [regionError, setRegionError] = useState<string | null>(null);

  useEffect(() => {
    api.health().then(setLive, () => setLive(null));
  }, []);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mainRef = useRef<HTMLElement>(null);


  const go = (id: TabId) => {
    setRecapOpen(false);
    setTab(id);
    window.scrollTo({ top: 0 });
  };

  const reset = () => {
    if (live) api.reset().catch(() => {});
    setRegionError(null);
    setSessionId(newSessionId());
    setViewed([]);
    setJourney(EMPTY);
    setRecapOpen(false);
    setTab('search');
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && recapOpen) setRecapOpen(false);
      // Presenter notes have no on-screen button: press N (outside text fields) to toggle.
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea');
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') setNotesOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recapOpen]);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TABS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      go(TABS[next].id);
      tabRefs.current[next]?.focus();
    }
  };

  const stepDone = (s: TabId) =>
    (s === 'search' && !!journey.product) ||
    (s === 'checkout' && !!journey.order) ||
    (s === 'europe' && !!journey.region);

  return (
    <MetricsProvider live={live}>
    <div className={`app ${notesOpen ? 'has-notes' : ''}`}>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <div className="sticky-head">
      <header className="topbar">
        <div className="topbar__row">
          <div className="brand">
            <img className="brand__logo" src={mongodbLogo} alt="MongoDB" />
            <span className="brand__divider" aria-hidden />
            <span className="brand__name">Trendify 3.0</span>
            <span className="brand__sub">Technical Feasibility Workshop</span>
            <span className="pill pill--dark">TFW · 40 min</span>
          </div>
          <div className="topbar__actions">
            <button className="btn btn--ghost-dark btn--sm" onClick={reset}>
              Reset journey
            </button>
            <button
              className={`btn btn--sm ${recapOpen ? 'btn--primary' : 'btn--outline-green'}`}
              aria-pressed={recapOpen}
              onClick={() => setRecapOpen((v) => !v)}
            >
              Close &amp; recap
            </button>
          </div>
        </div>
        <nav className="tabs" role="tablist" aria-label="Workshop sections">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => (tabRefs.current[i] = el)}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id && !recapOpen}
              aria-controls="main"
              tabIndex={tab === t.id ? 0 : -1}
              className={`tab ${tab === t.id && !recapOpen ? 'is-active' : ''}`}
              onClick={() => go(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <span className="tab__num">{i + 1}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="ribbon" aria-label="Shopper journey and proposed RCs">
        <div className="ribbon__inner">
          <span className="ribbon__label">Shopper journey</span>
          <ol className="steps">
            {STEPS.map((s, i) => {
              const active = !recapOpen && tab === s.tab;
              return (
                <li key={s.tab} className="steps__item">
                  {i > 0 && <span className="steps__arrow" aria-hidden>→</span>}
                  <button
                    className={`step ${active ? 'is-active' : ''} ${stepDone(s.tab) ? 'is-done' : ''}`}
                    onClick={() => go(s.tab)}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className="step__dot" aria-hidden>
                      {stepDone(s.tab) ? '✓' : i + 1}
                    </span>
                    <span className="step__label">{s.label}</span>
                    <span className="step__rc">RC {s.rc}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="ribbon__state" aria-live="polite">
            {journey.product ? (
              <span>
                Cart: <strong>{journey.product.name}</strong>
              </span>
            ) : (
              <span className="muted">Cart empty</span>
            )}
            <span className="sep" aria-hidden>|</span>
            {journey.order ? (
              <span>
                Order <strong>{journey.order.id}</strong>
                {journey.region && <> · {journey.region === 'eu' ? 'Europe' : 'North America'}</>}
              </span>
            ) : (
              <span className="muted">No order</span>
            )}
          </div>
        </div>
      </div>
      </div>

      <div className="layout">
        <main id="main" ref={mainRef} className="main" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={-1}>
          {recapOpen ? (
            <Recap onReset={reset} journey={journey} />
          ) : (
            <div key={tab} className="fade-in">
              {tab === 'overview' && <Overview live={live} onStart={() => go('search')} />}
              {tab === 'search' && (
                <SearchDemo
                  live={live}
                  sessionId={sessionId}
                  viewed={viewed}
                  onView={(id) => setViewed((v) => [...v.filter((x) => x !== id), id])}
                  journeyProduct={journey.product}
                  onAdd={(p) => setJourney({ product: p, order: null, region: null })}
                  onNext={() => go('checkout')}
                />
              )}
              {tab === 'checkout' && (
                <CheckoutDemo
                  live={live}
                  product={journey.product}
                  order={journey.order}
                  onPlace={(o) => setJourney((j) => ({ ...j, product: o.product, order: o, region: null }))}
                  onBack={() => go('search')}
                  onNext={() => go('europe')}
                />
              )}
              {tab === 'europe' && (
                <EuropeDemo
                  order={journey.order}
                  region={journey.region}
                  live={live}
                  busy={regionBusy}
                  error={regionError}
                  onRegion={async (r) => {
                    setJourney((j) => ({ ...j, region: r }));
                    const o = journey.order;
                    if (!live || !o?.live) return;
                    setRegionBusy(true);
                    setRegionError(null);
                    try {
                      const res = await api.setRegion(o.id, r);
                      setJourney((j) =>
                        j.order?.id === o.id
                          ? { ...j, order: { ...j.order, live: { location: res.location, placement: res.placement } } }
                          : j,
                      );
                    } catch (e) {
                      setRegionError((e as Error).message);
                    } finally {
                      setRegionBusy(false);
                    }
                  }}
                  onBack={() => go('checkout')}
                  onRecap={() => setRecapOpen(true)}
                />
              )}
            </div>
          )}
        </main>
        {notesOpen && <NotesPanel stage={recapOpen ? 'recap' : tab} onClose={() => setNotesOpen(false)} />}
      </div>

      <footer className="disclaimer" role="note">
        {live ? (
          <>
            <span className="dot dot--green" aria-hidden /> Live Atlas cluster · synthetic data
          </>
        ) : (
          <>
            <span className="dot dot--amber" aria-hidden /> Illustrative prototype · synthetic data · no live Atlas connection
          </>
        )}
      </footer>
    </div>
    </MetricsProvider>
  );
}
