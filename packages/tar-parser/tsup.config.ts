import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/tar-parser.ts'],
  format: ['cjs', 'esm'],
  platform: 'neutral',
});
