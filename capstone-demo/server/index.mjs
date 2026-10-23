// Tiny API between the demo app and Atlas. Keeps the connection string server-side.
// Usage: node --env-file=atlas/.env server/index.mjs   (port 8787, proxied by Vite at /api)
import http from 'node:http';
import { MongoClient } from 'mongodb';
import { embed, hasVoyage } from '../atlas/voyage.mjs';
import { products as seedProducts } from '../atlas/seed-data.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DB = 'trendify_demo';
const CUSTOMER = { US: 'c-na-001', DE: 'c-eu-001' };

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, minPoolSize: 25 });
await client.connect();
const db = client.db(DB);
const products = db.collection('products');
const orders = db.collection('orders');
const events = db.collection('events');
const sessions = db.collection('sessions');

const stockLabel = (qty) => (qty === 0 ? 'Out of stock' : qty <= 5 ? 'Low stock' : 'In stock');
const REGION_NAME = { US_EAST_1: 'us-east-1', EU_WEST_1: 'eu-west-1', EU_CENTRAL_1: 'eu-central-1' };

// Shard → zone + cloud region, read once from config and each shard's hello tags.
async function loadTopology() {
  const base = new URL(process.env.MONGODB_URI.replace('mongodb+srv://', 'http://'));
  const shards = await client.db('config').collection('shards').find().toArray();
  return Promise.all(
    shards.map(async (s) => {
      const [rs, hosts] = s.host.split('/');
      const direct = new MongoClient(
        `mongodb://${base.username}:${base.password}@${hosts}/?replicaSet=${rs}&tls=true&authSource=admin`,
        { serverSelectionTimeoutMS: 15000 },
      );
      let region = 'unknown';
      try {
        await direct.connect();
        const r = (await direct.db('admin').command({ hello: 1 })).tags?.region;
        region = REGION_NAME[r] ?? r?.toLowerCase().replaceAll('_', '-') ?? region;
      } catch {
        /* region stays unknown */
      } finally {
        await direct.close();
      }
      return { shard: s._id, zone: s.tags?.join(', ') ?? '—', region };
    }),
  );
}
const topology = await loadTopology();
const version = (await client.db('admin').command({ buildInfo: 1 })).version;
console.log('topology:', topology);

async function placementOf(filter) {
  const plan = (await orders.find(filter).explain('queryPlanner')).queryPlanner;
  const name = (plan.winningPlan?.shards ?? plan.shards ?? [])[0]?.shardName;
  return topology.find((t) => t.shard === name) ?? { shard: name ?? 'unknown', zone: '—', region: 'unknown' };
}

function categoryIntent(q) {
  const t = q.toLowerCase();
  if (/\b(shoe|shoes|sneaker|sneakers|sandal|sandals|footwear)\b/.test(t)) return 'Shoes';
  if (/\b(bag|bags|duffel|backpack)\b/.test(t)) return 'Bags';
  if (/\b(shirt|jacket|coat|outerwear)\b/.test(t)) return 'Apparel';
  if (/\b(sunglasses|accessory|accessories)\b/.test(t)) return 'Accessories';
  return null;
}

