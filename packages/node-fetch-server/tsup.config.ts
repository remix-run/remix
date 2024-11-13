import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/node-fetch-server.ts'],
  format: ['cjs', 'esm'],
  platform: 'neutral',
});
