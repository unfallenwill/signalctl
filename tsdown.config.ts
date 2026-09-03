import { createRequire } from 'node:module';
import { defineConfig } from 'tsdown';

const pkg = createRequire(import.meta.url)('./package.json');

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  clean: true,
  minify: true,
  dts: true,
  define: { __VERSION__: JSON.stringify(pkg.version) },
});