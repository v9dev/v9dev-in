import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'functions/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}', 'functions/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': r('./src'),
      '@components': r('./src/components'),
      '@lib': r('./src/lib'),
      '@content': r('./src/content'),
      '@styles': r('./src/styles'),
    },
  },
});
