// One-time setup for the Trendify TFW demo on an Atlas Global Cluster.
// Usage: MONGODB_URI=... [VOYAGE_API_KEY=...] node atlas/setup.mjs [--reset]
import { MongoClient } from 'mongodb';
import { products, customers, orders, embeddingText } from './seed-data.mjs';
import { embed, hasVoyage } from './voyage.mjs';

const DB = 'trendify_demo';
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Set MONGODB_URI (Atlas connection string for a user with Atlas admin role).');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(DB);
const log = (msg) => console.log(`• ${msg}`);

try {
  if (process.argv.includes('--reset')) {
    await db.dropDatabase();
    log(`dropped ${DB}`);
  }

  // 1. Global collections must be sharded in the Atlas UI (Global Configuration → Shard Collection)
  //    so Atlas manages their zone ranges. Sharding via shardCollection leaves them without zones.
  for (const coll of ['customers', 'orders']) {
    const ns = `${DB}.${coll}`;
    const meta = await client.db('config').collection('collections').findOne({ _id: ns });
    if (meta?.key?.location !== 1) {
      console.error(`✗ ${ns} is not sharded on { location, ... }.`);
      console.error('  Atlas UI → cluster → Global Configuration → Shard Collection (second field: customerId), then re-run.');
      process.exit(1);
    }
    const ranges = await client.db('config').collection('tags').countDocuments({ ns });
    log(`${ns} sharded on ${JSON.stringify(meta.key)} · ${ranges} zone range(s)`);
    if (ranges === 0) log(`  warning: no zone ranges for ${ns} — check location mappings in Global Configuration`);
  }

  // 2. Documents (idempotent upserts; filters include the full shard key).
  await db.collection('products').bulkWrite(
    // $set (not replace) so a re-run keeps existing embeddings.
    products.map(({ _id, ...p }) => ({ updateOne: { filter: { _id }, update: { $set: p }, upsert: true } })),
  );
  await db.collection('customers').bulkWrite(
    customers.map((c) => ({
      replaceOne: { filter: { location: c.location, customerId: c.customerId }, replacement: c, upsert: true },
    })),
  );
  await db.collection('orders').bulkWrite(
    orders.map((o) => ({
      replaceOne: {
        filter: { location: o.location, customerId: o.customerId, orderId: o.orderId },
        replacement: o,
        upsert: true,
      },
    })),
  );
  await db.collection('orders').createIndex({ orderId: 1 });
  log(`upserted ${products.length} products, ${customers.length} customers, ${orders.length} orders`);

  // 3. Embeddings for vector search.
  let dims = null;
  if (hasVoyage()) {
    const vectors = await embed(products.map(embeddingText), 'document');
    dims = vectors[0].length;
    await db.collection('products').bulkWrite(
      products.map((p, i) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { embedding: vectors[i] } } } })),
    );
    log(`stored ${vectors.length} embeddings (${dims} dims)`);
  } else {
    log('VOYAGE_API_KEY not set → skipping embeddings and the vector index (text search still works)');
  }

  // 4. Atlas Search + Vector Search indexes on products.
  const productsColl = db.collection('products');
  const existing = new Set((await productsColl.listSearchIndexes().toArray()).map((i) => i.name));
  const wanted = [
    {
      name: 'products_text',
      type: 'search',
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            name: { type: 'string', analyzer: 'lucene.english' },
            description: { type: 'string', analyzer: 'lucene.english' },
            tags: { type: 'string', analyzer: 'lucene.english' },
            category: { type: 'token' },
            stock: { type: 'token' },
          },
        },
      },
    },
  ];
  if (dims) {
    wanted.push({
      name: 'products_vec',
      type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: dims, similarity: 'cosine' },
          { type: 'filter', path: 'category' },
          { type: 'filter', path: 'stock' },
        ],
      },
    });
  }
  for (const idx of wanted) {
    if (existing.has(idx.name)) {
      log(`search index ${idx.name} exists`);
      continue;
    }
    await productsColl.createSearchIndex(idx);
    log(`creating search index ${idx.name} (builds in the background)`);
  }

  log('done → run: node atlas/check.mjs');
} finally {
  await client.close();
}
