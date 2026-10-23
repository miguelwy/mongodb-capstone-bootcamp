# Trendify 3.0 · Technical Feasibility Workshop companion

Front-end demo for a 40-minute TFW roleplay. Synthetic data. Runs offline, or live against an Atlas Global Cluster.

```bash
npm install
npm run dev        # offline: in-browser synthetic behavior
npm run dev:live   # live: API (server/, port 8787) + Vite, proxied at /api
```

Live mode needs `atlas/.env` (see `atlas/README.md` for cluster setup and seed data). The app checks
`/api/health` on load; if the API is unreachable it falls back to offline mode automatically.

| Tab | Live behavior |
|---|---|
| Search | Atlas Vector Search (semantic) or Atlas Search (keyword), real stock levels |
| Checkout | Order + inventory decrement in one transaction; shard shown from `explain()` |
| Europe | Region switch updates `location` (shard key) → Atlas moves the order to that zone |
| Reset journey | Restores seed stock and deletes `LIVE-*` orders |

- Tabs: ← / → / Home / End on a focused tab. Press N for presenter notes; "Close & recap" works on every tab.
