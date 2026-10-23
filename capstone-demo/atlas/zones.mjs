// Shards the global collections on { location, customerId } and assigns location → zone ranges.
// NOT RECOMMENDED on Atlas: unmanaged zone ranges are removed by Atlas within ~1 minute.
// Prefer Data Explorer → collection → Global Writes tab. Kept only for non-Atlas sharded clusters.
// Usage: node --env-file=atlas/.env atlas/zones.mjs
import { MongoClient, MinKey, MaxKey } from 'mongodb';

const DB = 'trendify_demo';
const ZONE_NA = process.env.ZONE_NA ?? 'Zone 1'; // us-east-1
const ZONE_EU = process.env.ZONE_EU ?? 'Zone 2'; // eu-west-1
const MAP = { US: ZONE_NA, CA: ZONE_NA, BR: ZONE_NA, DE: ZONE_EU, FR: ZONE_EU, IE: ZONE_EU };

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const admin = client.db('admin');
const cfg = client.db('config');

try {
  const zones = new Set((await cfg.collection('shards').find().toArray()).flatMap((s) => s.tags ?? []));
  for (const z of new Set(Object.values(MAP))) {
    if (!zones.has(z)) throw new Error(`zone "${z}" not found on any shard (have: ${[...zones].join(', ')})`);
  }

  for (const coll of ['customers', 'orders']) {
    const ns = `${DB}.${coll}`;
    const meta = await cfg.collection('collections').findOne({ _id: ns });
    if (!meta?.key) {
      await admin.command({ shardCollection: ns, key: { location: 1, customerId: 1 } });
      console.log(`• sharded ${ns}`);
    } else {
      console.log(`• ${ns} already sharded on ${JSON.stringify(meta.key)}`);
    }
    for (const [loc, zone] of Object.entries(MAP)) {
      await admin.command({
        updateZoneKeyRange: ns,
        min: { location: loc, customerId: new MinKey() },
        max: { location: loc, customerId: new MaxKey() },
        zone,
      });
    }
    console.log(`  ${Object.keys(MAP).length} zone ranges set: ${Object.entries(MAP).map(([l, z]) => `${l}→${z}`).join(' ')}`);
  }
} finally {
  await client.close();
}
