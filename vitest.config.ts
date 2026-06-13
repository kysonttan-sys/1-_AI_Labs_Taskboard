import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    // API tests share a single Postgres database; run files sequentially
    // so each file's beforeEach/afterAll can clean the OKR tables without
    // racing with another file's assertions.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
