import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const pkg = createRequire(import.meta.url)('./package.json');

export default defineConfig({
  define: { __VERSION__: JSON.stringify(pkg.version) },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/_mockFetch.ts', 'src/__tests__/e2e.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/**/types.ts', 'src/index.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85,
      },
      all: true,
    },
  },
});