async function search({ q, category, inStock, mode }) {
  const intent = categoryIntent(q);
  const useVector = mode !== 'text' && hasVoyage();
  let pipeline;
  if (useVector) {
    const [queryVector] = await embed([q], 'query');
    const and = [];
    if (inStock) and.push({ stock: { $ne: 'Out of stock' } });
    if (category) and.push({ category: { $eq: category } });
    pipeline = [
      {
        $vectorSearch: {
          index: 'products_vec',
          path: 'embedding',
          queryVector,
          numCandidates: 100,
          limit: 8,
          ...(and.length ? { filter: and.length === 1 ? and[0] : { $and: and } } : {}),
        },
      },
      { $project: { embedding: 0 } },
      { $set: { score: { $meta: 'vectorSearchScore' } } },
    ];
  } else {
    const filter = [];
    if (inStock) filter.push({ equals: { path: 'stock', value: 'Out of stock' } });
    pipeline = [
      {
        $search: {
          index: 'products_text',
          compound: {
            // A text hit or the stated category ("shoes" → Shoes) counts as a match.
            should: [
              { text: { query: q, path: ['name', 'description', 'tags'] } },
              { text: { query: q, path: ['name', 'tags'], score: { boost: { value: 2 } } } },
              ...(intent ? [{ equals: { path: 'category', value: intent, score: { boost: { value: 5 } } } }] : []),
            ],
            minimumShouldMatch: 1,
            ...(filter.length ? { mustNot: filter } : {}),
            ...(category ? { filter: [{ equals: { path: 'category', value: category } }] } : {}),
          },
        },
      },
      { $limit: 8 },
      { $project: { embedding: 0 } },
      { $set: { score: { $meta: 'searchScore' } } },
    ];
  }
  let docs = await products.aggregate(pipeline).toArray();
  if (useVector && intent && !category) {
    // Re-rank: items matching the stated category first, keeping vector order within each group.
    docs = [...docs.filter((d) => d.category === intent), ...docs.filter((d) => d.category !== intent)];
  }
  const top = Math.max(...docs.map((d) => d.score), 1e-9);
  // Small catalog: vector search always returns every item, so keep only close matches (min 3).
  const cutoff = useVector ? 0.95 : 0.3;
  const ranked = docs.map((d) => ({ id: d._id, qty: d.qty, stock: d.stock, score: d.score / top }));
  const kept = ranked.filter((r, i) => i < 3 || r.score >= cutoff);
  return { engine: useVector ? 'Atlas Vector Search' : 'Atlas Search', results: kept };
}

// Decrement qty and recompute the stock label in one atomic pipeline update.
const STOCK_DECREMENT = [
  { $set: { qty: { $subtract: ['$qty', 1] }, updatedAt: '$$NOW' } },
  {
    $set: {
      stock: {
        $switch: {
          branches: [
            { case: { $lte: ['$qty', 0] }, then: 'Out of stock' },
            { case: { $lte: ['$qty', 5] }, then: 'Low stock' },
          ],
          default: 'In stock',
        },
      },
    },
  },
];

async function placeOrder({ productId, location = 'US' }) {
  const customerId = CUSTOMER[location] ?? CUSTOMER.US;
  const session = client.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const p = await products.findOneAndUpdate(
        { _id: productId, qty: { $gte: 1 } },
        STOCK_DECREMENT,
        { session, returnDocument: 'after', projection: { qty: 1, price: 1 } },
      );
      if (!p) throw Object.assign(new Error('Out of stock — transaction aborted'), { status: 409 });
      order = {
        location,
        customerId,
        orderId: `LIVE-${(Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase()}`,
        items: [{ productId, qty: 1, price: p.price }],
        total: p.price,
        status: 'placed',
        createdAt: new Date(),
      };
      await orders.insertOne(order, { session });
      order.remaining = { qty: p.qty, stock: stockLabel(p.qty) };
    });
  } finally {
    await session.endSession();
  }
  const placement = await placementOf({ location: order.location, customerId: order.customerId, orderId: order.orderId });
  return { orderId: order.orderId, location: order.location, remaining: order.remaining, placement };
}

// N shoppers buy the same item at the same moment. Each purchase is its own transaction with a
// conditional decrement, so committed orders can never exceed the stock that existed.
// This shows consistency under concurrency — not throughput or latency.
async function flashSale({ productId, buyers = 20 }) {
  const n = Math.min(Math.max(Number(buyers) || 20, 2), 50);
  const before = await products.findOne({ _id: productId }, { projection: { qty: 1 } });
  if (!before) throw Object.assign(new Error('product not found'), { status: 404 });
  const results = await Promise.allSettled(
    Array.from({ length: n }, (_, i) => placeOrder({ productId, location: i % 2 ? 'DE' : 'US' })),
  );
  const committed = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failures = results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message ?? 'error');
  const after = await products.findOne({ _id: productId }, { projection: { qty: 1, stock: 1 } });
  const byZone = {};
  for (const o of committed) {
    const k = `${o.placement.zone} · ${o.placement.region}`;
    byZone[k] = (byZone[k] ?? 0) + 1;
  }
  return {
    buyers: n,
    startQty: before.qty,
    endQty: after.qty,
    stock: after.stock,
    committed,
    rejected: failures.length,
    outOfStock: failures.filter((m) => m.startsWith('Out of stock')).length,
    byZone,
  };
}

