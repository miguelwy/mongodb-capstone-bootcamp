import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PRODUCT, type Order, type Product } from '../data';
import { api, type Health, type PlacedOrder } from '../api';
import { DemoHeader, ProductThumb, ProveCards } from './Common';

interface Props {
  live: Health | null;
  product: Product | null;
  order: Order | null;
  onPlace: (o: Order) => void;
  onBack: () => void;
  onNext: () => void;
}

type Traffic = 'normal' | 'flash';
// Sequence of conceptual hops lit while the demo order flows.
const HOPS = ['storefront', 'checkout', 'router', 'primary', 'replicas', 'done'] as const;
type Hop = (typeof HOPS)[number];

const SHARDS = ['Shard A', 'Shard B', 'Shard C'];

let orderSeq = 0;

const SHOPPERS = 20;
const LAUNCH_GAP_MS = 150; // staggered so each purchase is visible; requests still overlap in flight

interface Shopper {
  i: number;
  location: 'US' | 'DE';
  status: 'queued' | 'flight' | 'ok' | 'no';
  orderId?: string;
  shard?: string;
}

interface FlashRun {
  startQty: number;
  shoppers: Shopper[];
  done: boolean;
}

export default function CheckoutDemo({ live, product, order, onPlace, onBack, onNext }: Props) {
  const item = product ?? DEFAULT_PRODUCT;
  const isFallback = !product;
  const [traffic, setTraffic] = useState<Traffic>('normal');
  const [hop, setHop] = useState<Hop | null>(order ? 'done' : null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashRun | null>(null);
  const committed = flash?.shoppers.filter((s) => s.status === 'ok') ?? [];
  const rejected = flash?.shoppers.filter((s) => s.status === 'no').length ?? 0;
  const flashRunning = !!flash && !flash.done;
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Live: real shards from the cluster, highlighted by the explain() result of the order.
  // Offline: three conceptual shards; the highlighted one is arbitrary.
  const shards = live
    ? live.topology.map((t, i) => ({ key: t.shard, label: `Shard ${i}`, sub: `${t.zone} · ${t.region}` }))
    : SHARDS.map((s) => ({ key: s, label: s, sub: 'replica set' }));
  const targetKeys = new Set(
    live
      ? flash
        ? committed.map((o) => o.shard)
        : [order?.live?.placement.shard]
      : [shards[item.id.charCodeAt(1) % shards.length].key],
  );
  const running = (hop !== null && hop !== 'done') || flashRunning;
  const placed = !!order;
  const hopIdx = hop ? HOPS.indexOf(hop) : -1;
  const lit = (h: Hop) => hopIdx >= HOPS.indexOf(h);

  const animate = (from: number, onDone?: () => void) => {
    HOPS.slice(from).forEach((h, i) => timers.current.push(window.setTimeout(() => setHop(h), i * 380)));
    if (onDone) timers.current.push(window.setTimeout(onDone, (HOPS.length - from) * 380));
  };

  const place = async (replayOnly = false) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setError(null);
    const placedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!live || replayOnly) {
      animate(0, () => {
        if (replayOnly) return;
        orderSeq += 1;
        onPlace({ id: `DEMO-${String(orderSeq).padStart(4, '0')}`, product: item, traffic, placedAt });
      });
      return;
    }
    // Light the path up to the router while the real transaction runs, then finish with the result.
    animate(0);
    if (traffic === 'flash') {
      // Fire SHOPPERS purchases from the browser, one launch every LAUNCH_GAP_MS. Each is a real
      // transaction; the board updates as each one returns.
      let startQty: number;
      try {
        startQty = (await api.product(item.id)).qty;
      } catch (e) {
        setHop(null);
        setError((e as Error).message);
        return;
      }
      const update = (i: number, patch: Partial<Shopper>) =>
        setFlash((f) => f && { ...f, shoppers: f.shoppers.map((x) => (x.i === i ? { ...x, ...patch } : x)) });
      setFlash({
        startQty,
        done: false,
        shoppers: Array.from({ length: SHOPPERS }, (_, i) => ({ i, location: i % 2 ? 'DE' : 'US', status: 'queued' })),
      });
      let first: PlacedOrder | null = null;
      await Promise.all(
        Array.from(
          { length: SHOPPERS },
          (_, i) =>
            new Promise<void>((resolve) => {
              window.setTimeout(() => {
                update(i, { status: 'flight' });
                api
                  .placeOrder(item.id, i % 2 ? 'DE' : 'US')
                  .then((r) => {
                    first ??= r;
                    update(i, { status: 'ok', orderId: r.orderId, shard: r.placement.shard });
                  })
                  .catch(() => update(i, { status: 'no' }))
                  .finally(resolve);
              }, i * LAUNCH_GAP_MS);
            }),
        ),
      );
      setFlash((f) => f && { ...f, done: true });
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const f = first as PlacedOrder | null;
      if (f) {
        const remaining = await api.product(item.id).catch(() => null);
        onPlace({
          id: f.orderId,
          product: { ...item, stock: remaining?.stock ?? item.stock },
          traffic,
          placedAt,
          live: { location: f.location, placement: f.placement },
        });
        setHop('router');
        animate(HOPS.indexOf('primary'));
      } else {
        setHop(null);
      }
      return;
    }
    try {
      const res = await api.placeOrder(item.id, 'US');
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setHop('router');
      onPlace({
        id: res.orderId,
        product: { ...item, stock: res.remaining.stock },
        traffic,
        placedAt,
        live: { location: res.location, placement: res.placement },
      });
      animate(HOPS.indexOf('primary'));
    } catch (e) {
      timers.current.forEach(clearTimeout);
      setHop(null);
      setError((e as Error).message);
    }
  };

  const shipping = 0;

  return (
    <div className="demo">
      <DemoHeader rc={2} title="Flash-sale checkout" />

      <div className="traffic" role="radiogroup" aria-label="Traffic scenario">
        <span className="traffic__label">Traffic scenario</span>
        {(['normal', 'flash'] as Traffic[]).map((t) => (
          <button
            key={t}
            role="radio"
            aria-checked={traffic === t}
            className={`seg__btn seg__btn--lg ${traffic === t ? 'is-on' : ''} ${t === 'flash' ? 'is-flash' : ''}`}
            onClick={() => setTraffic(t)}
          >
            {t === 'normal' ? 'Normal' : '⚡ Flash sale'}
          </button>
        ))}
      </div>

      <div className="demo-grid demo-grid--checkout">
        <section className="panel" aria-labelledby="cart-h">
          <div className="panel__head">
            <h2 id="cart-h">{placed ? 'Order placed' : 'Cart'}</h2>
            {traffic === 'flash' && <span className="pill pill--dark">Flash sale</span>}
          </div>
          {isFallback && (
            <div className="callout callout--info">
              Default product loaded.{' '}
              <button className="link" onClick={onBack}>
                Pick one in Search
              </button>
            </div>
          )}
          <div className="cart-line">
            <ProductThumb product={item} size={80} />
            <div className="cart-line__body">
              <strong>{item.name}</strong>
              <span className="muted">
                {item.color} · Qty 1
              </span>
            </div>
            <span className="price">${item.price}</span>
          </div>
          <dl className="summary">
            <div>
              <dt>Subtotal</dt>
              <dd>${item.price.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Shipping (demo)</dt>
              <dd>${shipping.toFixed(2)}</dd>
            </div>
            <div className="summary__total">
              <dt>Total</dt>
              <dd>${(item.price + shipping).toFixed(2)}</dd>
            </div>
          </dl>

          {error && (
            <div className="callout callout--warn" role="alert">
              <strong>{error}</strong> — no order written, stock unchanged.
            </div>
          )}

          {flash && (
            <div className="flash-result" role="status" aria-live="polite">
              <div className="flash-result__head">
                <strong>
                  {SHOPPERS} shoppers · {flash.done ? 'done' : 'buying…'}
                </strong>
                <span className="muted small">one transaction each</span>
              </div>
              <ol className="shoppers" aria-label="Shoppers">
                {flash.shoppers.map((x) => (
                  <li
                    key={x.i}
                    className={`shopper shopper--${x.status}`}
                    title={`${x.location} · ${x.status}${x.orderId ? ` · ${x.orderId}` : ''}`}
                  >
                    {x.status === 'ok' ? '✓' : x.status === 'no' ? '✕' : x.location}
                  </li>
                ))}
              </ol>
              <div className="flash-result__stats">
                <div className="stat stat--ok">
                  <span className="stat__n">{committed.length}</span>
                  <span>orders committed</span>
                </div>
                <div className="stat stat--no">
                  <span className="stat__n">{rejected}</span>
                  <span>rejected · out of stock</span>
                </div>
                <div className="stat">
                  <span className="stat__n">
                    {flash.startQty}→{Math.max(flash.startQty - committed.length, 0)}
                  </span>
                  <span>stock</span>
                </div>
              </div>
              {flash.done && (
                <p className="small">
                  {committed.length <= flash.startQty
                    ? '✓ No oversell: committed orders never exceeded available stock.'
                    : '✕ Unexpected result — check the data.'}
                </p>
              )}
            </div>
          )}

          {placed && !flash ? (
            <div className="order-ok" role="status">
              <span className="order-ok__icon" aria-hidden>
                ✓
              </span>
              <div>
                <strong>
                  {order!.live ? 'Order' : 'Demo order'} {order!.id} placed
                </strong>
                {order!.live ? (
                  <span className="muted small">
                    Atlas transaction · {order!.live.placement.zone} · {order!.live.placement.region} · stock now{' '}
                    {order!.product.stock.toLowerCase()}
                  </span>
                ) : (
                  <span className="muted small">Simulated in browser</span>
                )}
              </div>
            </div>
          ) : null}

          <div className="detail__actions">
            {!placed ? (
              <button className="btn btn--primary btn--block" onClick={() => place()} disabled={running}>
                {running
                  ? live && traffic === 'flash'
                    ? '20 shoppers buying…'
                    : 'Placing order…'
                  : live && traffic === 'flash'
                    ? '⚡ Run flash sale · 20 shoppers'
                    : live
                      ? 'Place order in Atlas'
                      : 'Place demo order'}
              </button>
            ) : (
              <>
                <button className="btn btn--primary" onClick={onNext}>
                  Continue to Europe placement →
                </button>
                <button className="btn btn--outline" onClick={() => place(true)} disabled={running}>
                  Replay request path
                </button>
              </>
            )}
          </div>
        </section>

        <section className="panel arch" aria-labelledby="arch-h">
          <div className="panel__head">
            <h2 id="arch-h">Request path</h2>
            {live ? (
              <span className="tag tag--live">Live cluster</span>
            ) : (
              <span className="tag">Conceptual</span>
            )}
          </div>

          <div className={`lane ${traffic === 'flash' ? 'is-flash' : ''}`}>
            <div className={`lane__node ${lit('storefront') ? 'is-lit' : ''}`}>
              <span className="lane__kicker">Client</span>Storefront
            </div>
            <div className="lane__wire" aria-hidden>
              {Array.from({ length: traffic === 'flash' ? 6 : 2 }).map((_, i) => (
                <span key={i} className="pulse" style={{ animationDelay: `${i * (traffic === 'flash' ? 0.18 : 0.6)}s` }} />
              ))}
            </div>
            <div className={`lane__node ${lit('checkout') ? 'is-lit' : ''}`}>
              <span className="lane__kicker">Service</span>Checkout service
            </div>
            <div className="lane__wire" aria-hidden>
              {Array.from({ length: traffic === 'flash' ? 6 : 2 }).map((_, i) => (
                <span key={i} className="pulse" style={{ animationDelay: `${i * (traffic === 'flash' ? 0.18 : 0.6) + 0.1}s` }} />
              ))}
            </div>
            <div className={`lane__node ${lit('router') ? 'is-lit' : ''}`}>
              <span className="lane__kicker">Data layer</span>Query router
            </div>
          </div>

          <div className="topo" style={{ gridTemplateColumns: `repeat(${shards.length}, minmax(0, 1fr))` }}>
            {shards.map((sh) => {
              // During a flash sale a shard lights up as soon as its first order lands.
              const target = targetKeys.has(sh.key) && (!flash || committed.some((o) => o.shard === sh.key));
              const busy = traffic === 'flash';
              return (
                <div key={sh.key} className={`shard ${busy ? 'is-busy' : ''} ${target && lit('primary') ? 'is-target' : ''}`}>
                  <div className="shard__head">
                    <strong>{sh.label}</strong>
                    <span className="muted small">{sh.sub}</span>
                  </div>
                  <div className={`member member--primary ${target && lit('primary') ? 'is-lit' : ''}`}>
                    Primary <span className="muted small">writes</span>
                  </div>
                  <div className="member-row">
                    <div className={`member ${target && lit('replicas') ? 'is-lit' : ''}`}>Secondary</div>
                    <div className={`member ${target && lit('replicas') ? 'is-lit' : ''}`}>Secondary</div>
                  </div>
                  {flash && (
                    <ul className="shard-orders" aria-label={`Orders stored on ${sh.label}`}>
                      {committed
                        .filter((o) => o.shard === sh.key)
                        .map((o) => (
                          <li key={o.i}>
                            {o.location} · {o.orderId?.slice(-6)}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <p className="muted small">
            {live
              ? 'Each shard is a replica set. Highlighted shard comes from explain() on the stored order.'
              : 'Each shard is a replica set. Highlighted shard is arbitrary.'}
          </p>

          <div className="callout callout--neutral">
            <strong>Open questions:</strong> transaction boundary · inventory reservation · failover behavior
          </div>
        </section>
      </div>

      <ProveCards
        demonstrates={['Checkout request path', 'Sharding & replica-set roles', 'Order state carried to Europe']}
      />
    </div>
  );
}
