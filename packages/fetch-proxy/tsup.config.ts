import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/fetch-proxy.ts'],
  format: ['cjs', 'esm'],
  platform: 'neutral',
});
