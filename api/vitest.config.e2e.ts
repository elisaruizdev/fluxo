import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Todos los ficheros comparten la misma BD: se ejecutan de uno en uno
    fileParallelism: false,
    hookTimeout: 120_000,
  },
});
