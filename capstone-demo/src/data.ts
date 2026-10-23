import type { Placement } from './api';

export type TabId = 'overview' | 'search' | 'checkout' | 'europe';
export type Region = 'na' | 'eu';

export interface Product {
  id: string;
  name: string;
  category: 'Shoes' | 'Apparel' | 'Accessories' | 'Bags';
  color: string;
  swatch: string;
  price: number;
  stock: 'In stock' | 'Low stock' | 'Out of stock';
  description: string;
  tags: string[];
}

export interface Order {
  id: string;
  product: Product;
  traffic: 'normal' | 'flash';
  placedAt: string;
  // Present only when the order was written to the live Atlas cluster.
  live?: { location: string; placement: Placement };
}

// Synthetic catalog. Not real Trendify data.
export const CATALOG: Product[] = [
  {
    id: 'p1',
    name: 'Aero Knit City Sneaker',
    category: 'Shoes',
    color: 'Sand',
    swatch: '#D9C7A7',
    price: 98,
    stock: 'In stock',
    description: 'Breathable knit upper with a cushioned sole for long walking days in warm weather.',
    tags: ['comfortable', 'breathable', 'summer', 'walking', 'city', 'travel', 'lightweight', 'shoes', 'sneaker'],
  },
  {
    id: 'p2',
    name: 'Riviera Canvas Slip-On',
    category: 'Shoes',
    color: 'Off-white',
    swatch: '#F1EEE6',
    price: 64,
    stock: 'Low stock',
    description: 'Easy slip-on canvas shoe with a soft footbed, packable for weekend trips.',
    tags: ['comfortable', 'summer', 'casual', 'travel', 'packable', 'shoes', 'canvas', 'beach'],
  },
  {
    id: 'p3',
    name: 'Trailline Leather Sandal',
    category: 'Shoes',
    color: 'Cognac',
    swatch: '#9A5B34',
    price: 82,
    stock: 'Out of stock',
    description: 'Contoured footbed sandal with adjustable straps for warm-weather days.',
    tags: ['comfortable', 'summer', 'sandal', 'walking', 'leather', 'shoes', 'vacation'],
  },
  {
    id: 'p4',
    name: 'Linen Overshirt',
    category: 'Apparel',
    color: 'Sage',
    swatch: '#A9B8A0',
    price: 74,
    stock: 'In stock',
    description: 'Relaxed linen overshirt that layers lightly over a tee on summer evenings.',
    tags: ['summer', 'linen', 'breathable', 'city', 'shirt', 'layer', 'travel'],
  },
  {
    id: 'p5',
    name: 'Packable Rain Shell',
    category: 'Apparel',
    color: 'Navy',
    swatch: '#26364F',
    price: 120,
    stock: 'In stock',
    description: 'Lightweight water-resistant shell that folds into its own pocket.',
    tags: ['travel', 'packable', 'rain', 'jacket', 'lightweight', 'city', 'outerwear'],
  },
  {
    id: 'p6',
    name: 'Everyday Crossbody',
    category: 'Bags',
    color: 'Black',
    swatch: '#2A2A2A',
    price: 58,
    stock: 'In stock',
    description: 'Compact crossbody with a hidden zip pocket for phone, cards, and passport.',
    tags: ['travel', 'city', 'bag', 'compact', 'everyday', 'trip'],
  },
  {
    id: 'p7',
    name: 'Weekender Duffel',
    category: 'Bags',
    color: 'Olive',
    swatch: '#6B6B3A',
    price: 145,
    stock: 'Low stock',
    description: 'Structured duffel sized for a two-night city break, with a shoe compartment.',
    tags: ['travel', 'trip', 'weekend', 'bag', 'duffel', 'shoes'],
  },
  {
    id: 'p8',
    name: 'Polarized Round Sunglasses',
    category: 'Accessories',
    color: 'Tortoise',
    swatch: '#7A4E2D',
    price: 45,
    stock: 'In stock',
    description: 'Lightweight acetate frames with polarized lenses for bright days.',
    tags: ['summer', 'sun', 'city', 'travel', 'accessory', 'vacation', 'beach'],
  },
];

export const DEFAULT_PRODUCT = CATALOG[0];
export const DEFAULT_QUERY = 'comfortable shoes for a summer city trip';