// Changing a shard-key value moves the document to the shard of the new zone.
async function setRegion(orderId, region) {
  const location = region === 'eu' ? 'DE' : 'US';
  const current = await orders.findOne({ orderId });
  if (!current) throw Object.assign(new Error('order not found'), { status: 404 });
  if (current.location !== location) {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await orders.updateOne(
          { location: current.location, customerId: current.customerId, orderId },
          { $set: { location, customerId: CUSTOMER[location] } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }
  const placement = await placementOf({ location, customerId: CUSTOMER[location], orderId });
  return { orderId, location, placement };
}

// ---------- Real-time recommendations (RC 1) ----------
// Each product view is an event. The session profile is the recency-weighted mean of the
// embeddings of the last viewed products, so the next recommendation reflects the last click.
const PROFILE_WINDOW = 5;

async function recommend(sessionId, known) {
  const session = known ?? (sessionId ? await sessions.findOne({ _id: sessionId }) : null);
  const viewed = session?.viewed ?? [];
  const inStock = { stock: { $ne: 'Out of stock' } };
  if (!session?.profile) {
    // Cold start: nothing viewed yet, so show well-stocked items.
    const docs = await products.find(inStock, { projection: { qty: 1, stock: 1 } }).sort({ qty: -1 }).limit(3).toArray();
    return { mode: 'cold', basedOn: [], results: docs.map((d) => ({ id: d._id, qty: d.qty, stock: d.stock, score: 0 })) };
  }
  const docs = await products
    .aggregate([
      {
        $vectorSearch: {
          index: 'products_vec',
          path: 'embedding',
          queryVector: session.profile,
          numCandidates: 50,
          limit: 8,
          filter: inStock,
        },
      },
      { $set: { score: { $meta: 'vectorSearchScore' } } },
      { $match: { _id: { $nin: viewed } } },
      { $limit: 3 },
      { $project: { qty: 1, stock: 1, score: 1 } },
    ])
    .toArray();
  return {
    mode: 'personalized',
    basedOn: viewed.slice(-PROFILE_WINDOW).reverse(),
    results: docs.map((d) => ({ id: d._id, qty: d.qty, stock: d.stock, score: d.score })),
  };
}

async function recordView(sessionId, productId) {
  // The event write and the session read are independent, so they run in parallel.
  const [, prevSession] = await Promise.all([
    events.insertOne({ sessionId, productId, type: 'view', at: new Date() }),
    sessions.findOne({ _id: sessionId }, { projection: { viewed: 1 } }),
  ]);
  const prev = prevSession?.viewed ?? [];
  const viewed = [...prev.filter((id) => id !== productId), productId];
  const recent = viewed.slice(-PROFILE_WINDOW);
  const vecs = await products.find({ _id: { $in: recent } }, { projection: { embedding: 1 } }).toArray();
  const byId = new Map(vecs.filter((v) => v.embedding).map((v) => [v._id, v.embedding]));
  // Newer views weigh more: weight doubles with each newer view, so the last click leads.
  let profile = null;
  let total = 0;
  recent.forEach((id, i) => {
    const e = byId.get(id);
    if (!e) return;
    const w = 2 ** i;
    profile = profile ? profile.map((x, k) => x + e[k] * w) : e.map((x) => x * w);
    total += w;
  });
  if (profile) profile = profile.map((x) => x / total);
  // Persist the profile and compute recommendations from it at the same time.
  const [, recs] = await Promise.all([
    sessions.updateOne({ _id: sessionId }, { $set: { viewed, profile, updatedAt: new Date() } }, { upsert: true }),
    recommend(sessionId, { viewed, profile }),
  ]);
  return recs;
}

// ---------- Success-metric validation ----------
// Each check runs against the live cluster with its own throwaway data (test product, session,
// order) and cleans up after itself, so it never changes the demo state.
const ms = (t0) => Math.round(performance.now() - t0);
const regionOf = (loc) => (['DE', 'FR', 'IE'].includes(loc) ? 'eu' : 'na');
const isRegion = (region, placement) => (region === 'eu') === placement.region.startsWith('eu');

async function validateRc1() {
  const sid = `metrics-${Date.now().toString(36)}`;
  const views = ['p1', 'p5', 'p6', 'p4', 'p8'];
  const times = [];
  let outOfStock = 0;
  for (const id of views) {
    const t0 = performance.now();
    const r = await recordView(sid, id);
    times.push(ms(t0));
    outOfStock += r.results.filter((x) => x.stock === 'Out of stock').length;
  }
  const queries = ['comfortable shoes for a summer city trip', 'something light for rainy days', 'bag for a weekend away', 'summer accessories', 'breathable shirt'];
  const searchTimes = [];
  for (const q of queries) {
    const t0 = performance.now();
    await search({ q, category: null, inStock: true, mode: 'vector' });
    searchTimes.push(ms(t0));
  }
  await Promise.all([events.deleteMany({ sessionId: sid }), sessions.deleteOne({ _id: sid })]);
  const worst = Math.max(...times);
  const worstSearch = Math.max(...searchTimes);
  return [
    { id: 'rc1-fresh', value: worst, unit: 'ms', pass: worst <= 2000, detail: `${views.length} views · ${times.join(' / ')} ms` },
    { id: 'rc1-oos', value: outOfStock, unit: 'items', pass: outOfStock === 0, detail: `${views.length} recommendation sets checked` },
    { id: 'rc1-search', value: worstSearch, unit: 'ms', pass: worstSearch <= 1000, detail: `${queries.length} queries · ${searchTimes.join(' / ')} ms` },
  ];
}

async function validateRc2() {
  const pid = `mtest-${Date.now().toString(36)}`;
  const stockQty = 3;
  await products.insertOne({ _id: pid, name: 'Metrics test item', category: 'Test', price: 1, qty: stockQty, stock: 'Low stock' });
  try {
    const t0 = performance.now();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => placeOrder({ productId: pid, location: i % 2 ? 'DE' : 'US' })),
    );
    const elapsed = ms(t0);
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const end = (await products.findOne({ _id: pid }, { projection: { qty: 1 } })).qty;
    // Spread is measured on normal load (well-stocked item, US + DE shoppers), not the hot item.
    const spreadPid = `${pid}-spread`;
    await products.insertOne({ _id: spreadPid, name: 'Metrics spread item', category: 'Test', price: 1, qty: 100, stock: 'In stock' });
    const spread = await Promise.all(
      Array.from({ length: 10 }, (_, i) => placeOrder({ productId: spreadPid, location: i % 2 ? 'DE' : 'US' })),
    );
    const shards = new Set(spread.map((o) => o.placement.shard));
    return [
      { id: 'rc2-burst', value: elapsed, unit: 'ms', pass: elapsed < 3000, detail: `20 concurrent checkouts · ${ok.length} committed` },
      {
        id: 'rc2-oversell',
        value: ok.length,
        unit: 'orders',
        pass: ok.length === stockQty && end === 0,
        detail: `stock ${stockQty} → ${end} · ${20 - ok.length} rejected`,
      },
      {
        id: 'rc2-spread',
        value: shards.size,
        unit: 'shards',
        pass: shards.size >= 2,
        detail: `10 concurrent orders (US + DE) → ${[...shards].map((x) => x.slice(-7)).join(' + ')}`,
      },
    ];
  } finally {
    await Promise.all([
      products.deleteMany({ _id: { $in: [pid, `${pid}-spread`] } }),
      orders.deleteMany({ 'items.productId': { $in: [pid, `${pid}-spread`] } }),
    ]);
  }
}

