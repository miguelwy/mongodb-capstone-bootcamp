// Synthetic demo data — mirrors src/data.ts. Not real Trendify data.

const stockLabel = (qty) => (qty === 0 ? 'Out of stock' : qty <= 5 ? 'Low stock' : 'In stock');

const raw = [
  {
    _id: 'p1', name: 'Aero Knit City Sneaker', category: 'Shoes', color: 'Sand', price: 98, qty: 40,
    description: 'Breathable knit upper with a cushioned sole for long walking days in warm weather.',
    tags: ['comfortable', 'breathable', 'summer', 'walking', 'city', 'travel', 'lightweight', 'sneaker'],
  },
  {
    _id: 'p2', name: 'Riviera Canvas Slip-On', category: 'Shoes', color: 'Off-white', price: 64, qty: 3,
    description: 'Easy slip-on canvas shoe with a soft footbed, packable for weekend trips.',
    tags: ['comfortable', 'summer', 'casual', 'travel', 'packable', 'canvas', 'beach'],
  },
  {
    _id: 'p3', name: 'Trailline Leather Sandal', category: 'Shoes', color: 'Cognac', price: 82, qty: 0,
    description: 'Contoured footbed sandal with adjustable straps for warm-weather days.',
    tags: ['comfortable', 'summer', 'sandal', 'walking', 'leather', 'vacation'],
  },
  {
    _id: 'p4', name: 'Linen Overshirt', category: 'Apparel', color: 'Sage', price: 74, qty: 25,
    description: 'Relaxed linen overshirt that layers lightly over a tee on summer evenings.',
    tags: ['summer', 'linen', 'breathable', 'city', 'shirt', 'layer', 'travel'],
  },
  {
    _id: 'p5', name: 'Packable Rain Shell', category: 'Apparel', color: 'Navy', price: 120, qty: 18,
    description: 'Lightweight water-resistant shell that folds into its own pocket.',
    tags: ['travel', 'packable', 'rain', 'jacket', 'lightweight', 'city', 'outerwear'],
  },
  {
    _id: 'p6', name: 'Everyday Crossbody', category: 'Bags', color: 'Black', price: 58, qty: 60,
    description: 'Compact crossbody with a hidden zip pocket for phone, cards, and passport.',
    tags: ['travel', 'city', 'bag', 'compact', 'everyday', 'trip'],
  },
  {
    _id: 'p7', name: 'Weekender Duffel', category: 'Bags', color: 'Olive', price: 145, qty: 4,
    description: 'Structured duffel sized for a two-night city break, with a shoe compartment.',
    tags: ['travel', 'trip', 'weekend', 'bag', 'duffel'],
  },
  {
    _id: 'p8', name: 'Polarized Round Sunglasses', category: 'Accessories', color: 'Tortoise', price: 45, qty: 33,
    description: 'Lightweight acetate frames with polarized lenses for bright days.',
    tags: ['summer', 'sun', 'city', 'travel', 'accessory', 'vacation', 'beach'],
  },
];

export const products = raw.map((p) => ({ ...p, stock: stockLabel(p.qty), updatedAt: new Date() }));

// `location` uses ISO 3166-1 alpha-2 codes so Global Clusters can map it to a zone.
export const customers = [
  { location: 'US', customerId: 'c-na-001', name: 'Demo Shopper NA 1', email: 'na1@example.test' },
  { location: 'CA', customerId: 'c-na-002', name: 'Demo Shopper NA 2', email: 'na2@example.test' },
  { location: 'DE', customerId: 'c-eu-001', name: 'Demo Shopper EU 1', email: 'eu1@example.test' },
  { location: 'FR', customerId: 'c-eu-002', name: 'Demo Shopper EU 2', email: 'eu2@example.test' },
];

export const orders = [
  { location: 'US', customerId: 'c-na-001', orderId: 'SEED-0001', items: [{ productId: 'p1', qty: 1, price: 98 }], total: 98, status: 'placed' },
  { location: 'CA', customerId: 'c-na-002', orderId: 'SEED-0002', items: [{ productId: 'p6', qty: 1, price: 58 }], total: 58, status: 'placed' },
  { location: 'DE', customerId: 'c-eu-001', orderId: 'SEED-0003', items: [{ productId: 'p4', qty: 1, price: 74 }], total: 74, status: 'placed' },
  { location: 'FR', customerId: 'c-eu-002', orderId: 'SEED-0004', items: [{ productId: 'p8', qty: 1, price: 45 }], total: 45, status: 'placed' },
].map((o) => ({ ...o, createdAt: new Date() }));

export const embeddingText = (p) =>
  `${p.name}. ${p.description} Category: ${p.category}. Color: ${p.color}. Tags: ${p.tags.join(', ')}.`;
