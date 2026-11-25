import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // jsdom + recharts renders are slow when many suites run in parallel (CI, busy dev box); 5s default flakes.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Each jsdom worker is heavy; cap workers so a busy machine does not starve renders.
    maxWorkers: 4,
  },
});
