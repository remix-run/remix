import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/form-data-parser.ts'],
  format: ['cjs', 'esm'],
  platform: 'neutral',
});
