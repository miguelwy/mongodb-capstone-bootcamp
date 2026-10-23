import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Live mode: forward /api to server/index.mjs. Without the server, the app stays offline.
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