async function validateRc3() {
  const all = await orders.find({}, { projection: { location: 1, customerId: 1, orderId: 1 } }).toArray();
  let correct = 0;
  for (const o of all) {
    const pl = await placementOf({ location: o.location, customerId: o.customerId, orderId: o.orderId });
    if (isRegion(regionOf(o.location), pl)) correct += 1;
  }
  const pct = all.length ? Math.round((correct / all.length) * 100) : 0;

  const plan = (await orders.find({ location: 'DE' }).explain('queryPlanner')).queryPlanner;
  const touched = (plan.winningPlan?.shards ?? plan.shards ?? []).map((x) => x.shardName);
  const euOnly = touched.length === 1 && isRegion('eu', topology.find((t) => t.shard === touched[0]) ?? { region: '' });

  const orderId = `MTEST-${Date.now().toString(36).toUpperCase()}`;
  await orders.insertOne({ location: 'US', customerId: CUSTOMER.US, orderId, items: [], total: 0, status: 'test', createdAt: new Date() });
  let rehome = null;
  let rehomed = false;
  try {
    const t0 = performance.now();
    const r = await setRegion(orderId, 'eu');
    rehome = ms(t0);
    rehomed = isRegion('eu', r.placement);
  } finally {
    await orders.deleteMany({ orderId });
  }
  return [
    { id: 'rc3-placement', value: pct, unit: '%', pass: pct === 100, detail: `${correct}/${all.length} orders in their zone` },
    { id: 'rc3-isolation', value: touched.length, unit: 'shard', pass: euOnly, detail: `DE query → ${touched.map((x) => x.slice(-7)).join(', ') || '—'}` },
    { id: 'rc3-rehome', value: rehome, unit: 'ms', pass: rehomed && rehome <= 2000, detail: rehomed ? 'US → DE, read back in EU zone' : 'not found in EU zone' },
  ];
}

