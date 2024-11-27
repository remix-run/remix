import { defineConfig } from 'tsup';

export default defineConfig([
  {
    clean: true,
    dts: true,
    entry: ['src/scripts-test.ts'],
    format: ['cjs', 'esm'],
    platform: 'neutral',
  },
]);
