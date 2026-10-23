// Live checks for the three RCs against the Atlas cluster.
// Usage: MONGODB_URI=... [VOYAGE_API_KEY=...] node atlas/check.mjs
import { MongoClient } from 'mongodb';
import { embed, hasVoyage } from './voyage.mjs';

const DB = 'trendify_demo';
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(DB);
const products = db.collection('products');
const orders = db.collection('orders');
const h = (t) => console.log(`\n=== ${t} ===`);

// Map shard name → zone (needs read access to config; falls back to shard name).
const zones = new Map();
try {
  for (const s of await client.db('config').collection('shards').find().toArray()) zones.set(s._id, s.tags?.join(', ') || '—');
} catch {
  /* no config access */
}

async function shardFor(filter) {
  const plan = (await orders.find(filter).explain('queryPlanner')).queryPlanner;
  const shards = plan.winningPlan?.shards ?? plan.shards ?? [];
  return shards.map((s) => `${s.shardName}${zones.get(s.shardName) ? ` (zone: ${zones.get(s.shardName)})` : ''}`).join(' + ');
}

async function waitForIndex(name) {
  for (let i = 0; i < 60; i++) {
    const [idx] = await products.listSearchIndexes(name).toArray();
    if (idx?.queryable) return true;
    if (i === 0) process.stdout.write(`waiting for ${name} to be queryable`);
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

try {
  // ---------- RC 1 ----------
  h('RC 1 · Atlas Search (text)');
  if (await waitForIndex('products_text')) {
    const q = 'comfortable shoes for a summer city trip';
    const hits = await products
      .aggregate([
        {
          $search: {
            index: 'products_text',
            compound: {
              must: [{ text: { query: q, path: ['name', 'description', 'tags'] } }],
              mustNot: [{ equals: { path: 'stock', value: 'Out of stock' } }],
            },
          },
        },
        { $limit: 3 },
        { $project: { name: 1, stock: 1, score: { $meta: 'searchScore' } } },
      ])
      .toArray();
    console.log(`"${q}" (in stock only):`);
    hits.forEach((d) => console.log(`  ${d.name} · ${d.stock}`));
  }

  if (hasVoyage()) {
    h('RC 1 · Atlas Vector Search (semantic)');
    if (await waitForIndex('products_vec')) {
      const [qv] = await embed(['something light to wear when it rains in the city'], 'query');
      const hits = await products
        .aggregate([
          {
            $vectorSearch: {
              index: 'products_vec',
              path: 'embedding',
              queryVector: qv,
              numCandidates: 50,
              limit: 3,
              filter: { stock: { $ne: 'Out of stock' } },
            },
          },
          { $project: { name: 1, stock: 1 } },
        ])
        .toArray();
      hits.forEach((d) => console.log(`  ${d.name} · ${d.stock}`));
    }
  }

  // ---------- RC 2 ----------
  h('RC 2 · Transaction: order + inventory decrement');
  const placeOrder = async (location, customerId, productId) => {
    const session = client.startSession();
    try {
      let orderId;
      await session.withTransaction(async () => {
        const p = await products.findOneAndUpdate(
          { _id: productId, qty: { $gte: 1 } },
          { $inc: { qty: -1 } },
          { session, returnDocument: 'after' },
        );
        if (!p) throw new Error(`no stock for ${productId}`);
        const stock = p.qty === 0 ? 'Out of stock' : p.qty <= 5 ? 'Low stock' : 'In stock';
        await products.updateOne({ _id: productId }, { $set: { stock, updatedAt: new Date() } }, { session });
        orderId = `LIVE-${Date.now().toString(36).toUpperCase()}`;
        await orders.insertOne(
          { location, customerId, orderId, items: [{ productId, qty: 1, price: p.price }], total: p.price, status: 'placed', createdAt: new Date() },
          { session },
        );
      });
      return orderId;
    } finally {
      await session.endSession();
    }
  };

  const eu = await placeOrder('DE', 'c-eu-001', 'p2');
  console.log(`  committed ${eu} (DE, p2) — inventory decremented in the same transaction`);
  try {
    await placeOrder('US', 'c-na-001', 'p3');
  } catch (e) {
    console.log(`  aborted as expected: ${e.message} — no order written, no stock change`);
  }

  // ---------- RC 2 + RC 3 ----------
  h('RC 2/3 · Which shard / zone holds each order');
  for (const loc of ['US', 'CA', 'DE', 'FR']) {
    const o = await orders.findOne({ location: loc });
    if (!o) continue;
    console.log(`  ${o.orderId} · location ${loc} → ${await shardFor({ location: loc, customerId: o.customerId })}`);
  }
  console.log(`  ${eu} · location DE → ${await shardFor({ location: 'DE', customerId: 'c-eu-001' })}`);
  console.log('\nExpect US/CA on the NA-zone shard and DE/FR on the EU-zone shard.');
  console.log('If all land on one shard, add location mappings in Atlas → Global Configuration.');
} finally {
  await client.close();
}