const SYNONYMS: Record<string, string[]> = {
  shoe: ['shoes'],
  sneakers: ['sneaker', 'shoes'],
  comfy: ['comfortable'],
  trip: ['travel', 'trip'],
  vacation: ['travel', 'vacation'],
  holiday: ['travel', 'vacation'],
  hot: ['summer'],
  warm: ['summer'],
  urban: ['city'],
  bag: ['bag'],
  bags: ['bag'],
  jacket: ['jacket', 'outerwear'],
};

const STOPWORDS = new Set(['a', 'an', 'the', 'for', 'to', 'of', 'and', 'in', 'on', 'with', 'my', 'i', 'need', 'some']);

/**
 * Deterministic client-side scoring. Illustrates the *shape* of a semantic
 * retrieval pattern only — it is not an Atlas Vector Search query.
 */
export function scoreProducts(query: string): { product: Product; score: number }[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .flatMap((t) => [t, ...(SYNONYMS[t] ?? [])]);
  const unique = Array.from(new Set(terms));
  const category = categoryIntent(unique);
  const scored = CATALOG.map((product) => {
    if (unique.length === 0) return { product, score: 0.5 };
    const hay = new Set([...product.tags, product.category.toLowerCase(), ...product.name.toLowerCase().split(' ')]);
    const hits = unique.filter((t) => hay.has(t)).length;
    // Boost items whose category matches the shopper's stated intent ("shoes", "bag"…).
    const boost = category && product.category === category ? 0.3 : 0;
    return { product, score: Math.min(1, hits / unique.length + boost) };
  }).sort((a, b) => b.score - a.score);
  const strong = scored.filter((r) => r.score >= 0.55);
  return strong.length > 0 ? strong : scored.filter((r) => r.score > 0);
}

function categoryIntent(terms: string[]): Product['category'] | null {
  if (terms.some((t) => ['shoes', 'sneaker', 'sandal'].includes(t))) return 'Shoes';
  if (terms.some((t) => ['bag', 'duffel'].includes(t))) return 'Bags';
  if (terms.some((t) => ['shirt', 'jacket', 'outerwear'].includes(t))) return 'Apparel';
  if (terms.some((t) => ['accessory', 'sunglasses'].includes(t))) return 'Accessories';
  return null;
}

export const TABS: { id: TabId; label: string; step: string; rc?: 1 | 2 | 3 }[] = [
  { id: 'overview', label: 'Trendify 3.0', step: 'Context' },
  { id: 'search', label: 'Search & recommendations', step: 'Discover', rc: 1 },
  { id: 'checkout', label: 'Flash-sale checkout', step: 'Checkout', rc: 2 },
  { id: 'europe', label: 'Europe data placement', step: 'Europe', rc: 3 },
];

export const RCS = [
  {
    n: 1 as const,
    short: 'Search & recommendations',
    statement:
      'Power product discovery and recommendations from current operational data, with less separate search and retrieval infrastructure to synchronize.',
    evidence: [
      'Product search runs on Elasticsearch',
      'Python/TensorFlow recommendations query a PostgreSQL analytics database',
      'Recommendations are slow to update',
    ],
    consequence: 'Lower engagement & AOV',
    capability: 'Atlas Search + Atlas Vector Search',
    stillNeeded: ['Freshness', 'Relevance', 'Latency baseline', 'TensorFlow fit'],
  },
  {
    n: 2 as const,
    short: 'Flash-sale checkout',
    statement:
      'Scale checkout and related operational workloads through peak events while meeting the required availability and consistency.',
    evidence: [
      'Checkout latency spikes during flash sales',
      'PostgreSQL/RDS and Redis described as facing scalability challenges',
      'Monolith moving toward microservices',
    ],
    consequence: 'Cart abandonment',
    capability: 'Sharding + replica sets',
    stillNeeded: ['Peak profile', 'p95/p99 targets', 'Consistency', 'Recovery', 'RDS scaling today'],
  },
  {
    n: 3 as const,
    short: 'Europe data placement',
    statement:
      'Place regional data and writes deliberately as Trendify expands into Europe while keeping regional access performant.',
    evidence: [
      'Expansion from North America into Europe',
      'Multi-region performance strain',
      'GDPR workflow pressure on infrastructure',
    ],
    consequence: 'Regional performance & compliance burden',
    capability: 'Atlas Global Clusters (zones)',
    stillNeeded: ['Residency rules (legal)', 'Read/write origins', 'Regional targets'],
  },
];