async function reset() {
  await products.bulkWrite(
    seedProducts.map((p) => ({
      updateOne: { filter: { _id: p._id }, update: { $set: { qty: p.qty, stock: p.stock, updatedAt: new Date() } } },
    })),
  );
  const { deletedCount } = await orders.deleteMany({ orderId: /^LIVE-/ });
  await Promise.all([events.deleteMany({}), sessions.deleteMany({})]);
  return { ok: true, deletedOrders: deletedCount };
}

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s ? JSON.parse(s) : {}));
  });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        return json(res, 200, { live: true, vector: hasVoyage(), version, topology });
      }
      if (req.method === 'GET' && url.pathname === '/api/search') {
        return json(
          res,
          200,
          await search({
            q: url.searchParams.get('q') ?? '',
            category: url.searchParams.get('category') || null,
            inStock: url.searchParams.get('inStock') === '1',
            mode: url.searchParams.get('mode'),
          }),
        );
      }
      if (req.method === 'POST' && url.pathname === '/api/orders') {
        return json(res, 200, await placeOrder(await readBody(req)));
      }
      if (req.method === 'POST' && url.pathname === '/api/metrics') {
        const rc = String((await readBody(req)).rc ?? 'all');
        const run = { 1: validateRc1, 2: validateRc2, 3: validateRc3 };
        const checks = [];
        for (const k of rc === 'all' ? ['1', '2', '3'] : [rc]) checks.push(...(await run[k]()));
        return json(res, 200, { at: new Date().toISOString(), checks });
      }
      if (req.method === 'GET' && url.pathname === '/api/recs') {
        return json(res, 200, await recommend(url.searchParams.get('sessionId')));
      }
      if (req.method === 'POST' && url.pathname === '/api/events') {
        const { sessionId, productId } = await readBody(req);
        if (!sessionId || !productId) return json(res, 400, { error: 'sessionId and productId required' });
        return json(res, 200, await recordView(String(sessionId), String(productId)));
      }
      if (req.method === 'GET' && url.pathname === '/api/products') {
        const filter = {};
        const category = url.searchParams.get('category');
        if (category) filter.category = category;
        if (url.searchParams.get('inStock') === '1') filter.stock = { $ne: 'Out of stock' };
        const docs = await products.find(filter, { projection: { qty: 1, stock: 1 } }).sort({ _id: 1 }).toArray();
        return json(res, 200, {
          engine: 'MongoDB find()',
          results: docs.map((d) => ({ id: d._id, qty: d.qty, stock: d.stock, score: 0 })),
        });
      }
      const pm = url.pathname.match(/^\/api\/products\/([\w-]+)$/);
      if (req.method === 'GET' && pm) {
        const p = await products.findOne({ _id: pm[1] }, { projection: { qty: 1, stock: 1 } });
        return p ? json(res, 200, p) : json(res, 404, { error: 'not found' });
      }
      if (req.method === 'POST' && url.pathname === '/api/flash-sale') {
        return json(res, 200, await flashSale(await readBody(req)));
      }
      const m = url.pathname.match(/^\/api\/orders\/([\w-]+)\/region$/);
      if (req.method === 'POST' && m) {
        return json(res, 200, await setRegion(m[1], (await readBody(req)).region));
      }
      if (req.method === 'POST' && url.pathname === '/api/reset') {
        return json(res, 200, await reset());
      }
      json(res, 404, { error: 'not found' });
    } catch (e) {
      console.error(e);
      json(res, e.status ?? 500, { error: e.message });
    }
  })
  .listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
