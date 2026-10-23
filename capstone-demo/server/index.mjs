// Tiny API between the demo app and Atlas. Keeps the connection string server-side.
// Usage: node --env-file=atlas/.env server/index.mjs   (port 8787, proxied by Vite at /api)
import http from 'node:http';
import { MongoClient } from 'mongodb';
import { embed, hasVoyage } from '../atlas/voyage.mjs';
import { products as seedProducts } from '../atlas/seed-data.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DB = 'trendify_demo';
const CUSTOMER = { US: 'c-na-001', DE: 'c-eu-001' };

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(DB);
const products = db.collection('products');
const orders = db.collection('orders');

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

async function placeOrder({ productId, location = 'US' }) {
  const customerId = CUSTOMER[location] ?? CUSTOMER.US;
  const session = client.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const p = await products.findOneAndUpdate(
        { _id: productId, qty: { $gte: 1 } },
        { $inc: { qty: -1 } },
        { session, returnDocument: 'after' },
      );
      if (!p) throw Object.assign(new Error('Out of stock — transaction aborted'), { status: 409 });
      await products.updateOne({ _id: productId }, { $set: { stock: stockLabel(p.qty), updatedAt: new Date() } }, { session });
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

async function reset() {
  await products.bulkWrite(
    seedProducts.map((p) => ({
      updateOne: { filter: { _id: p._id }, update: { $set: { qty: p.qty, stock: p.stock, updatedAt: new Date() } } },
    })),
  );
  const { deletedCount } = await orders.deleteMany({ orderId: /^LIVE-/ });
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