export interface Notes {
  time: string;
  open: string;
  action: string;
  prompts: string[];
  transition: string;
  proves: string;
  doesNotProve: string;
  close?: string;
}

export const NOTES: Record<TabId | 'recap', Notes> = {
  overview: {
    time: '0–10 min · target 10 min',
    open:
      'Trendify 3.0 is about being ready before next Black Friday. Based on the scenario, I want to propose three capabilities to validate—not conclusions.',
    action: 'Page 1: walk the Before → Consequence → Why now chains. Page 2: the three proposed RCs. Page 3: what was prepared in Atlas for each RC (~45 s).',
    prompts: [
      'Do these three reflect your priorities, and in what order?',
      'What would success look like for each, and how is it measured today?',
    ],
    transition: 'Let’s start where the shopper starts—discovery.',
    proves: 'A shared framing of scenario pain and proposed RCs.',
    doesNotProve: 'That these RCs or their ranking are confirmed. Metrics are TBD.',
  },
  search: {
    time: '10–18 min · target 8 min',
    open:
      'The scenario describes recommendations querying a PostgreSQL analytics database while product search is in Elasticsearch, and recommendation updates are too slow.',
    action:
      'Run the example query, apply one filter, open a product, and add it to the shared shopper journey. Atlas Search and Vector Search are capabilities to evaluate — not a promise to replace Elasticsearch.',
    prompts: [
      'How current do product, inventory, and user signals need to be?',
      'How do you measure relevance today?',
      'Which system is authoritative for each field?',
    ],
    transition: 'That product is now in the shopper’s cart. Let’s take it into a flash sale.',
    proves: 'The shape of a retrieval pattern over operational data.',
    doesNotProve: 'Trendify’s index freshness, relevance, latency, conversion, or AOV impact.',
    close: 'This illustrates a retrieval pattern; it does not prove Trendify’s freshness, relevance, or business outcomes.',
  },
  checkout: {
    time: '18–26 min · target 8 min',
    open:
      'The scenario reports checkout latency spikes during flash sales, with cart abandonment as a direct business consequence.',
    action:
      'Pick a low-stock item (e.g. Riviera Slip-On, qty 3). Switch to Flash sale and run it: 20 shoppers buy at once, only as many orders as stock commit — no oversell. Point to the shards that stored them. Live mode only; Reset journey restores stock. The demo shard key is not a recommendation for Trendify. Mention the 15–20% abandonment aspiration only as something to validate.',
    prompts: [
      'How is RDS PostgreSQL scaled today?',
      'What consistency is required across cart, order, and inventory?',
      'What peak throughput, tail latency, and recovery objectives should we test?',
    ],
    transition: 'The order is placed. Now: where should that order live once Trendify sells in Europe?',
    proves: 'How sharding and replica-set roles could be discussed for a checkout path.',
    doesNotProve: 'Throughput, latency, availability, shard key, data model, or failover behavior.',
    close: 'This is a conceptual architecture walkthrough, not a load test or benchmark.',
  },
  europe: {
    time: '26–33 min · target 7 min',
    open:
      'As Trendify expands into Europe, the scenario calls out both multi-region performance strain and GDPR workflow pressure.',
    action:
      'Select Europe, inspect the conceptual regional placement, and point to the zone / data-locality idea. Backups, logs, analytics, and search indexes need their own placement decisions.',
    prompts: [
      'Which data must remain in-region?',
      'Where do reads and writes originate?',
      'What cross-region access is allowed?',
    ],
    transition: 'Let’s step back and connect the three RCs.',
    proves: 'A vocabulary for discussing location-aware data placement.',
    doesNotProve: 'Trendify’s residency policy or regional performance.',
    close:
      'This is a placement concept to validate with technical, security, and legal stakeholders.',
  },
  recap: {
    time: '33–40 min · target 7 min',
    open:
      'We followed one shopper from discovery to checkout to a European order. Each step maps to a proposed RC—and each still needs evidence.',
    action: 'Walk the three recap rows, park cross-cutting topics, then the next-step checklist.',
    prompts: ['Who should own validation for each RC?', 'Which baselines can we get first?'],
    transition: 'Agree owners and dates; close.',
    proves: 'A shared list of what must be validated.',
    doesNotProve: 'Customer agreement, ranking, or approval.',
    close:
      'These three RCs are proposed priorities. The next step is technical validation against Trendify’s actual workload and decision criteria.',
  },
};
