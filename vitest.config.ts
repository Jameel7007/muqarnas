import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@muqarnas/plan': fileURLToPath(new URL('./packages/plan/src/index.ts', import.meta.url)),
      '@muqarnas/lift': fileURLToPath(new URL('./packages/lift/src/index.ts', import.meta.url)),
      '@muqarnas/render': fileURLToPath(new URL('./packages/render/src/index.ts', import.meta.url)),
      '@muqarnas/scenes': fileURLToPath(new URL('./packages/scenes/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'site/src/**/*.test.ts'],
  },
});
