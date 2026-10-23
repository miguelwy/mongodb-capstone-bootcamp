// Client for the optional live API (server/index.mjs). Every call fails soft so the app
// falls back to its synthetic, in-browser behavior when no cluster is connected.

export interface Placement {
  shard: string;
  zone: string;
  region: string;
}

export interface Health {
  live: boolean;
  vector: boolean;
  version?: string;
  topology: Placement[];
}

export interface LiveHit {
  id: string;
  qty: number;
  stock: 'In stock' | 'Low stock' | 'Out of stock';
  score: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export interface PlacedOrder {
  orderId: string;
  location: string;
  remaining: { qty: number; stock: LiveHit['stock'] };
  placement: Placement;
}

export interface FlashSaleResult {
  buyers: number;
  startQty: number;
  endQty: number;
  stock: LiveHit['stock'];
  committed: PlacedOrder[];
  rejected: number;
  outOfStock: number;
  byZone: Record<string, number>;
}

export interface Recs {
  mode: 'cold' | 'personalized';
  basedOn: string[];
  results: LiveHit[];
}

export interface MetricCheck {
  id: string;
  value: number;
  unit: string;
  pass: boolean;
  detail: string;
}

export const api = {
  health: () => call<Health>('/health'),
  search: (q: string, opts: { category?: string; inStock?: boolean; mode?: 'vector' | 'text' }) => {
    const p = new URLSearchParams({ q });
    if (opts.category) p.set('category', opts.category);
    if (opts.inStock) p.set('inStock', '1');
    if (opts.mode) p.set('mode', opts.mode);
    return call<{ engine: string; results: LiveHit[] }>(`/search?${p}`);
  },
  placeOrder: (productId: string, location = 'US') =>
    call<PlacedOrder>('/orders', { method: 'POST', body: JSON.stringify({ productId, location }) }),
  catalog: (opts: { category?: string; inStock?: boolean }) => {
    const p = new URLSearchParams();
    if (opts.category) p.set('category', opts.category);
    if (opts.inStock) p.set('inStock', '1');
    return call<{ engine: string; results: LiveHit[] }>(`/products?${p}`);
  },
  recs: (sessionId: string) => call<Recs>(`/recs?sessionId=${encodeURIComponent(sessionId)}`),
  view: (sessionId: string, productId: string) =>
    call<Recs>('/events', { method: 'POST', body: JSON.stringify({ sessionId, productId }) }),
  product: (id: string) => call<{ qty: number; stock: LiveHit['stock'] }>(`/products/${id}`),
  flashSale: (productId: string, buyers = 20) =>
    call<FlashSaleResult>('/flash-sale', { method: 'POST', body: JSON.stringify({ productId, buyers }) }),
  setRegion: (orderId: string, region: 'na' | 'eu') =>
    call<{ orderId: string; location: string; placement: Placement }>(`/orders/${orderId}/region`, {
      method: 'POST',
      body: JSON.stringify({ region }),
    }),
  metrics: (rc: 1 | 2 | 3 | 'all') =>
    call<{ at: string; checks: MetricCheck[] }>('/metrics', { method: 'POST', body: JSON.stringify({ rc }) }),
  reset: () => call<{ ok: boolean; deletedOrders: number }>('/reset', { method: 'POST' }),
};
